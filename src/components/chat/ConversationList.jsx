import { useMemo } from 'react';
import { ConversationRow } from './ConversationRow.jsx';

/**
 * Grouped conversation list.
 *
 * Splits into a "New & unread" section and the rest, matching how people scan
 * an inbox. Grouping is computed from the already-live snapshot — no extra
 * queries.
 */
export function ConversationList({ conversations, uid, activeId, onSelect }) {
  const { unread, rest } = useMemo(() => {
    const unreadRows = [];
    const restRows = [];
    for (const conversation of conversations) {
      if (conversation.unreadCount > 0) unreadRows.push(conversation);
      else restRows.push(conversation);
    }
    return { unread: unreadRows, rest: restRows };
  }, [conversations]);

  return (
    <ul className="conv-list">
      {unread.length > 0 && rest.length > 0 ? (
        <>
          <li className="conv-list__divider" aria-hidden="true">
            <span>New</span>
          </li>
          {unread.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              uid={uid}
              active={conversation.id === activeId}
              onSelect={onSelect}
            />
          ))}
          <li className="conv-list__divider" aria-hidden="true">
            <span>Earlier</span>
          </li>
          {rest.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              uid={uid}
              active={conversation.id === activeId}
              onSelect={onSelect}
            />
          ))}
        </>
      ) : (
        conversations.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            uid={uid}
            active={conversation.id === activeId}
            onSelect={onSelect}
          />
        ))
      )}
    </ul>
  );
}
