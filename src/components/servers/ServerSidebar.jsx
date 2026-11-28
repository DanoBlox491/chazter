import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Hash, Plus, Settings2, UserRoundPlus } from 'lucide-react';
import { IconButton } from '../ui/Button.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { useChannels } from '../../hooks/useServers.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { canManage } from '../../lib/services/serverService.js';
import { cx } from '../../lib/utils/general.js';
import { CreateChannelDialog } from './CreateChannelDialog.jsx';
import { InviteDialog } from './InviteDialog.jsx';
import { INVITE_TYPES } from '../../lib/services/models.js';

/**
 * ServerSidebar — the channel list for one server.
 *
 * Mirrors the Discord information architecture people already expect: server
 * list on the far left, channels here, conversation on the right.
 */
export function ServerSidebar({ server, role, onClose }) {
  const { user } = useAuth();
  const { channels, loading } = useChannels(server.id);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const mayManage = canManage(role);

  return (
    <div className="server-sidebar">
      <header className="server-sidebar__head">
        <Avatar name={server.name} size={30} square />
        <div className="server-sidebar__identity">
          <h2 className="server-sidebar__name">{server.name}</h2>
          <p className="server-sidebar__members">{server.memberCount || 1} members</p>
        </div>
        <IconButton icon={UserRoundPlus} label="Invite people" size="sm" onClick={() => setInviteOpen(true)} />
      </header>

      <div className="server-sidebar__section">
        <div className="server-sidebar__section-head">
          <span>Channels</span>
          {mayManage ? (
            <IconButton icon={Plus} label="Create channel" size="sm" onClick={() => setCreateOpen(true)} />
          ) : null}
        </div>
        <nav className="server-sidebar__channels" aria-label={`${server.name} channels`}>
          {loading ? <p className="server-sidebar__muted">Loading…</p> : null}
          {channels.map((channel) => (
            <NavLink
              key={channel.id}
              to={`/app/s/${server.id}/c/${channel.id}`}
              className={({ isActive }) => cx('server-channel', isActive && 'is-active')}
              onClick={onClose}
            >
              <Hash size={15} strokeWidth={2} aria-hidden="true" />
              <span>{channel.name}</span>
            </NavLink>
          ))}
          {!loading && !channels.length ? (
            <p className="server-sidebar__muted">No channels yet.</p>
          ) : null}
        </nav>
      </div>

      <footer className="server-sidebar__footer">
        <div className="server-sidebar__me">
          <Avatar src={user?.photoURL} name={user?.displayName} userId={user?.uid} size={24} />
          <span>{user?.displayName}</span>
        </div>
        <Link to={`/app/s/${server.id}/settings`} className="link-btn">
          <Settings2 size={13} aria-hidden="true" /> Server settings
        </Link>
      </footer>

      <CreateChannelDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        serverId={server.id}
      />
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        type={INVITE_TYPES.server}
        targetId={server.id}
        targetName={server.name}
        canCreate={mayManage}
      />
    </div>
  );
}
