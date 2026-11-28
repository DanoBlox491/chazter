import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Link2,
  Crown,
  LogOut,
  MessageSquarePlus,
  Pencil,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { Modal, ConfirmDialog } from '../ui/Modal.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { Switch, SectionHeader } from '../ui/Misc.jsx';
import { AddMembersDialog } from './AddMembersDialog.jsx';
import { InviteDialog } from '../servers/InviteDialog.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { conversationDisplay } from '../../lib/utils/conversationDisplay.js';
import {
  leaveConversation,
  promoteToAdmin,
  removeMember,
  setArchived,
  setMuted,
  updateGroupInfo,
  startPrivateConversation,
} from '../../lib/services/conversationService.js';
import { CONVERSATION_TYPES, INVITE_TYPES } from '../../lib/services/models.js';
import { isUserOnline } from '../../lib/services/presence.js';
import { errorMessage } from '../../lib/utils/errors.js';
import { cx } from '../../lib/utils/general.js';
import { formatMonthYear } from '../../lib/utils/time.js';

/**
 * Conversation details — profile card for 1:1, member management for groups.
 * Every control here calls a real service; nothing is decorative.
 */
export function ConversationDetails({ open, onClose, conversation, uid }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState(conversation?.name || '');

  const isGroup = conversation?.type === CONVERSATION_TYPES.group;
  const display = conversationDisplay(conversation, uid);
  const isAdmin = Boolean(conversation?.isAdmin);
  const [inviteOpen, setInviteOpen] = useState(false);
  const members = useMemo(() => {
    return Object.entries(conversation?.members || {})
      .map(([memberId, value]) => ({
        uid: memberId,
        ...value,
        isAdmin: conversation?.admins?.includes(memberId),
        isCreator: conversation?.createdBy === memberId,
        online: isUserOnline({ presence: conversation?.presence?.[memberId] }),
      }))
      .sort((a, b) => Number(b.isCreator) - Number(a.isCreator) || Number(b.isAdmin) - Number(a.isAdmin));
  }, [conversation]);

  if (!conversation) return null;

  const run = async (key, fn, successMessage) => {
    setBusy(key);
    try {
      await fn();
      if (successMessage) toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error('That didn’t work', errorMessage(error));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const handleMute = async (muted) => {
    await run('mute', () => setMuted(conversation.id, uid, muted), muted ? 'Conversation muted' : 'Notifications on');
  };

  const handleArchive = async (archived) => {
    const done = await run('archive', () => setArchived(conversation.id, uid, archived), archived ? 'Chat archived' : 'Chat restored');
    if (done && archived) {
      onClose();
      navigate('/app');
    }
  };

  const handleLeave = async () => {
    const done = await run('leave', () => leaveConversation(conversation.id, uid), isGroup ? 'You left the group' : 'Chat removed');
    if (done) {
      setConfirmLeave(false);
      onClose();
      navigate('/app');
    }
  };

  const handleRemove = async (member) => {
    const done = await run('remove', () => removeMember(conversation.id, uid, member.uid), `${member.displayName} removed`);
    if (done) setConfirmRemove(null);
  };

  const handlePromote = async (member) => {
    await run('promote', () => promoteToAdmin(conversation.id, uid, member.uid), `${member.displayName} is now an admin`);
  };

  const handleSaveName = async () => {
    const done = await run('rename', () => updateGroupInfo(conversation.id, uid, { name: draftName }), 'Group name updated');
    if (done) setEditOpen(false);
  };

  const handleMessageMember = async (member) => {
    if (!user || !member?.uid) return;
    setBusy('dm');
    try {
      const { id } = await startPrivateConversation(user, {
        uid: member.uid,
        displayName: member.displayName,
        username: member.username,
        photoURL: member.photoURL,
      });
      onClose();
      navigate(`/app/c/${id}`);
    } catch (error) {
      toast.error('Could not open chat', errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isGroup ? 'Group details' : 'Profile'}
        description={isGroup ? 'Manage this group and its members.' : undefined}
        size="md"
      >
        <div className="details">
          <div className="details__hero">
            {isGroup ? (
              <Avatar name={conversation.name} colour={conversation.color} size={72} />
            ) : (
              <Avatar
                src={display.partner?.photoURL}
                name={display.title}
                userId={display.partner?.uid}
                size={72}
                showStatus
                online={display.partner ? isUserOnline({ presence: conversation.presence?.[display.partner.uid] }) : false}
              />
            )}
            <div className="details__hero-text">
              <div className="details__title-row">
                <h3 className="details__title">{isGroup ? conversation.name : display.title}</h3>
                {isGroup && isAdmin ? (
                  <button
                    type="button"
                    className="details__rename"
                    onClick={() => {
                      setDraftName(conversation.name);
                      setEditOpen(true);
                    }}
                    aria-label="Rename group"
                  >
                    <Pencil size={13} />
                  </button>
                ) : null}
              </div>
              {isGroup ? (
                <p className="details__subtitle">
                  Group · {members.length} {members.length === 1 ? 'member' : 'members'}
                </p>
              ) : (
                <p className="details__subtitle">@{display.partner?.username || 'unknown'}</p>
              )}
            </div>
          </div>

          {!isGroup ? (
            <div className="details__actions">
              <Button
                variant="outline"
                size="sm"
                icon={MessageSquarePlus}
                onClick={() => handleMessageMember(display.partner || {})}
                loading={busy === 'dm'}
              >
                Message
              </Button>
              {display.partner?.username ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate(`/app/u/${display.partner.username}`);
                  }}
                >
                  View profile
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="details__section">
            <SectionHeader title="Preferences" />
            <Switch
              id="detail-mute"
              label="Mute this conversation"
              description="Notifications stay quiet, unread counts keep working."
              checked={conversation.muted}
              onChange={handleMute}
            />
            <Switch
              id="detail-archive"
              label="Archive"
              description="Hide from your inbox without deleting anything."
              checked={conversation.archived}
              onChange={handleArchive}
            />
          </div>

          {isGroup ? (
            <div className="details__section">
              <SectionHeader
                title={`Members · ${members.length}`}
                action={
                  isAdmin ? (
                    <button type="button" className="details__link" onClick={() => setAddOpen(true)}>
                      <UserPlus size={13} aria-hidden="true" /> Add
                    </button>
                  ) : null
                }
              />
              <ul className="member-list">
                {members.map((member) => (
                  <li key={member.uid} className={cx('member-row', member.uid === uid && 'is-self')}>
                    <Avatar
                      src={member.photoURL}
                      name={member.displayName}
                      userId={member.uid}
                      size={36}
                      showStatus
                      online={member.online}
                    />
                    <div className="member-row__info">
                      <p className="member-row__name">
                        {member.displayName}
                        {member.uid === uid ? <span className="member-row__you"> (you)</span> : null}
                      </p>
                      <p className="member-row__handle">
                        @{member.username}
                        {member.isCreator ? ' · creator' : member.isAdmin ? ' · admin' : ''}
                      </p>
                    </div>
                    {member.isCreator ? (
                      <Crown size={15} className="member-row__badge" aria-label="Group creator" />
                    ) : member.isAdmin ? (
                      <Shield size={14} className="member-row__badge" aria-label="Admin" />
                    ) : null}
                    {isAdmin && member.uid !== uid ? (
                      <div className="member-row__menu">
                        {!member.isAdmin ? (
                          <button
                            type="button"
                            className="member-row__action"
                            onClick={() => handlePromote(member)}
                            disabled={busy === 'promote'}
                            aria-label={`Make ${member.displayName} an admin`}
                            title="Make admin"
                          >
                            <Shield size={14} />
                          </button>
                        ) : null}
                        {!member.isCreator ? (
                          <button
                            type="button"
                            className="member-row__action member-row__action--danger"
                            onClick={() => setConfirmRemove(member)}
                            aria-label={`Remove ${member.displayName}`}
                            title="Remove from group"
                          >
                            <UserMinus size={14} />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {isAdmin ? (
                <>
                  <button type="button" className="details__add-row" onClick={() => setAddOpen(true)}>
                    <span className="details__add-icon">
                      <UserPlus size={16} />
                    </span>
                    Add people to this group
                  </button>
                  <button type="button" className="details__add-row" onClick={() => setInviteOpen(true)}>
                    <span className="details__add-icon">
                      <Link2 size={16} />
                    </span>
                    Create an invite link
                  </button>
                </>
              ) : null}
            </div>
          ) : (
            <div className="details__section">
              <SectionHeader title="About" />
              <div className="details__facts">
                <p>
                  <Users size={14} aria-hidden="true" /> Private conversation between the two of you.
                </p>
                {conversation.createdAt ? (
                  <p>
                    <Bell size={14} aria-hidden="true" /> Started {formatMonthYear(conversation.createdAt)}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          <div className="details__danger">
            <Button
              variant="ghost"
              size="md"
              icon={isGroup ? LogOut : Trash2}
              onClick={() => setConfirmLeave(true)}
              className="details__leave"
            >
              {isGroup ? 'Leave group' : 'Delete chat'}
            </Button>
          </div>
        </div>
      </Modal>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        type={INVITE_TYPES.group}
        targetId={conversation?.id}
        targetName={conversation?.name || 'this group'}
        canCreate={isAdmin}
      />

      <AddMembersDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        conversation={conversation}
        uid={uid}
        onAdded={() => setAddOpen(false)}
      />

      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={handleLeave}
        loading={busy === 'leave'}
        title={isGroup ? 'Leave this group?' : 'Delete this chat?'}
        description={
          isGroup
            ? 'You’ll stop receiving messages from this group. Other members keep the history.'
            : 'The conversation will be removed from your inbox. The other person keeps their copy, and a new message will bring it back.'
        }
        confirmLabel={isGroup ? 'Leave group' : 'Delete chat'}
      />

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => handleRemove(confirmRemove)}
        loading={busy === 'remove'}
        title={`Remove ${confirmRemove?.displayName || 'this person'}?`}
        description="They’ll lose access to this group immediately. You can add them back later."
        confirmLabel="Remove"
      />

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Rename group"
        size="sm"
        footer={
          <>
            <Button variant="quiet" size="md" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="solid" size="md" onClick={handleSaveName} loading={busy === 'rename'}>
              Save
            </Button>
          </>
        }
      >
        <label className="field" htmlFor="group-name">
          <span className="field__label">Group name</span>
          <span className="field__control">
            <input
              id="group-name"
              className="field__input"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              maxLength={48}
              data-autofocus
            />
          </span>
        </label>
      </Modal>
    </>
  );
}
