/**
 * Conversations: private chats and groups, membership, typing state,
 * read cursors and the efficiently-denormalised inbox.
 *
 * Read-cost design
 * ----------------
 * - Inbox: ONE listener on `conversations` filtered by membership.
 * - Each conversation carries `lastMessage` and `unreadCounts`, so the list
 *   renders without touching the messages subcollection.
 * - Opening a chat attaches a messages listener; the reads doc (one small
 *   document per member) stores the cursor used for unread maths.
 */
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import {
  COLLECTIONS,
  CONVERSATION_TYPES,
  buildGroupConversation,
  buildPrivateConversation,
  privateConversationId,
  TYPING_TTL_MS,
} from './models.js';
import { AppError } from '../utils/errors.js';
import { normaliseUsername, validateUsername, GROUP_NAME_MAX } from '../utils/validation.js';

const convCol = () => collection(db, COLLECTIONS.conversations);
const convRef = (id) => doc(db, COLLECTIONS.conversations, id);
const messagesCol = (id) => collection(db, COLLECTIONS.conversations, id, COLLECTIONS.messages);
const typingCol = (id) => collection(db, COLLECTIONS.conversations, id, COLLECTIONS.typing);
const typingRef = (id, uid) => doc(db, COLLECTIONS.conversations, id, COLLECTIONS.typing, uid);
const readRef = (id, uid) => doc(db, COLLECTIONS.conversations, id, COLLECTIONS.reads, uid);

const memberCard = (profile) => ({
  displayName: profile?.displayName || 'Chazter user',
  username: profile?.username || '',
  photoURL: profile?.photoURL || '',
});

/* ------------------------------------------------------------------ *
 * Inbox
 * ------------------------------------------------------------------ */

/**
 * Live conversation list for the signed-in user.
 * Sorted client-side so the query needs no composite index.
 */
export function subscribeConversations(uid, onData, onError) {
  if (!uid) return () => {};
  // NOTE: no orderBy here on purpose. `array-contains` + `orderBy` needs a
  // composite index that only exists once firestore.indexes.json is deployed;
  // sorting client-side keeps a fresh project working out of the box and the
  // list is already capped at 60 conversations.
  const q = query(convCol(), where('memberIds', 'array-contains', uid), limit(60));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((item) => normaliseConversation({ id: item.id, ...item.data() }, uid))
        .filter((conversation) => !conversation.archived)
        .sort((a, b) => b.lastActivityMs - a.lastActivityMs);
      onData(list, { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites });
    },
    onError,
  );
}

/** Attach derived fields used by the UI (computed, never stored). */
export function normaliseConversation(conversation, uid) {
  const lastActivity = conversation.lastMessageAt || conversation.updatedAt;
  const lastActivityMs =
    typeof lastActivity?.toMillis === 'function'
      ? lastActivity.toMillis()
      : lastActivity instanceof Date
        ? lastActivity.getTime()
        : 0;
  const typing = conversation.typing || {};
  const now = Date.now();
  const typingUsers = Object.entries(typing)
    .filter(([entryUid, value]) => {
      if (entryUid === uid) return false;
      const expiresAt =
        typeof value?.expiresAt?.toMillis === 'function' ? value.expiresAt.toMillis() : 0;
      return expiresAt > now;
    })
    .map(([entryUid, value]) => ({
      uid: entryUid,
      name: conversation.members?.[entryUid]?.displayName || value?.displayName || 'Someone',
    }));
  return {
    ...conversation,
    lastActivityMs,
    typingUsers,
    unreadCount: Number(conversation.unreadCounts?.[uid] || 0),
    muted: Array.isArray(conversation.mutedBy) && conversation.mutedBy.includes(uid),
    archived: Array.isArray(conversation.archivedBy) && conversation.archivedBy.includes(uid),
    isAdmin: Array.isArray(conversation.admins) && conversation.admins.includes(uid),
  };
}

export function subscribeConversation(conversationId, uid, onData, onError) {
  if (!conversationId) return () => {};
  return onSnapshot(
    convRef(conversationId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const data = { id: snap.id, ...snap.data() };
      if (uid && !data.memberIds?.includes(uid)) {
        onData({ ...data, accessDenied: true });
        return;
      }
      onData(normaliseConversation(data, uid));
    },
    onError,
  );
}

export async function getConversation(conversationId) {
  const snap = await getDoc(convRef(conversationId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* ------------------------------------------------------------------ *
 * Creation
 * ------------------------------------------------------------------ */

/** Open (or re-open) the private chat with another user. Idempotent. */
export async function startPrivateConversation(currentProfile, otherProfile) {
  if (!currentProfile?.uid || !otherProfile?.uid) {
    throw new AppError('invalid-member', 'Both people need to be signed in.');
  }
  if (currentProfile.uid === otherProfile.uid) {
    throw new AppError('self-chat', 'You can’t start a chat with yourself.');
  }
  const id = privateConversationId(currentProfile.uid, otherProfile.uid);
  const ref = convRef(id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const data = existing.data();
    // A previous "delete chat" may have removed the user from members.
    if (!data.memberIds?.includes(currentProfile.uid)) {
      await updateDoc(ref, {
        memberIds: arrayUnion(currentProfile.uid),
        [`members.${currentProfile.uid}`]: memberCard(currentProfile),
      });
    }
    return { id, created: false, conversation: { ...data, id } };
  }

  const payload = buildPrivateConversation({
    memberIds: [currentProfile.uid, otherProfile.uid],
    memberProfiles: { [currentProfile.uid]: currentProfile, [otherProfile.uid]: otherProfile },
  });
  await setDoc(ref, payload);
  return { id, created: true };
}

export async function createGroupConversation(creatorProfile, { name, members }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new AppError('invalid-name', 'Give the group a name.');
  if (trimmed.length > GROUP_NAME_MAX) throw new AppError('invalid-name', 'That group name is too long.');
  const uniqueMembers = [...new Set((members || []).map((m) => m.uid || m))].filter(
    (uid) => uid && uid !== creatorProfile.uid,
  );
  if (uniqueMembers.length < 1) {
    throw new AppError('invalid-members', 'Add at least one other person to the group.');
  }
  const { getUserProfile } = await import('./userService.js');
  const profiles = await Promise.all(uniqueMembers.map((uid) => getUserProfile(uid)));
  const found = profiles.filter(Boolean);
  if (found.length !== uniqueMembers.length) {
    throw new AppError('invalid-members', 'One of those people no longer exists.');
  }
  const memberProfiles = Object.fromEntries(found.map((p) => [p.uid, p]));
  const payload = buildGroupConversation({
    creatorId: creatorProfile.uid,
    creatorProfile,
    name: trimmed,
    memberIds: uniqueMembers,
    memberProfiles,
  });
  const ref = doc(convCol());
  await setDoc(ref, payload);
  return ref.id;
}

/* ------------------------------------------------------------------ *
 * Read cursors + unread counts
 * ------------------------------------------------------------------ */

/** Reset the caller's unread counter (also clears legacy user-doc counters). */
export async function markConversationRead(conversationId, uid, legacyUserDocUnread) {
  const ref = convRef(conversationId);
  try {
    await updateDoc(ref, {
      [`unreadCounts.${uid}`]: 0,
      [`lastReadAt.${uid}`]: serverTimestamp(),
    });
  } catch (error) {
    if (!import.meta.env.PROD) console.warn('[chazter] markConversationRead failed', error?.code);
  }
  return { conversationId, uid, legacyUserDocUnread };
}

/**
 * Persist the highest message timestamp this user has seen.
 * Read receipts are derived from this single cursor document.
 */
export async function updateReadCursor(conversationId, uid, millis) {
  if (!conversationId || !uid || !millis) return;
  try {
    await setDoc(
      readRef(conversationId, uid),
      {
        uid,
        lastReadAt: Timestamp.fromMillis(millis),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    if (!import.meta.env.PROD) console.warn('[chazter] read cursor failed', error?.code);
  }
}

export function subscribeReadCursors(conversationId, onData, onError) {
  return onSnapshot(
    collection(db, COLLECTIONS.conversations, conversationId, COLLECTIONS.reads),
    (snap) => {
      const cursors = {};
      for (const item of snap.docs) {
        const value = item.data().lastReadAt;
        cursors[item.id] =
          typeof value?.toMillis === 'function' ? value.toMillis() : value ? Number(value) : 0;
      }
      onData(cursors);
    },
    onError,
  );
}

/* ------------------------------------------------------------------ *
 * Typing indicators
 * ------------------------------------------------------------------ */

/**
 * Typing state is written to `typing/{uid}` (its own tiny document) instead of
 * the conversation document: other members are already listening to the
 * parent conversation, and only the typing user writes here. One write every
 * ~2.5s max, and it expires automatically after TYPING_TTL_MS.
 */
let lastTypingWrite = 0;
export async function setTyping(conversationId, uid, profile) {
  if (!conversationId || !uid) return;
  const now = Date.now();
  if (now - lastTypingWrite < 2500) return;
  lastTypingWrite = now;
  try {
    await setDoc(typingRef(conversationId, uid), {
      uid,
      displayName: profile?.displayName || '',
      expiresAt: Timestamp.fromMillis(now + TYPING_TTL_MS),
    });
  } catch (error) {
    if (!import.meta.env.PROD) console.warn('[chazter] typing write failed', error?.code);
  }
}

export async function clearTyping(conversationId, uid) {
  if (!conversationId || !uid) return;
  lastTypingWrite = 0;
  try {
    await deleteDoc(typingRef(conversationId, uid));
  } catch {
    /* noop — rule may deny if already gone */
  }
}

/** Realtime typing names for a chat, excluding yourself. */
export function subscribeTyping(conversationId, uid, onData, onError) {
  return onSnapshot(
    typingCol(conversationId),
    (snap) => {
      const now = Date.now();
      const names = [];
      for (const item of snap.docs) {
        if (item.id === uid) continue;
        const value = item.data();
        const expiresAt = value?.expiresAt?.toMillis?.() || 0;
        if (expiresAt > now) names.push(value.displayName || 'Someone');
      }
      onData(names);
    },
    onError,
  );
}

/* ------------------------------------------------------------------ *
 * Membership
 * ------------------------------------------------------------------ */

/** Add members to a group (admins only — also enforced in Security Rules). */
export async function addGroupMembers(conversationId, uid, members) {
  const { getUserProfile } = await import('./userService.js');
  const conversation = await getConversation(conversationId);
  if (!conversation) throw new AppError('conversation-not-found');
  if (conversation.type !== CONVERSATION_TYPES.group) {
    throw new AppError('not-a-group', 'Only groups have members to manage.');
  }
  if (!conversation.admins?.includes(uid)) {
    throw new AppError('not-admin', 'Only group admins can add people.');
  }
  const candidates = [...new Set((members || []).map((m) => m.uid || m))].filter(
    (memberId) => memberId && !conversation.memberIds.includes(memberId),
  );
  if (!candidates.length) throw new AppError('invalid-members', 'Those people are already in this group.');
  const profiles = (await Promise.all(candidates.map((memberId) => getUserProfile(memberId)))).filter(
    Boolean,
  );
  if (!profiles.length) throw new AppError('invalid-members', 'Those people no longer exist.');

  const patch = {
    memberIds: arrayUnion(...profiles.map((p) => p.uid)),
    admins: arrayUnion(...profiles.map((p) => p.uid).slice(0, 0)), // no auto-promotion
    updatedAt: serverTimestamp(),
  };
  for (const profile of profiles) {
    patch[`members.${profile.uid}`] = { ...memberCard(profile), role: 'member', joinedAt: Date.now() };
    patch[`unreadCounts.${profile.uid}`] = 0;
    patch[`lastReadAt.${profile.uid}`] = serverTimestamp();
  }
  // Ensure the admins key isn't sent unchanged when empty.
  if (!patch.admins.length) delete patch.admins;
  await updateDoc(convRef(conversationId), patch);
  return profiles;
}

/** Leave a group, or remove someone else (admin only). */
export async function removeMember(conversationId, actorUid, targetUid) {
  const conversation = await getConversation(conversationId);
  if (!conversation) throw new AppError('conversation-not-found');
  const isSelf = actorUid === targetUid;
  if (!isSelf && !conversation.admins?.includes(actorUid)) {
    throw new AppError('not-admin', 'Only group admins can remove people.');
  }
  if (!isSelf && conversation.createdBy === targetUid) {
    throw new AppError('owner', 'The group owner can’t be removed.');
  }
  if (!conversation.memberIds?.includes(targetUid)) {
    throw new AppError('not-a-member', 'That person isn’t in this group.');
  }

  const remaining = conversation.memberIds.filter((id) => id !== targetUid);

  if (conversation.type === CONVERSATION_TYPES.group && remaining.length === 0) {
    await deleteDoc(convRef(conversationId));
    return { deleted: true };
  }
  if (remaining.length === 1 && conversation.type === CONVERSATION_TYPES.group) {
    throw new AppError('group-too-small', 'A group needs at least two people.');
  }

  const patch = {
    memberIds: arrayRemove(targetUid),
    updatedAt: serverTimestamp(),
    [`members.${targetUid}`]: deleteField(),
    [`unreadCounts.${targetUid}`]: deleteField(),
    [`lastReadAt.${targetUid}`]: deleteField(),
    admins: arrayRemove(targetUid),
  };
  await updateDoc(convRef(conversationId), patch);
  // Clear the departed member's read cursor + typing doc (they can't, post-removal).
  await Promise.all([
    deleteDoc(readRef(conversationId, targetUid)).catch(() => {}),
    deleteDoc(typingRef(conversationId, targetUid)).catch(() => {}),
  ]);
  return { deleted: false, remaining };
}

/**
 * "Delete chat" for the caller: removes them from a private conversation's
 * membership. The other person keeps their history; a new message re-opens it.
 */
export async function leaveConversation(conversationId, uid) {
  const conversation = await getConversation(conversationId);
  if (!conversation) return;
  if (conversation.type === CONVERSATION_TYPES.group) {
    return removeMember(conversationId, uid, uid);
  }
  await updateDoc(convRef(conversationId), {
    memberIds: arrayRemove(uid),
    [`members.${uid}`]: deleteField(),
    [`unreadCounts.${uid}`]: deleteField(),
    [`lastReadAt.${uid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
  return { deleted: false };
}

export async function updateGroupInfo(conversationId, uid, { name, photoURL }) {
  const conversation = await getConversation(conversationId);
  if (!conversation || conversation.type !== CONVERSATION_TYPES.group) {
    throw new AppError('not-a-group', 'That conversation isn’t a group.');
  }
  if (!conversation.admins?.includes(uid)) {
    throw new AppError('not-admin', 'Only group admins can edit group details.');
  }
  const patch = { updatedAt: serverTimestamp() };
  if (typeof name === 'string') {
    const trimmed = name.trim();
    if (!trimmed) throw new AppError('invalid-name', 'Give the group a name.');
    if (trimmed.length > GROUP_NAME_MAX) throw new AppError('invalid-name', 'That group name is too long.');
    patch.name = trimmed;
  }
  if (typeof photoURL === 'string') patch.photoURL = photoURL;
  await updateDoc(convRef(conversationId), patch);
  return { ...conversation, ...patch };
}

export async function setMuted(conversationId, uid, muted) {
  await updateDoc(convRef(conversationId), {
    mutedBy: muted ? arrayUnion(uid) : arrayRemove(uid),
  });
}

export async function setArchived(conversationId, uid, archived) {
  await updateDoc(convRef(conversationId), {
    archivedBy: archived ? arrayUnion(uid) : arrayRemove(uid),
  });
}

export async function promoteToAdmin(conversationId, actorUid, targetUid) {
  const conversation = await getConversation(conversationId);
  if (!conversation?.admins?.includes(actorUid)) {
    throw new AppError('not-admin', 'Only group admins can promote members.');
  }
  await updateDoc(convRef(conversationId), {
    admins: arrayUnion(targetUid),
    [`members.${targetUid}.role`]: 'admin',
  });
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

/**
 * Search a conversation's messages with a bounded scan (latest 500 messages),
 * which works with zero extra indexes or third-party services.
 */
export async function searchMessages(conversationId, term, { max = 200 } = {}) {
  const needle = String(term || '').trim().toLowerCase();
  if (needle.length < 2) return [];
  const snap = await getDocs(
    query(messagesCol(conversationId), orderBy('createdAt', 'desc'), limit(max)),
  );
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((message) => {
      if ((message.text || '').toLowerCase().includes(needle)) return true;
      return (message.senderName || message.senderUsername || '').toLowerCase().includes(needle);
    });
}

/** Search across all of the user's conversations (text only). */
export async function searchAllMessages(conversations, term) {
  const needle = String(term || '').trim().toLowerCase();
  if (needle.length < 2) return [];
  const results = await Promise.all(
    conversations.slice(0, 12).map(async (conversation) => {
      const hits = await searchMessages(conversation.id, needle, { max: 100 }).catch(() => []);
      return hits.map((hit) => ({ ...hit, conversation }));
    }),
  );
  return results.flat().sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
}

/** Look up a user by exact username (for "new chat by @handle"). */
export async function findUserByUsername(username) {
  const error = validateUsername(username);
  if (error) throw new AppError('username-invalid', error);
  const claimSnap = await getDoc(doc(db, COLLECTIONS.usernames, normaliseUsername(username)));
  if (!claimSnap.exists()) return null;
  const { getUserProfile } = await import('./userService.js');
  return getUserProfile(claimSnap.data().uid);
}

export { writeBatch, serverTimestamp };
