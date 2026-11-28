/**
 * Servers: communities with named channels.
 *
 * Design decisions worth knowing before reading the code:
 *
 * 1. **A channel IS a conversation.** It lives in `conversations/{id}` with
 *    `type: 'channel'`, so messaging, unread counts, typing indicators, read
 *    receipts, the message rules and the composer are reused unchanged.
 *    A parallel messaging stack would be a second set of bugs.
 *
 * 2. **Membership is denormalised onto every channel.** Joining a server
 *    writes your uid into each channel's `memberIds`. That keeps the existing
 *    `array-contains` inbox query working for channels, and means the
 *    security rules need no cross-document read per message.
 *
 * 3. **The channels a member can see are capped** (SERVER_MAX_CHANNELS) so a
 *    join is a bounded write, not an unbounded one.
 */
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import {
  CHANNEL_NAME_MAX,
  COLLECTIONS,
  CONVERSATION_TYPES,
  INVITE_TYPES,
  SERVER_MAX_CHANNELS,
  SERVER_NAME_MAX,
  SERVER_ROLES,
  buildChannel,
  buildInvite,
  buildServer,
  buildServerMember,
  inviteCode,
} from './models.js';
import { AppError } from '../utils/errors.js';

const serversCol = () => collection(db, COLLECTIONS.servers);
const serverRef = (id) => doc(db, COLLECTIONS.servers, id);
const membersCol = (serverId) => collection(db, COLLECTIONS.servers, serverId, COLLECTIONS.serverMembers);
const memberRef = (serverId, uid) => doc(membersCol(serverId), uid);
const invitesCol = () => collection(db, COLLECTIONS.invites);
const inviteRef = (code) => doc(invitesCol(), code);
const convRef = (id) => doc(db, COLLECTIONS.conversations, id);

/** Validate a new server name. Pure, so it is tested directly. */
export function validateServerName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'Give your server a name.';
  if (trimmed.length > SERVER_NAME_MAX) return `Keep the name under ${SERVER_NAME_MAX} characters.`;
  return '';
}

/**
 * Channel names follow chat convention: lowercase, no spaces, dashes for
 * separation. Auto-normalising is friendlier than rejecting.
 */
export function normaliseChannelName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, CHANNEL_NAME_MAX);
}

export function validateChannelName(name) {
  const normalised = normaliseChannelName(name);
  if (!normalised) return 'Give the channel a name.';
  if (normalised.length < 2) return 'Channel names need at least 2 characters.';
  return '';
}

/* ------------------------------------------------------------------ *
 * Read
 * ------------------------------------------------------------------ */

/** Live list of servers this user belongs to. */
export function subscribeServers(uid, onData, onError) {
  if (!uid) return () => {};
  // No orderBy: keeps this working without a composite index, and the list is
  // small and sorted client-side.
  const q = query(serversCol(), where('memberIds', 'array-contains', uid), limit(30));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
      onData(list);
    },
    onError,
  );
}

export function subscribeServer(serverId, onData, onError) {
  if (!serverId) return () => {};
  return onSnapshot(
    serverRef(serverId),
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

export function subscribeChannels(serverId, uid, onData, onError) {
  if (!serverId || !uid) return () => {};
  // A Firestore query is only allowed if the rules can PROVE every result is
  // readable. The conversation read rule is membership-based, so the query
  // must filter on membership too — filtering by serverId alone would be
  // rejected outright, not merely slow. Server membership is copied onto
  // every channel for exactly this reason.
  const q = query(
    collection(db, COLLECTIONS.conversations),
    where('serverId', '==', serverId),
    where('type', '==', CONVERSATION_TYPES.channel),
    where('memberIds', 'array-contains', uid),
    limit(SERVER_MAX_CHANNELS),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
      onData(list);
    },
    onError,
  );
}

export async function getServer(serverId) {
  const snap = await getDoc(serverRef(serverId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getServerMembership(serverId, uid) {
  const snap = await getDoc(memberRef(serverId, uid));
  return snap.exists() ? { ...snap.data() } : null;
}

/** Roles that may manage channels and invites. */
export function canManage(role) {
  return role === SERVER_ROLES.owner || role === SERVER_ROLES.admin;
}

/* ------------------------------------------------------------------ *
 * Create
 * ------------------------------------------------------------------ */

/**
 * Create a server with a default #general channel.
 *
 * Writes are batched where possible; the member roster is written per member
 * because a batch would need one read per member to know them all.
 */
export async function createServer(profile, { name, channelName = 'general' }) {
  const nameError = validateServerName(name);
  if (nameError) throw new AppError('invalid-name', nameError);
  const channelError = validateChannelName(channelName);
  if (channelError) throw new AppError('invalid-channel', channelError);

  const serverDoc = doc(serversCol());
  const channelDoc = doc(collection(db, COLLECTIONS.conversations));
  const now = Date.now();

  const payload = {
    ...buildServer({
      ownerId: profile.uid,
      ownerProfile: profile,
      name,
      channels: [{ id: channelDoc.id }],
    }),
    memberIds: [profile.uid],
  };

  const channelPayload = buildChannel({
    serverId: serverDoc.id,
    name: normaliseChannelName(channelName),
    topic: 'The first channel in this server.',
    createdBy: profile.uid,
    creatorProfile: profile,
    memberIds: [profile.uid],
    memberProfiles: {},
  });

  const batch = writeBatch(db);
  batch.set(serverDoc, payload);
  batch.set(channelDoc, channelPayload);
  batch.set(memberRef(serverDoc.id, profile.uid), {
    ...buildServerMember({ serverId: serverDoc.id, uid: profile.uid, profile, role: SERVER_ROLES.owner }),
    joinedAt: now,
  });
  await batch.commit();

  return { serverId: serverDoc.id, channelId: channelDoc.id };
}

/** Add a channel. Gated on the caller's role in the member document. */
export async function createChannel(serverId, profile, { name, topic = '' }) {
  const nameError = validateChannelName(name);
  if (nameError) throw new AppError('invalid-channel', nameError);

  const [server, membership] = await Promise.all([getServer(serverId), getServerMembership(serverId, profile.uid)]);
  if (!server) throw new AppError('server-not-found');
  if (!canManage(membership?.role)) {
    throw new AppError('not-admin', 'Only server owners and admins can add channels.');
  }
  if ((server.channelIds?.length || 0) >= SERVER_MAX_CHANNELS) {
    throw new AppError('too-many-channels', `Servers are limited to ${SERVER_MAX_CHANNELS} channels.`);
  }

  // Everyone already in the server joins the new channel.
  const memberIds = await getServerMemberIds(serverId);
  const channelDoc = doc(collection(db, COLLECTIONS.conversations));
  const payload = buildChannel({
    serverId,
    name: normaliseChannelName(name),
    topic,
    createdBy: profile.uid,
    creatorProfile: profile,
    memberIds,
    memberProfiles: {},
  });

  const batch = writeBatch(db);
  batch.set(channelDoc, payload);
  batch.update(serverRef(serverId), {
    channelIds: arrayUnion(channelDoc.id),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return channelDoc.id;
}

/** Remove a channel and its pointer on the server. Owner/admin only. */
export async function deleteChannel(serverId, uid, channelId) {
  const membership = await getServerMembership(serverId, uid);
  if (!canManage(membership?.role)) {
    throw new AppError('not-admin', 'Only server owners and admins can remove channels.');
  }
  const server = await getServer(serverId);
  if ((server?.channelIds?.length || 0) <= 1) {
    throw new AppError('last-channel', 'A server needs at least one channel.');
  }
  const batch = writeBatch(db);
  batch.delete(convRef(channelId));
  batch.update(serverRef(serverId), { updatedAt: serverTimestamp() });
  await batch.commit();
  return { channelId };
}

/** Uids of every member of a server (capped). */
async function getServerMemberIds(serverId) {
  const snap = await getDocs(query(membersCol(serverId), limit(64)));
  return snap.docs.map((item) => item.id);
}

/* ------------------------------------------------------------------ *
 * Invites
 * ------------------------------------------------------------------ */

/**
 * Create a no-expiry invite.
 *
 * `expiresAt: null` is deliberate and is validated by the rules: a link that
 * still works next year. Revocation is the control, not expiry.
 */
export async function createInvite(profile, { type, targetId, targetName }) {
  if (!Object.values(INVITE_TYPES).includes(type)) {
    throw new AppError('invalid-invite', 'Unknown invite type.');
  }
  // Managing invites for a server requires a role; group invites are checked
  // against the conversation's admins.
  if (type === INVITE_TYPES.server) {
    const membership = await getServerMembership(targetId, profile.uid);
    if (!canManage(membership?.role)) {
      throw new AppError('not-admin', 'Only server owners and admins can create invites.');
    }
  } else {
    const conversation = await getDoc(convRef(targetId));
    if (!conversation.exists()) throw new AppError('conversation-not-found');
    const data = conversation.data();
    if (!data.admins?.includes(profile.uid)) {
      throw new AppError('not-admin', 'Only group admins can create invites.');
    }
  }

  let code = inviteCode();
  // Collisions are astronomically unlikely (31^10) but retry rather than fail.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await getDoc(inviteRef(code));
    if (!existing.exists()) break;
    code = inviteCode();
  }

  const payload = buildInvite({
    type,
    targetId,
    targetName,
    createdBy: profile.uid,
    createdByName: profile.displayName,
  });
  await setDoc(inviteRef(code), { ...payload, code });
  return { code, ...payload };
}

export async function getInvite(code) {
  if (!code) return null;
  const snap = await getDoc(inviteRef(code));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.revoked) return null;
  return { ...data };
}

/**
 * List the invites for a server/group so an admin can see and revoke them.
 * Requires only read on the invite documents, which the rules scope to
 * creators and admins.
 */
export async function listInvites({ type, targetId }) {
  const q = query(invitesCol(), where('targetId', '==', targetId), where('type', '==', type), limit(25));
  const snap = await getDocs(q);
  return snap.docs
    .map((item) => ({ code: item.id, ...item.data() }))
    .filter((invite) => !invite.revoked)
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

/** Revoke. The code stays reserved but stops granting access. */
export async function revokeInvite(code) {
  await updateDoc(inviteRef(code), { revoked: true, revokedAt: serverTimestamp() });
}

/* ------------------------------------------------------------------ *
 * Join
 * ------------------------------------------------------------------ */

/**
 * Join the server behind an invite, or the group chat behind a group invite.
 *
 * Idempotent: joining twice is a no-op, not an error. This matters because
 * people click invite links twice and reopen them from history.
 */
export async function joinViaInvite(code, profile) {
  const invite = await getInvite(code);
  if (!invite) throw new AppError('invite-invalid', 'This invite link is no longer valid.');
  if (invite.type === INVITE_TYPES.group) {
    return joinGroupViaInvite(invite, profile);
  }
  return joinServerViaInvite(invite, profile);
}

async function joinServerViaInvite(invite, profile) {
  const serverId = invite.targetId;
  const server = await getServer(serverId);
  if (!server) throw new AppError('server-not-found', 'That server no longer exists.');

  const existing = await getServerMembership(serverId, profile.uid);
  if (existing) return { serverId, channelId: server.channelIds?.[0] || null, alreadyMember: true };

  const channelIds = server.channelIds || [];
  const batch = writeBatch(db);
  batch.set(memberRef(serverId, profile.uid), {
    ...buildServerMember({ serverId, uid: profile.uid, profile, role: SERVER_ROLES.member }),
    // The invite code is what the rules check before allowing this write:
    // holding a valid link IS the authorisation to join.
    inviteCode: invite.code,
  });
  batch.update(serverRef(serverId), {
    memberIds: arrayUnion(profile.uid),
    memberCount: (server.memberCount || 1) + 1,
    updatedAt: serverTimestamp(),
  });

  // Add the joiner to every channel, so the inbox query finds them all.
  for (const channelId of channelIds) {
    batch.update(convRef(channelId), {
      memberIds: arrayUnion(profile.uid),
      [`members.${profile.uid}`]: {
        displayName: profile.displayName || 'Chazter user',
        username: profile.username || '',
        photoURL: profile.photoURL || '',
      },
      [`unreadCounts.${profile.uid}`]: 0,
      [`lastReadAt.${profile.uid}`]: serverTimestamp(),
    });
  }
  await batch.commit();

  updateDoc(inviteRef(invite.code), { uses: (invite.uses || 0) + 1 }).catch(() => {});
  return { serverId, channelId: channelIds[0] || null, alreadyMember: false };
}

async function joinGroupViaInvite(invite, profile) {
  const conversationRef = convRef(invite.targetId);
  const snap = await getDoc(conversationRef);
  if (!snap.exists()) throw new AppError('conversation-not-found', 'That group no longer exists.');
  const data = snap.data();
  if (data.memberIds?.includes(profile.uid)) {
    return { conversationId: invite.targetId, alreadyMember: true };
  }
  if ((data.memberIds?.length || 0) >= 64) {
    throw new AppError('group-full', 'That group is full.');
  }
  await updateDoc(conversationRef, {
    memberIds: arrayUnion(profile.uid),
    [`members.${profile.uid}`]: {
      displayName: profile.displayName || 'Chazter user',
      username: profile.username || '',
      photoURL: profile.photoURL || '',
      role: 'member',
      joinedAt: Date.now(),
    },
    [`unreadCounts.${profile.uid}`]: 0,
    [`lastReadAt.${profile.uid}`]: serverTimestamp(),
  });
  updateDoc(inviteRef(invite.code), { uses: (invite.uses || 0) + 1 }).catch(() => {});
  return { conversationId: invite.targetId, alreadyMember: false };
}

/** Leave a server: drop membership, and drop out of every channel. */
export async function leaveServer(serverId, uid) {
  const server = await getServer(serverId);
  if (!server) return;
  if (server.ownerId === uid) {
    throw new AppError('owner', 'Owners can’t leave their own server. Delete it instead.');
  }
  const channelIds = server.channelIds || [];
  const batch = writeBatch(db);
  batch.delete(memberRef(serverId, uid));
  batch.update(serverRef(serverId), {
    memberCount: Math.max(1, (server.memberCount || 2) - 1),
    updatedAt: serverTimestamp(),
  });
  for (const channelId of channelIds) {
    batch.update(convRef(channelId), { memberIds: arrayRemove(uid) });
  }
  await batch.commit();
}

/**
 * The shareable URL for an invite.
 *
 * The app uses BrowserRouter, so this must be a real path, not a hash route.
 * Deep links work because both deploy targets fall back to index.html:
 * GitHub Pages copies index.html to 404.html in CI, and Firebase Hosting has
 * a `**` rewrite.
 */
export function inviteUrl(code, origin = '') {
  const base = String(origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const path = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}${path}/join/${code}`;
}
