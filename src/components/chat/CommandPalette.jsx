import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, MessageSquare, Search, UserRound } from 'lucide-react';
import { Avatar, GroupAvatar } from '../ui/Avatar.jsx';
import { Spinner } from '../ui/States.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkspace } from '../../context/NewChatContext.jsx';
import { useDebouncedValue } from '../../hooks/useMisc.js';
import { searchUsers } from '../../lib/services/userService.js';
import { searchMessages } from '../../lib/services/conversationService.js';
import { conversationDisplay } from '../../lib/utils/conversationDisplay.js';
import { cx, truncate } from '../../lib/utils/general.js';
import { formatDayLabel } from '../../lib/utils/time.js';

/**
 * Command palette — Cmd/Ctrl+K.
 *
 * One search box across three sources:
 *   1. your conversations (instant, client-side)
 *   2. people on Chazter (prefix query)
 *   3. message text inside your recent conversations (bounded scan)
 *
 * Fully keyboard driven: ↑/↓ to move, Enter to open, Esc to close.
 */
export function CommandPalette({ open, onClose }) {
  const { uid } = useAuth();
  const { conversations } = useWorkspace();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const [people, setPeople] = useState([]);
  const [messages, setMessages] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounced = useDebouncedValue(term, 260);

  useEffect(() => {
    if (open) {
      setTerm('');
      setActive(0);
      setPeople([]);
      setMessages([]);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // People + message search (debounced).
  useEffect(() => {
    let cancelled = false;
    if (!open || debounced.trim().length < 2) {
      setPeople([]);
      setMessages([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const needle = debounced.trim();
    Promise.all([
      searchUsers(needle, { excludeUid: uid, max: 5 }).catch(() => []),
      Promise.all(
        conversations.slice(0, 6).map(async (conversation) => {
          const hits = await searchMessages(conversation.id, needle, { max: 60 }).catch(() => []);
          return hits.slice(0, 3).map((hit) => ({ ...hit, conversation }));
        }),
      )
        .then((groups) => groups.flat())
        .catch(() => []),
    ])
      .then(([foundPeople, foundMessages]) => {
        if (cancelled) return;
        setPeople(foundPeople);
        setMessages(foundMessages.slice(0, 6));
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open, uid, conversations]);

  const matchedConversations = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return conversations.slice(0, 5);
    return conversations
      .filter((conversation) => {
        const display = conversationDisplay(conversation, uid);
        return (
          display.title.toLowerCase().includes(needle) ||
          conversation.lastMessage?.text?.toLowerCase().includes(needle)
        );
      })
      .slice(0, 5);
  }, [conversations, term, uid]);

  // Flatten into one keyboard-navigable list.
  const items = useMemo(() => {
    const rows = [];
    matchedConversations.forEach((conversation) => {
      const display = conversationDisplay(conversation, uid);
      rows.push({
        type: 'conversation',
        key: `c-${conversation.id}`,
        title: display.title,
        subtitle: conversation.lastMessage?.text || 'Open conversation',
        conversation,
        display,
        action: () => navigate(`/app/c/${conversation.id}`),
      });
    });
    people.forEach((profile) => {
      rows.push({
        type: 'person',
        key: `p-${profile.uid}`,
        title: profile.displayName,
        subtitle: `@${profile.username}`,
        profile,
        action: () => navigate(`/app/u/${profile.username}`),
      });
    });
    messages.forEach((message) => {
      const display = conversationDisplay(message.conversation, uid);
      rows.push({
        type: 'message',
        key: `m-${message.conversation.id}-${message.id}`,
        title: `${display.title} · ${message.senderName}`,
        subtitle: truncate(message.text || 'Photo', 70),
        meta: formatDayLabel(message.createdAt),
        action: () => navigate(`/app/c/${message.conversation.id}`),
      });
    });
    return rows;
  }, [matchedConversations, people, messages, navigate, uid]);

  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((current) => (current + 1) % Math.max(1, items.length));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((current) => (current - 1 + items.length) % Math.max(1, items.length));
      }
      if (event.key === 'Enter' && items[active]) {
        event.preventDefault();
        items[active].action();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, items, active, onClose]);

  // Group boundaries for section labels.
  let lastType = null;

  if (!open) return null;

  return createPortal(
    <div className="palette" role="dialog" aria-modal="true" aria-label="Search Chazter" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette__scrim" aria-hidden="true" />
      <div className="palette__panel">
        <div className="palette__input-row">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search chats, people and messages…"
            aria-label="Search"
            aria-controls="palette-results"
            aria-activedescendant={items[active] ? `palette-item-${active}` : undefined}
          />
          {searching ? <Spinner size={16} /> : <kbd>esc</kbd>}
        </div>

        <div className="palette__results" id="palette-results" role="listbox">
          {items.length === 0 ? (
            <p className="palette__empty">
              {term.trim().length < 2
                ? 'Type to search across your chats, people and messages.'
                : 'Nothing matched. Try another word.'}
            </p>
          ) : (
            items.map((item, index) => {
              const showLabel = item.type !== lastType;
              lastType = item.type;
              return (
                <div key={item.key}>
                  {showLabel ? (
                    <p className="palette__label">
                      {item.type === 'conversation' ? 'Conversations' : item.type === 'person' ? 'People' : 'Messages'}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    id={`palette-item-${index}`}
                    role="option"
                    aria-selected={index === active}
                    className={cx('palette__item', index === active && 'is-active')}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                  >
                    <span className="palette__icon">
                      {item.type === 'conversation' ? (
                        item.conversation.type === 'group' ? (
                          <GroupAvatar conversation={item.conversation} size={32} />
                        ) : (
                          <Avatar
                            src={item.display.partner?.photoURL}
                            name={item.display.title}
                            userId={item.display.partner?.uid}
                            size={32}
                          />
                        )
                      ) : item.type === 'person' ? (
                        <Avatar
                          src={item.profile.photoURL}
                          name={item.profile.displayName}
                          userId={item.profile.uid}
                          size={32}
                        />
                      ) : (
                        <span className="palette__msg-icon" aria-hidden="true">
                          <MessageSquare size={15} />
                        </span>
                      )}
                    </span>
                    <span className="palette__text">
                      <span className="palette__title truncate">{item.title}</span>
                      <span className="palette__subtitle truncate">{item.subtitle}</span>
                    </span>
                    {item.type === 'person' ? <UserRound size={14} className="palette__type-icon" aria-hidden="true" /> : null}
                    {index === active ? <CornerDownLeft size={14} className="palette__enter" aria-hidden="true" /> : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="palette__footer">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> to navigate
          </span>
          <span>
            <kbd>↵</kbd> to open
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
