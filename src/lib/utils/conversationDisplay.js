/**
 * Pure helpers for turning a conversation document into display values.
 * Kept out of components so they can be unit-tested and reused freely.
 */
import { isUserOnline } from '../services/presence.js';
import { CONVERSATION_TYPES } from '../services/models.js';

/**
 * Resolve what a row/header should show for a conversation.
 * Private chats surface the *other* person; groups surface the group.
 */
export function conversationDisplay(conversation, uid) {
  if (!conversation) return { title: 'Conversation', subtitle: '', partner: null, isGroup: false };
  const isGroup = conversation.type === CONVERSATION_TYPES.group;
  if (isGroup) {
    const memberCount = conversation.memberIds?.length || 0;
    return {
      title: conversation.name || 'Untitled group',
      subtitle: `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`,
      partner: null,
      isGroup: true,
    };
  }
  const partnerId = conversation.memberIds?.find((memberId) => memberId !== uid);
  const partner = partnerId ? { uid: partnerId, ...(conversation.members?.[partnerId] || {}) } : null;
  return {
    title: partner?.displayName || 'Chazter user',
    subtitle: partner?.username ? `@${partner.username}` : '',
    partner,
    isGroup: false,
  };
}

/** Is the private-chat partner currently online (per the presence heartbeat)? */
export function partnerOnline(conversation, partner) {
  if (!partner?.uid) return false;
  return isUserOnline({ presence: conversation?.presence?.[partner.uid] });
}

/** One-line preview used in the inbox. */
export function conversationPreview(conversation, uid, typingUsers = []) {
  if (typingUsers.length) {
    const names = typingUsers.map((entry) => entry.name || 'Someone');
    return {
      text: `${names.length === 1 ? names[0] : 'Several people'} ${names.length === 1 ? 'is' : 'are'} typing…`,
      typing: true,
    };
  }
  const last = conversation?.lastMessage;
  if (!last) return { text: 'No messages yet — say hello', typing: false };
  const prefix = last.senderId === uid ? 'You: ' : '';
  return { text: `${prefix}${last.text || ''}`, typing: false };
}
