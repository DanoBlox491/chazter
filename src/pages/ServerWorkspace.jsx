import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Compass, Plus, X } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { AppLoading, ErrorState, EmptyState } from '../components/ui/States.jsx';
import { ServerSidebar } from '../components/servers/ServerSidebar.jsx';
import { ChannelView } from '../components/servers/ChannelView.jsx';
import { CreateServerDialog } from '../components/servers/CreateServerDialog.jsx';
import { useServers } from '../hooks/useServers.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useMediaQuery } from '../hooks/useMisc.js';
import { getServer, getServerMembership, subscribeChannels } from '../lib/services/serverService.js';
import { conversationErrorCopy } from '../lib/utils/conversationError.js';
import { cx } from '../lib/utils/general.js';

/**
 * ServerWorkspace — the shell for /app/s/*.
 *
 * Layout: server rail (all servers) → channel sidebar → channel content.
 * On mobile the sidebars become sheets that slide in from the left.
 */
export default function ServerWorkspace() {
  const { serverId, channelId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 900px)');
  const { servers, loading: serversLoading, error: serversError } = useServers();
  const [server, setServer] = useState(null);
  const [role, setRole] = useState(null);
  const [serverLoading, setServerLoading] = useState(Boolean(serverId));
  const [serverError, setServerError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [channels, setChannels] = useState([]);

  // Load the server + the caller's membership record.
  useEffect(() => {
    let cancelled = false;
    if (!serverId || !user) {
      setServerLoading(false);
      return undefined;
    }
    setServerLoading(true);
    setServerError(null);
    Promise.all([getServer(serverId), getServerMembership(serverId, user.uid)])
      .then(([foundServer, membership]) => {
        if (cancelled) return;
        if (!foundServer) {
          setServerError({ code: 'not-found' });
          return;
        }
        if (!membership) {
          setServerError({ code: 'not-a-member' });
          return;
        }
        setServer(foundServer);
        setRole(membership.role);
      })
      .catch((loadError) => {
        if (!cancelled) setServerError(loadError);
      })
      .finally(() => {
        if (!cancelled) setServerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId, user]);

  // Live channel list: the header needs the channel's name and topic, and
  // "open the first channel" needs a real id rather than a guess.
  useEffect(() => {
    if (!serverId) {
      setChannels([]);
      return undefined;
    }
    return subscribeChannels(
      serverId,
      user?.uid,
      setChannels,
      (listenerError) => {
        if (!import.meta.env.PROD) console.warn('[chazter] channels', listenerError?.code);
      },
    );
  }, [serverId, user?.uid]);

  // If a server route is opened without a channel, go to its first channel.
  useEffect(() => {
    if (!server || channelId || !channels.length) return;
    navigate(`/app/s/${server.id}/c/${channels[0].id}`, { replace: true });
  }, [server, channelId, channels, navigate]);

  const activeChannel = channels.find((entry) => entry.id === channelId) || null;

  if (serversLoading && !server) return <AppLoading />;

  if (serversError) {
    const copy = conversationErrorCopy(serversError);
    return (
      <ErrorState
        title={copy.title}
        description={copy.description}
        detail={serversError?.code}
        onRetry={() => window.location.reload()}
        retryLabel="Reload Chazter"
      />
    );
  }

  if (!serverId) {
    return (
      <div className="server-workspace server-workspace--empty">
        <ServerRail servers={servers} activeId={null} onCreate={() => setCreateOpen(true)} />
        <div className="server-workspace__body">
          <EmptyState
            icon={Compass}
            title="No server selected"
            description="Pick a server from the rail, or create your own."
            action={
              <Button variant="solid" icon={Plus} onClick={() => setCreateOpen(true)}>
                Create a server
              </Button>
            }
          />
          <CreateServerDialog open={createOpen} onClose={() => setCreateOpen(false)} />
        </div>
      </div>
    );
  }

  if (serverLoading) return <AppLoading />;

  if (serverError) {
    const notMember = serverError.code === 'not-a-member';
    return (
      <ErrorState
        title={notMember ? 'You’re not in this server' : 'This server isn’t available'}
        description={
          notMember
            ? 'Ask an admin for an invite link and you’ll be added to every channel.'
            : 'It may have been deleted. Try another server from the rail.'
        }
        detail={serverError.code}
        onRetry={() => navigate('/app/servers')}
        retryLabel="Back to servers"
      />
    );
  }

  return (
    <div className={cx('server-workspace', sidebarOpen && 'is-sidebar-open')}>
      <ServerRail servers={servers} activeId={serverId} onCreate={() => setCreateOpen(true)} />

      <div className={cx('server-workspace__sidebar', sidebarOpen && 'is-open')}>
        <button
          type="button"
          className="server-workspace__sidebar-close"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close channel list"
        >
          <X size={16} />
        </button>
        <ServerSidebar server={server} role={role} onClose={() => setSidebarOpen(false)} />
      </div>

      {sidebarOpen && !isDesktop ? (
        <button
          type="button"
          className="server-workspace__scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close channel list"
        />
      ) : null}

      <div className="server-workspace__body">
        {channelId ? (
          <ChannelView
            channelId={channelId}
            channel={activeChannel}
            server={server}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        ) : null}
      </div>

      <CreateServerDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

/**
 * The far-left rail: one button per server, plus a create button.
 */
function ServerRail({ servers, activeId, onCreate }) {
  const navigate = useNavigate();
  return (
    <nav className="server-rail" aria-label="Servers">
      {servers.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={cx('server-rail__item', entry.id === activeId && 'is-active')}
          onClick={() => navigate(`/app/s/${entry.id}`)}
          title={entry.name}
          aria-label={entry.name}
          aria-current={entry.id === activeId ? 'page' : undefined}
        >
          {entry.name.slice(0, 2).toUpperCase()}
        </button>
      ))}
      <button
        type="button"
        className="server-rail__add"
        onClick={onCreate}
        aria-label="Create a server"
        title="Create a server"
      >
        <Plus size={17} />
      </button>
    </nav>
  );
}
