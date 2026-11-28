/**
 * A tiny, versioned snapshot of the inbox kept in localStorage.
 *
 * Purpose: "Launch acceleration". On a cold start the app normally shows an
 * empty skeleton until Firestore's first snapshot arrives — one network round
 * trip of blankness. With a cached snapshot, the last known conversation list
 * paints on the very first frame and is then reconciled (or replaced) when the
 * live listener reports in.
 *
 * Deliberate limits:
 *  - it is a *display* cache only; nothing here is ever written back
 *  - it is capped (both count and age) so stale data can't linger
 *  - every failure path returns null; a cache must never break the app
 */

const KEY = 'chazter:inbox-cache';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CONVERSATIONS = 60;

/** Only the fields the list UI needs — keeps the snapshot small. */
function strip(conversation) {
  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name || '',
    photoURL: conversation.photoURL || '',
    color: conversation.color || '',
    memberIds: conversation.memberIds || [],
    members: conversation.members || {},
    lastMessage: conversation.lastMessage || null,
    lastMessageAt: conversation.lastMessageAt || null,
    unreadCount: conversation.unreadCount || 0,
    muted: Boolean(conversation.muted),
    archived: Boolean(conversation.archived),
    isAdmin: Boolean(conversation.isAdmin),
    lastActivityMs: conversation.lastActivityMs || 0,
  };
}

export function saveInboxCache(uid, conversations) {
  if (!uid || !Array.isArray(conversations)) return;
  try {
    const payload = {
      uid,
      savedAt: Date.now(),
      conversations: conversations.slice(0, MAX_CONVERSATIONS).map(strip),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* quota exceeded or private mode — the cache is optional */
  }
}

export function readInboxCache(uid, { now = Date.now() } = {}) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.uid !== uid) return null;
    if (!Array.isArray(parsed.conversations)) return null;
    if (!parsed.savedAt || now - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed.conversations;
  } catch {
    return null;
  }
}

export function clearInboxCache() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
