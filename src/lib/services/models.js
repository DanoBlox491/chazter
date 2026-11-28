/**
 * Chazter data model — the single source of truth for Firestore shapes.
 *
 * Collections
 * -----------
 * users/{uid}                     Public profile + presence
 * servers/{serverId}              Discord-style community (name, owner, icon)
 * servers/{id}/channels/{chanId}  A named room inside a server
 * servers/{id}/members/{uid}      Membership record (role: owner|admin|member)
 * invites/{code}                  No-expiry invite: server or group target
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
  servers: 'servers',
  serverChannels: 'channels',
  serverMembers: 'members',
  invites: 'invites',
  conversations: 'conversations',
  messages: 'messages',
  typing: 'typing',
  reads: 'reads',
};

export const CONVERSATION_TYPES = {
  private: 'private',
  group: 'group',
  // A server channel is a conversation document too — reusing the messaging
  // rules, unread accounting and read receipts rather than duplicating them.
  channel: 'channel',
};

/** Server roles, highest first. */
export const SERVER_ROLES = { owner: 'owner', admin: 'admin', member: 'member' };

export const SERVER_NAME_MAX = 48;
export const CHANNEL_NAME_MAX = 32;
export const CHANNEL_TOPIC_MAX = 160;
export const SERVER_MAX_CHANNELS = 50;

/** Kinds of invite: a whole server, or a single group chat. */
export const INVITE_TYPES = { server: 'server', group: 'group' };

/**
 * Invite codes are shown in a URL path, so the alphabet avoids characters
 * that get mangled by chat clients and link previews: no vowels (so no
 * accidental words), no 0/O, 1/I/L.
 */
const INVITE_ALPHABET = '23456789bcdfghjkmnpqrstvwxyz';

export function inviteCode(length = 10) {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let index = 0; index < length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join('');
}

/** A server document. `channels` is denormalised for instant sidebar render. */
export function buildServer({ ownerId, ownerProfile, name, channels }) {
  return {
    name: String(name).trim().slice(0, SERVER_NAME_MAX),
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // Ordered list of channel ids so the sidebar needs no second query.
    channelIds: channels.map((channel) => channel.id),
    memberCount: 1,
    iconURL: '',
    schemaVersion: 1,
    owner: {
      displayName: ownerProfile?.displayName || 'Chazter user',
      photoURL: ownerProfile?.photoURL || '',
    },
  };
}

/** A channel inside a server, stored as a channel-typed conversation. */
export function buildChannel({ serverId, name, topic = '', createdBy, creatorProfile, memberIds, memberProfiles }) {
  const ids = [...new Set(memberIds)];
  const members = {};
  for (const id of ids) {
    const profile = id === createdBy ? creatorProfile : memberProfiles?.[id];
    members[id] = {
      displayName: profile?.displayName || 'Chazter user',
      username: profile?.username || '',
      photoURL: profile?.photoURL || '',
    };
  }
  return {
    type: CONVERSATION_TYPES.channel,
    serverId,
    name: String(name).trim().slice(0, CHANNEL_NAME_MAX),
    topic: String(topic || '').trim().slice(0, CHANNEL_TOPIC_MAX),
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    memberIds: ids,
    members,
    admins: [],
    photoURL: '',
    lastMessage: null,
    lastMessageAt: null,
    typing: {},
    mutedBy: [],
    archivedBy: [],
    unreadCounts: Object.fromEntries(ids.map((id) => [id, 0])),
    schemaVersion: 1,
  };
}

/** Membership record: one small document per member, cheap to query by role. */
export function buildServerMember({ serverId, uid, profile, role = SERVER_ROLES.member }) {
  return {
    serverId,
    uid,
    role,
    joinedAt: serverTimestamp(),
    displayName: profile?.displayName || 'Chazter user',
    username: profile?.username || '',
    photoURL: profile?.photoURL || '',
  };
}

/**
 * An invite. `expiresAt: null` is the point of the feature — a link that is
 * still valid next month. It can always be revoked manually.
 */
export function buildInvite({ type, targetId, targetName, createdBy, createdByName }) {
  return {
    code: '',
    type,
    targetId,
    targetName: String(targetName || '').slice(0, SERVER_NAME_MAX),
    createdBy,
    createdByName: String(createdByName || '').slice(0, 60),
    createdAt: serverTimestamp(),
    expiresAt: null,
    uses: 0,
    revoked: false,
  };
}

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
