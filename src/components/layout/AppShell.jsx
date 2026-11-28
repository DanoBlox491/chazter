import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NavRail } from './NavRail.jsx';
import { CommandPalette } from '../chat/CommandPalette.jsx';
import { useConversations } from '../../hooks/useConversations.js';
import { useMediaQuery } from '../../hooks/useMisc.js';
import { MessageSkeleton } from '../ui/States.jsx';
import { NewChatContext } from '../../context/NewChatContext.jsx';

/**
 * AppShell — the persistent frame around the workspace.
 *
 * Desktop: a slim navigation rail beside the routed surface.
 * Mobile: the rail becomes a bottom bar, and the routed surface renders as a
 * full-height view. Conversations are fetched once here and shared with
 * children via context so navigating never re-subscribes.
 */
export function AppShell() {
  const location = useLocation();
  const { conversations, loading, error, totalUnread, unreadConversations, getById } = useConversations();
  const isDesktop = useMediaQuery('(min-width: 900px)');
  const [composerOpen, setComposerOpen] = useState(false);
  const [newChatMode, setNewChatMode] = useState('direct');
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Cmd/Ctrl+K opens the command palette from anywhere in the app.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Scroll to the top of a new route on mobile (chat pane manages itself).
  useEffect(() => {
    if (!isDesktop) window.scrollTo({ top: 0 });
  }, [location.pathname, isDesktop]);

  const openComposer = (mode = 'direct') => {
    setNewChatMode(mode);
    setComposerOpen(true);
  };

  return (
    <NewChatContext.Provider
      value={{
        conversations,
        loading,
        error,
        totalUnread,
        unreadConversations,
        getById,
        openComposer,
        composerOpen,
        newChatMode,
        closeComposer: () => setComposerOpen(false),
        openPalette: () => setPaletteOpen(true),
      }}
    >
      <div className="app-shell">
        <div className="ambient" aria-hidden="true" />
        <a className="skip-link" href="#workspace">
          Skip to conversations
        </a>
        <NavRail />
        <div className="app-shell__surface" id="workspace">
          <Suspense fallback={<div className="app-shell__fallback"><MessageSkeleton /></div>}>
            <Outlet />
          </Suspense>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </NewChatContext.Provider>
  );
}
