/**
 * Pure message-document construction.
 *
 * Lives outside the Firestore service so it can be unit-tested and so the
 * exact document shape (which the security rules validate field by field) is
 * defined in one readable place.
 */
import { MESSAGE_MAX } from './validation.js';

export class MessageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MessageValidationError';
  }
}

/** Preview text for the inbox row (mirrors what the chat bubble shows). */
export function previewFor(document) {
  if (document?.type === 'image') return document.text ? `📷 ${document.text}` : '📷 Photo';
  return document?.text || '';
}

/**
 * Build the document written for a new message.
 *
 * IMPORTANT: this must not include `deletedAt`, `deletedBy` or `editedAt` —
 * the rules treat their presence at creation time as a forgery attempt.
 */
export function buildMessageDocument({ sender, text, image, replyTo }) {
  const trimmed = String(text || '').trim();
  if (!trimmed && !image) throw new MessageValidationError('Write something before sending.');
  if (trimmed.length > MESSAGE_MAX) {
    throw new MessageValidationError(`Messages can be up to ${MESSAGE_MAX} characters.`);
  }
  return {
    type: image ? 'image' : 'text',
    text: trimmed.slice(0, MESSAGE_MAX),
    image: image
      ? {
          url: image.url,
          storagePath: image.storagePath || '',
          width: image.width || 0,
          height: image.height || 0,
          bytes: image.bytes || 0,
        }
      : null,
    senderId: sender.uid,
    senderName: sender.displayName || '',
    senderUsername: sender.username || '',
    senderPhotoURL: sender.photoURL || '',
    replyTo: replyTo
      ? {
          messageId: replyTo.messageId,
          senderName: replyTo.senderName,
          text: (replyTo.text || '').slice(0, 140),
          type: replyTo.type || 'text',
        }
      : null,
    createdAt: { __serverTimestamp: true },
    clientCreatedAt: Date.now(),
    reactions: {},
  };
}
