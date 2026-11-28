import { describe, expect, it, beforeEach } from 'vitest';
import { readInboxCache, saveInboxCache, clearInboxCache } from '../lib/utils/inboxCache.js';

const conversation = {
  id: 'a__b',
  type: 'private',
  name: '',
  memberIds: ['a', 'b'],
  members: { a: { displayName: 'Ada' }, b: { displayName: 'Bo' } },
  lastMessage: { text: 'hello' },
  lastActivityMs: 1700000000000,
  unreadCount: 3,
  // Fields the list does not need; must not be persisted.
  messages: [{ secret: 'not needed' }],
  typing: { a: { displayName: 'Ada' } },
};

describe('inbox cache (launch acceleration)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips the conversations needed to paint the list', () => {
    saveInboxCache('user-1', [conversation]);
    const restored = readInboxCache('user-1');

    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      id: 'a__b',
      lastMessage: { text: 'hello' },
      unreadCount: 3,
      lastActivityMs: 1700000000000,
    });
  });

  it('does not persist message bodies — this is a display cache', () => {
    saveInboxCache('user-1', [conversation]);
    const raw = localStorage.getItem('chazter:inbox-cache');
    expect(raw).not.toContain('not needed');
    expect(readInboxCache('user-1')[0].messages).toBeUndefined();
    expect(readInboxCache('user-1')[0].typing).toBeUndefined();
  });

  it('refuses to hand another account’s cache to a new user', () => {
    saveInboxCache('user-1', [conversation]);
    expect(readInboxCache('user-2')).toBeNull();
  });

  it('discards a snapshot older than the limit instead of showing stale chats', () => {
    saveInboxCache('user-1', [conversation]);
    const eightDaysFromNow = Date.now() + 8 * 24 * 60 * 60 * 1000;
    expect(readInboxCache('user-1', { now: eightDaysFromNow })).toBeNull();
  });

  it('returns null rather than throwing on corrupt storage', () => {
    localStorage.setItem('chazter:inbox-cache', '{{{{');
    expect(readInboxCache('user-1')).toBeNull();
    localStorage.setItem('chazter:inbox-cache', JSON.stringify({ uid: 'user-1' }));
    expect(readInboxCache('user-1')).toBeNull();
  });

  it('caps how many conversations it stores', () => {
    const many = Array.from({ length: 120 }, (_, index) => ({ ...conversation, id: `c${index}` }));
    saveInboxCache('user-1', many);
    expect(readInboxCache('user-1')).toHaveLength(60);
  });

  it('clears on sign-out', () => {
    saveInboxCache('user-1', [conversation]);
    clearInboxCache();
    expect(readInboxCache('user-1')).toBeNull();
  });

  it('ignores a missing or invalid uid', () => {
    expect(() => saveInboxCache(null, [conversation])).not.toThrow();
    expect(readInboxCache(undefined)).toBeNull();
  });
});
