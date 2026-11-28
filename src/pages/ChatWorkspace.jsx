import { Suspense, lazy, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MessageCirclePlus, Search, Sparkles } from 'lucide-react';
import { ConversationList } from '../components/chat/ConversationList.jsx';
import { NewChatModal } from '../components/chat/NewChatModal.jsx';
import { EmptyState, ListSkeleton, ErrorState } from '../components/ui/States.jsx';
import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkspace } from '../context/NewChatContext.jsx';
import { cx } from '../lib/utils/general.js';
import { conversationErrorCopy } from '../lib/utils/conversationError.js';

const ChatWindow = lazy(() => import('../components/chat/ChatWindow.jsx'));
const PeopleDirectory = lazy(() => import('../components/people/PeopleDirectory.jsx'));

/**
 * ChatWorkspace — inbox + right-hand pane.
 *
 *   /app              inbox, with a welcome pane on the right (desktop)
 *   /app/c/:id        inbox + selected conversation
 *   /app/people       inbox + people directory
 *
 * Desktop shows both panes; mobile shows exactly one, chosen by the URL.
 */
export function ChatWorkspace() {
  const { uid } = useAuth();
  const { conversations, loading, error, openComposer, composerOpen, newChatMode, closeComposer, openPalette } =
    useWorkspace();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const isPeopleRoute = location.pathname.endsWith('/people');
  const isPaneOpen = Boolean(conversationId) || isPeopleRoute;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (filter === 'unread' && !(conversation.unreadCount > 0)) return false;
      if (filter === 'groups' && conversation.type !== 'group') return false;
      if (!needle) return true;
      const haystack = [
        conversation.name,
        conversation.lastMessage?.text,
        ...Object.values(conversation.members || {}).flatMap((member) => [
          member.displayName,
          member.username,
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [conversations, filter, query]);

  const selected = conversations.find((conversation) => conversation.id === conversationId) || null;

  return (
    <>
      <div className="workspace">
        <div className={cx('workspace__inbox', isPaneOpen && 'is-hidden-mobile')}>
          <section className="inbox" aria-label="Conversations">
            <header className="inbox__header">
              <div className="inbox__title-row">
                <h1 className="inbox__title">Chats</h1>
                <div className="inbox__title-actions">
                  <kbd
                    className="inbox__kbd"
                    role="button"
                    tabIndex={0}
                    onClick={openPalette}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openPalette();
                      }
                    }}
                    aria-label="Open quick search"
                    title="Quick search (Ctrl/⌘ K)"
                  >
                    ⌘K
                  </kbd>
                  <Button
                    variant="solid"
                    size="sm"
                    icon={MessageCirclePlus}
                    onClick={() => openComposer('direct')}
                  >
                    New
                  </Button>
                </div>
              </div>

              <div className="inbox__search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search conversations"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search conversations"
                />
              </div>

              <div className="inbox__filters" role="tablist" aria-label="Filter conversations">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'unread', label: 'Unread' },
                  { id: 'groups', label: 'Groups' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    aria-selected={filter === tab.id}
                    className={filter === tab.id ? 'is-active' : ''}
                    onClick={() => setFilter(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </header>

            <div className="inbox__scroll">
              {loading ? (
                <ListSkeleton rows={7} />
              ) : error ? (
                /*
                 * A denied read and a network failure need different words and
                 * different actions. `permission-denied` means the server
                 * rejected the query (rules not deployed, or a stale session) —
                 * telling the user to "check your connection" is misleading and
                 * retrying can never work. Everything else is treated as
                 * transient, which the live listener genuinely recovers from.
                 */
                <ErrorState
                  {...conversationErrorCopy(error)}
                  detail={error?.code || undefined}
                  onRetry={() => window.location.reload()}
                  retryLabel={error?.code === 'permission-denied' ? 'Reload Chazter' : 'Try again'}
                />
              ) : conversations.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="Your inbox is a fresh page"
                  description="Start a conversation with a friend, or create a small group for the people you talk to most."
                  action={
                    <div className="inbox__empty-actions">
                      <Button
                        variant="solid"
                        size="sm"
                        icon={MessageCirclePlus}
                        onClick={() => openComposer('direct')}
                      >
                        New conversation
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openComposer('group')}>
                        Create a group
                      </Button>
                    </div>
                  }
                />
              ) : filtered.length === 0 ? (
                <EmptyState
                  compact
                  icon={Search}
                  title={filter === 'unread' ? 'All caught up' : 'No matches'}
                  description={
                    filter === 'unread'
                      ? 'You’ve read everything. Enjoy the quiet.'
                      : 'Try a different name or keyword.'
                  }
                />
              ) : (
                <ConversationList
                  conversations={filtered}
                  uid={uid}
                  activeId={conversationId}
                  onSelect={(id) => navigate(`/app/c/${id}`)}
                />
              )}
            </div>
          </section>
        </div>

        <div className={cx('workspace__pane', !isPaneOpen && 'is-hidden-mobile')}>
          {isPeopleRoute ? (
            <Suspense fallback={<div className="pane-loading" />}>
              <PeopleDirectory onStartChat={(id) => navigate(`/app/c/${id}`)} />
            </Suspense>
          ) : conversationId ? (
            <Suspense fallback={<div className="pane-loading" />}>
              <ChatWindow
                key={conversationId}
                conversationId={conversationId}
                conversation={selected}
                onBack={() => navigate('/app')}
              />
            </Suspense>
          ) : (
            <WelcomePane onNew={() => openComposer('direct')} />
          )}
        </div>
      </div>

      <NewChatModal open={composerOpen} onClose={closeComposer} initialMode={newChatMode} />
    </>
  );
}

function WelcomePane({ onNew }) {
  return (
    <div className="welcome-pane">
      <div className="welcome-pane__art" aria-hidden="true">
        <span className="welcome-pane__ring" />
        <span className="welcome-pane__ring welcome-pane__ring--2" />
        <span className="welcome-pane__spark" />
        <span className="welcome-pane__chip welcome-pane__chip--1">“Booked it.”</span>
        <span className="welcome-pane__chip welcome-pane__chip--2">“See you at nine”</span>
        <span className="welcome-pane__chip welcome-pane__chip--3">“Read · 10:04”</span>
      </div>
      <h2 className="welcome-pane__title display">
        Pick a chat, or <em>start one</em>.
      </h2>
      <p className="welcome-pane__lede">
        Your conversations live on the left. Choose one to continue, or begin something new.
      </p>
      <div className="welcome-pane__actions">
        <Button variant="solid" icon={MessageCirclePlus} onClick={onNew}>
          New conversation
        </Button>
      </div>
    </div>
  );
}
