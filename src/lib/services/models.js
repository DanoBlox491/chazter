/**
 * Chazter data model — the single source of truth for Firestore shapes.
 *
 * Collections
 * -----------
 * users/{uid}                     Public profile + presence
 * usernames/{usernameLower}       Uniqueness registry: { uid, username, createdAt }
 * conversations/{conversationId}  Chat metadata (private or group)
 * conversations/{id}/messages/{messageId}
 * conversations/{id}/typing/{uid} Presence-of-typing for one user
 * conversations/{id}/reads/{uid}  Per-member read cursor (for receipts)
 *
 * Denormalisation is intentional: the conversation document carries a tiny
 * `members` map plus `lastMessage` so the inbox renders from ONE query with
 * no per-conversation reads.
 */

import { serverTimestamp } from 'firebase/firestore';
import { normaliseUsername } from '../utils/validation.js';

export const COLLECTIONS = {
  users: 'users',
  usernames: 'usernames',
  conversations: 'conversations',
  messages: 'messages',
  typing: 'typing',
  reads: 'reads',
};

export const CONVERSATION_TYPES = {
  private: 'private',
  group: 'group',
};

/** Chat colours used for group avatars and accents (index into the palette). */
export const CHAT_COLORS = ['jade', 'coral', 'plum', 'amber', 'sky', 'clay'];

export const TYPING_TTL_MS = 6000;
export const PRESENCE_STALE_MS = 2 * 60 * 1000;

/** Firestore Timestamp sentinel for "when the server receives this". */
export { serverTimestamp };

/** Shape of a users/{uid} document. */
export function buildUserProfile({
  uid,
  username,
  displayName,
  email = '',
  photoURL = '',
  bio = '',
  provider = 'password',
}) {
  const usernameLower = normaliseUsername(username);
  return {
    uid,
    username: String(username).trim(),
    usernameLower,
    displayName: String(displayName).trim(),
    // Lowercased copy used for prefix search (`orderBy('displayNameLower')`).
    // Without it every people-search query silently returns nothing, because
    // Firestore cannot order by a field the document never wrote.
    displayNameLower: String(displayName || '').trim().toLowerCase(),
    email: String(email || '').toLowerCase(),
    photoURL: photoURL || '',
    bio: String(bio || '').trim(),
    provider,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    onboardingComplete: true,
    presence: {
      state: 'online',
      lastActiveAt: serverTimestamp(),
    },
    lastReadAt: serverTimestamp(),
    settings: {
      theme: 'system',
      notifications: true,
    },
  };
}

/** Shape of a private conversation. */
export function buildPrivateConversation({ memberIds, memberProfiles }) {
  const members = {};
  for (const id of memberIds) {
    const profile = memberProfiles?.[id];
    members[id] = {
      displayName: profile?.displayName || 'Chazter user',
      username: profile?.username || '',
      photoURL: profile?.photoURL || '',
    };
  }
  return {
    type: CONVERSATION_TYPES.private,
    createdBy: memberIds[0],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    memberIds: [...memberIds],
    members,
    admins: [...memberIds],
    name: '',
    photoURL: '',
    lastMessage: null,
    lastMessageAt: null,
    typing: {},
    mutedBy: [],
    archivedBy: [],
    unreadCounts: Object.fromEntries(memberIds.map((id) => [id, 0])),
    schemaVersion: 1,
  };
}

/** Shape of a group conversation. */
export function buildGroupConversation({ creatorId, creatorProfile, name, memberIds, memberProfiles }) {
  const ids = [...new Set([creatorId, ...memberIds])];
  const members = {};
  for (const id of ids) {
    const profile = id === creatorId ? creatorProfile : memberProfiles?.[id];
    members[id] = {
      displayName: profile?.displayName || 'Chazter user',
      username: profile?.username || '',
      photoURL: profile?.photoURL || '',
      role: id === creatorId ? 'admin' : 'member',
      joinedAt: Date.now(),
    };
  }
  return {
    type: CONVERSATION_TYPES.group,
    name: String(name).trim(),
    createdBy: creatorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    memberIds: ids,
    members,
    admins: [creatorId],
    photoURL: '',
    color: CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)],
    lastMessage: null,
    lastMessageAt: null,
    typing: {},
    mutedBy: [],
    archivedBy: [],
    unreadCounts: Object.fromEntries(ids.map((id) => [id, 0])),
    schemaVersion: 1,
  };
}

/**
 * Deterministic id for a private chat between two people.
 * Keeps "one conversation per pair" without an extra query.
 */
export function privateConversationId(uidA, uidB) {
  return [uidA, uidB].sort().join('__');
}

/** A cursor map describing who has read a message: { uid: timestampMillis }. */
export function buildReadReceipt(uid, timestamp = Date.now()) {
  return { [uid]: timestamp };
}
