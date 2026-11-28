import { memo, useState } from 'react';
import { Check, CheckCheck, Clock, MoreHorizontal, Trash2 } from 'lucide-react';
import { Avatar } from '../ui/Avatar.jsx';
import { cx, truncate } from '../../lib/utils/general.js';
import { formatTime, toMillis } from '../../lib/utils/time.js';
import { receiptsForMessage, deliveryState } from '../../lib/utils/receipts.js';

/**
 * A single message bubble.
 *
 * Delivery states, from the sender's perspective:
 *   sending   → local optimistic copy, clock icon
 *   sent      → server acknowledged (single tick)
 *   read      → at least one other member's cursor has passed it (double tick)
 *
 * Image messages render a capped, aspect-ratio-stable thumbnail that opens a
 * lightbox (handled by the parent via onOpenImage).
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  showAvatar,
  showSender,
  groupSize,
  cursors,
  conversationType,
  onDelete,
  onOpenImage,
  onJumpTo,
  isHighlighted,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const createdMs = toMillis(message.createdAt) || message.clientCreatedAt || 0;
  const deleted = Boolean(message.deletedAt);
  const pending = message.pending;

  const readBy = isOwn && !pending ? receiptsForMessage(cursors, createdMs, message.senderId) : [];
  const otherMemberCount = Math.max(0, (groupSize || 2) - 1);
  const state = deliveryState({ pending, readCount: readBy.length, otherMemberCount });
  const allRead = state === 'read-all';
  const someRead = state === 'read-some' || allRead;

  const isImage = message.type === 'image' && message.image?.url && !deleted;

  return (
    <div
      className={cx(
        'msg',
        isOwn ? 'msg--out' : 'msg--in',
        showAvatar && 'msg--with-avatar',
        deleted && 'msg--deleted',
        isHighlighted && 'is-highlighted',
      )}
      data-created={createdMs}
    >
      {!isOwn && conversationType === 'group' ? (
        <span className="msg__avatar-slot">
          {showAvatar ? (
            <Avatar
              src={message.senderPhotoURL}
              name={message.senderName}
              userId={message.senderId}
              size={30}
            />
          ) : null}
        </span>
      ) : null}

      <div className="msg__content">
        {showSender && !isOwn && conversationType === 'group' && !deleted ? (
          <p className="msg__sender">{message.senderName}</p>
        ) : null}

        <div className="msg__bubble-wrap">
          <div className={cx('msg__bubble', isImage && 'msg__bubble--image')}>
            {message.replyTo && !deleted ? (
              <button
                type="button"
                className="msg__reply-quote"
                onClick={() => onJumpTo?.(message.replyTo.messageId)}
              >
                <span>{message.replyTo.senderName}</span>
                {truncate(message.replyTo.text || 'Photo', 90)}
              </button>
            ) : null}

            {deleted ? (
              <p className="msg__text msg__text--deleted">
                {message.deletedBy === message.senderId ? 'This message was deleted' : 'Message removed'}
              </p>
            ) : isImage ? (
              <button
                type="button"
                className="msg__image-btn"
                onClick={() => onOpenImage?.(message)}
                aria-label="Open photo"
              >
                <img
                  className="msg__image"
                  src={message.image.url}
                  alt={message.text || 'Shared photo'}
                  loading="lazy"
                  decoding="async"
                  style={
                    message.image.width && message.image.height
                      ? { aspectRatio: `${message.image.width} / ${message.image.height}` }
                      : undefined
                  }
                />
              </button>
            ) : null}

            {message.text && !deleted ? <p className="msg__text">{message.text}</p> : null}

            <span className="msg__meta">
              <span className="msg__time">{formatTime(message.createdAt) || formatTime(message.clientCreatedAt)}</span>
              {isOwn ? (
                <span
                  className={cx(
                    'msg__ticks',
                    pending && 'is-pending',
                    someRead && !pending && 'is-read',
                    allRead && 'is-all-read',
                  )}
                  title={
                    pending
                      ? 'Sending…'
                      : allRead
                        ? 'Read by everyone'
                        : someRead
                          ? `Read by ${readBy.length}`
                          : 'Sent'
                  }
                  aria-label={
                    pending ? 'Sending' : allRead ? 'Read' : someRead ? 'Read by some' : 'Sent'
                  }
                >
                  {pending ? <Clock size={12} /> : allRead || someRead ? <CheckCheck size={13} /> : <Check size={13} />}
                </span>
              ) : null}
            </span>
          </div>

          {isOwn && !deleted && !pending ? (
            <div className="msg__actions">
              <button
                type="button"
                className="msg__action-btn"
                onClick={() => setMenuOpen((current) => !current)}
                aria-label="Message options"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={15} />
              </button>
              {menuOpen ? (
                <div className="msg__menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="msg__menu-item msg__menu-item--danger"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete?.(message);
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" /> Delete message
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {isOwn && allRead ? <p className="msg__read-label">Read</p> : null}
      </div>
    </div>
  );
});

/** Day divider between message groups. */
export function DayDivider({ label }) {
  return (
    <div className="day-divider" role="separator">
      <span>{label}</span>
    </div>
  );
}

/** Animated three-dot typing bubble. */
export function TypingBubble({ names }) {
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names.length} people are typing`;
  return (
    <div className="typing-row" aria-live="polite">
      <div className="typing-bubble" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <span className="typing-row__label">{label}…</span>
    </div>
  );
}
