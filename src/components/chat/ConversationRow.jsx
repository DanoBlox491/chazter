import { memo } from 'react';
import { BellOff, CheckCheck } from 'lucide-react';
import { Avatar, GroupAvatar } from '../ui/Avatar.jsx';
import { Badge } from '../ui/Misc.jsx';
import { cx } from '../../lib/utils/general.js';
import { formatListStamp } from '../../lib/utils/time.js';
import { conversationDisplay, conversationPreview, partnerOnline } from '../../lib/utils/conversationDisplay.js';

/** One row in the inbox. Memoised: the list re-renders on every message. */
export const ConversationRow = memo(function ConversationRow({ conversation, uid, active, onSelect }) {
  const { title, partner, isGroup } = conversationDisplay(conversation, uid);
  const unread = conversation.unreadCount || 0;
  const typing = conversation.typingUsers || [];
  const last = conversation.lastMessage;
  const isOwnLast = last?.senderId === uid;
  const { text: preview, typing: isTyping } = conversationPreview(conversation, uid, typing);
  // Prefer the dedicated sort timestamp; fall back to the embedded preview time
  // so older documents (written before lastMessageAt existed) still show one.
  const lastStamp = conversation.lastMessageAt || last?.createdAt || conversation.updatedAt;
  const online = partnerOnline(conversation, partner);

  return (
    <li>
      <button
        type="button"
        className={cx('conv-row', active && 'is-active', unread > 0 && 'has-unread')}
        onClick={() => onSelect?.(conversation.id)}
        aria-current={active ? 'true' : undefined}
      >
        <span className="conv-row__avatar">
          {isGroup ? (
            <GroupAvatar conversation={conversation} size={46} />
          ) : (
            <Avatar
              src={partner?.photoURL}
              name={title}
              userId={partner?.uid}
              size={46}
              showStatus={Boolean(partner)}
              online={online}
            />
          )}
        </span>

        <span className="conv-row__body">
          <span className="conv-row__top">
            <span className="conv-row__name truncate">{title}</span>
            {lastStamp ? (
              <span className={cx('conv-row__time', unread > 0 && 'is-unread')}>
                {formatListStamp(lastStamp)}
              </span>
            ) : null}
          </span>
          <span className="conv-row__bottom">
            <span className={cx('conv-row__preview truncate', isTyping && 'is-typing')}>
              {isOwnLast && !isTyping && last ? (
                <CheckCheck size={13} className="conv-row__tick" aria-hidden="true" />
              ) : null}
              {preview}
            </span>
            <span className="conv-row__meta">
              {conversation.muted ? <BellOff size={13} aria-label="Muted" /> : null}
              <Badge count={unread} muted={conversation.muted} />
            </span>
          </span>
        </span>
      </button>
    </li>
  );
});
