import { describe, expect, it } from 'vitest';
import { conversationDisplay, conversationPreview, partnerOnline } from '../lib/utils/conversationDisplay.js';
import { privateConversationId, buildPrivateConversation, buildGroupConversation, CONVERSATION_TYPES } from '../lib/services/models.js';
import { groupMessages } from '../lib/utils/messageGroups.js';
import { receiptsForMessage, deliveryState } from '../lib/utils/receipts.js';

const PRIVATE = {
  id: 'a__b',
  type: CONVERSATION_TYPES.private,
  memberIds: ['a', 'b'],
  members: {
    a: { displayName: 'Ada', username: 'ada', photoURL: '' },
    b: { displayName: 'Ravi', username: 'ravi', photoURL: 'https://x/r.png' },
  },
  presence: { b: { state: 'online', lastActiveAt: new Date() } },
  lastMessage: { text: 'Hello', senderId: 'b' },
};

describe('conversationDisplay', () => {
  it('shows the other person in a private chat', () => {
    const display = conversationDisplay(PRIVATE, 'a');
    expect(display.title).toBe('Ravi');
    expect(display.partner.uid).toBe('b');
    expect(display.isGroup).toBe(false);
  });

  it('shows the editor their counterpart, not themselves', () => {
    expect(conversationDisplay(PRIVATE, 'b').title).toBe('Ada');
  });

  it('shows group name and member count', () => {
    const group = {
      type: CONVERSATION_TYPES.group,
      name: 'Studio',
      memberIds: ['a', 'b', 'c'],
      members: {},
    };
    expect(conversationDisplay(group, 'a')).toMatchObject({ title: 'Studio', isGroup: true });
    expect(conversationDisplay(group, 'a').subtitle).toBe('3 members');
  });

  it('handles a missing conversation defensively', () => {
    expect(conversationDisplay(null, 'a').title).toBe('Conversation');
  });
});

describe('conversationPreview', () => {
  it('prefixes your own messages with "You:"', () => {
    expect(conversationPreview({ ...PRIVATE, lastMessage: { text: 'Hi', senderId: 'a' } }, 'a').text).toBe('You: Hi');
  });

  it('prefers typing state over the last message', () => {
    const preview = conversationPreview(PRIVATE, 'a', [{ name: 'Ravi' }]);
    expect(preview.typing).toBe(true);
    expect(preview.text).toMatch(/is typing/);
  });

  it('invites a first message when empty', () => {
    expect(conversationPreview({ ...PRIVATE, lastMessage: null }, 'a').text).toMatch(/say hello/);
  });
});

describe('partnerOnline', () => {
  it('reads presence from the conversation map', () => {
    expect(partnerOnline(PRIVATE, { uid: 'b' })).toBe(true);
    expect(partnerOnline(PRIVATE, { uid: 'zzz' })).toBe(false);
  });
});

describe('conversation ids and builders', () => {
  it('produces an order-independent private id (one chat per pair)', () => {
    expect(privateConversationId('b', 'a')).toBe(privateConversationId('a', 'b'));
    expect(privateConversationId('a', 'b')).toBe('a__b');
  });

  it('builds private conversations with zeroed unread counts', () => {
    const payload = buildPrivateConversation({ memberIds: ['a', 'b'], memberProfiles: PRIVATE.members });
    expect(payload.memberIds).toEqual(['a', 'b']);
    expect(payload.unreadCounts).toEqual({ a: 0, b: 0 });
    expect(payload.type).toBe('private');
  });

  it('builds groups with the creator as admin', () => {
    const payload = buildGroupConversation({
      creatorId: 'a',
      creatorProfile: { uid: 'a', displayName: 'Ada', username: 'ada' },
      name: 'Studio',
      memberIds: ['b', 'b'],
      memberProfiles: { b: { displayName: 'Ravi', username: 'ravi' } },
    });
    expect(payload.admins).toEqual(['a']);
    expect(payload.memberIds).toEqual(['a', 'b']); // deduped
    expect(payload.members.a.role).toBe('admin');
    expect(payload.members.b.role).toBe('member');
  });
});

describe('groupMessages', () => {
  const base = new Date('2026-11-28T10:00:00Z').getTime();
  const msg = (id, senderId, offsetMs, text = 'x') => ({
    id,
    senderId,
    text,
    createdAt: { toMillis: () => base + offsetMs },
  });

  it('starts with a day divider', () => {
    const entries = groupMessages([msg('1', 'a', 0)], 'a');
    expect(entries[0].kind).toBe('divider');
  });

  it('marks your own messages and groups consecutive ones', () => {
    const entries = groupMessages(
      [msg('1', 'a', 0), msg('2', 'a', 1000), msg('3', 'b', 2000)],
      'a',
    );
    const messages = entries.filter((entry) => entry.kind === 'message');
    expect(messages.map((entry) => entry.isOwn)).toEqual([true, true, false]);
    expect(messages[0].showAvatar).toBe(true);
    expect(messages[1].showAvatar).toBe(false); // grouped under the first
    expect(messages[2].showAvatar).toBe(true); // different sender
  });

  it('does not group messages more than four minutes apart', () => {
    const entries = groupMessages([msg('1', 'a', 0), msg('2', 'a', 5 * 60 * 1000)], 'a');
    const messages = entries.filter((entry) => entry.kind === 'message');
    expect(messages[1].showAvatar).toBe(true);
  });

  it('inserts a new divider when the day changes', () => {
    const entries = groupMessages(
      [msg('1', 'a', 0), msg('2', 'a', 24 * 60 * 60 * 1000)],
      'a',
    );
    expect(entries.filter((entry) => entry.kind === 'divider')).toHaveLength(2);
  });
});

describe('receipts', () => {
  it('counts everyone except the sender whose cursor passed the message', () => {
    const cursors = { sender: 900, reader: 1000, behind: 400 };
    expect(receiptsForMessage(cursors, 500, 'sender')).toEqual(['reader']);
  });

  it('treats cursor at exactly the message time as read', () => {
    expect(receiptsForMessage({ reader: 500 }, 500, 'sender')).toEqual(['reader']);
  });

  it('returns nothing when nobody else has read', () => {
    expect(receiptsForMessage({ sender: 900 }, 500, 'sender')).toEqual([]);
  });
});

describe('deliveryState', () => {
  it('reports pending, sent, some-read and all-read', () => {
    expect(deliveryState({ pending: true, readCount: 0, otherMemberCount: 1 })).toBe('pending');
    expect(deliveryState({ pending: false, readCount: 0, otherMemberCount: 1 })).toBe('sent');
    expect(deliveryState({ pending: false, readCount: 1, otherMemberCount: 2 })).toBe('read-some');
    expect(deliveryState({ pending: false, readCount: 2, otherMemberCount: 2 })).toBe('read-all');
  });
});
