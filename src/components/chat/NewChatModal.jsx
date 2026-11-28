import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AtSign, MessageCirclePlus, Search, Users } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { Field } from '../ui/Field.jsx';
import { Segmented } from '../ui/Misc.jsx';
import { EmptyState, Spinner } from '../ui/States.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDebouncedValue } from '../../hooks/useMisc.js';
import { searchUsers} from '../../lib/services/userService.js';
import { isUserOnline } from '../../lib/services/presence.js';
import { createGroupConversation, startPrivateConversation } from '../../lib/services/conversationService.js';
import { errorMessage } from '../../lib/utils/errors.js';
import { validateDisplayName, GROUP_NAME_MAX } from '../../lib/utils/validation.js';
import { cx } from '../../lib/utils/general.js';

/**
 * NewChatModal — start a direct chat or create a group.
 *
 * One search field serves both modes: in "direct" a result starts a chat
 * immediately; in "group" results are multi-selected into a member list.
 */
export function NewChatModal({ open, onClose, initialMode = 'direct' }) {
  const { user, uid } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState(initialMode);
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 280);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setTerm('');
      setSelected([]);
      setGroupName('');
      setError('');
    }
  }, [open, initialMode]);

  useEffect(() => {
    let cancelled = false;
    if (!open || debounced.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    searchUsers(debounced, { excludeUid: uid, max: 12 })
      .then((found) => {
        if (!cancelled) setResults(found);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open, uid]);

  const startDirect = async (profile) => {
    setCreating(true);
    setError('');
    try {
      const { id } = await startPrivateConversation(user, profile);
      onClose();
      navigate(`/app/c/${id}`);
    } catch (startError) {
      setError(errorMessage(startError, 'We couldn’t open that chat.'));
    } finally {
      setCreating(false);
    }
  };

  const toggleMember = (profile) => {
    setSelected((current) =>
      current.some((entry) => entry.uid === profile.uid)
        ? current.filter((entry) => entry.uid !== profile.uid)
        : [...current, profile],
    );
    setError('');
  };

  const createGroup = async () => {
    const nameError = groupName.trim() ? (groupName.trim().length < 2 ? 'Use at least 2 characters.' : '') : 'Give the group a name.';
    if (nameError) {
      setError(nameError);
      return;
    }
    if (!selected.length) {
      setError('Add at least one other person.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const id = await createGroupConversation(user, { name: groupName.trim(), members: selected });
      toast.success('Group created', `“${groupName.trim()}” is ready to chat.`);
      onClose();
      navigate(`/app/c/${id}`);
    } catch (createError) {
      setError(errorMessage(createError, 'We couldn’t create that group.'));
    } finally {
      setCreating(false);
    }
  };

  const displayNameError = validateDisplayName(groupName);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'direct' ? 'New conversation' : 'Create a group'}
      description={
        mode === 'direct'
          ? 'Find someone by name or @username to start a private chat.'
          : 'Name your group and pick the people in it.'
      }
      size="md"
    >
      <div className="new-chat">
        <Segmented
          label="Conversation type"
          value={mode}
          onChange={(next) => {
            setMode(next);
            setError('');
          }}
          options={[
            { value: 'direct', label: 'Direct', icon: MessageCirclePlus },
            { value: 'group', label: 'Group', icon: Users },
          ]}
        />

        {mode === 'group' ? (
          <>
            <Field
              label="Group name"
              placeholder="Studio crew"
              value={groupName}
              onChange={(event) => {
                setGroupName(event.target.value);
                setError('');
              }}
              maxLength={GROUP_NAME_MAX}
              showCount
              data-autofocus
            />
            {selected.length ? (
              <div className="chip-row" aria-label="Selected members">
                {selected.map((member) => (
                  <button
                    key={member.uid}
                    type="button"
                    className="chip"
                    onClick={() => toggleMember(member)}
                    aria-label={`Remove ${member.displayName}`}
                  >
                    <Avatar src={member.photoURL} name={member.displayName} userId={member.uid} size={20} />
                    <span>{member.displayName.split(' ')[0]}</span>
                    <span className="chip__x" aria-hidden="true">
                      ×
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        <div className="new-chat__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by name or @username"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            aria-label="Search people"
          />
          {searching ? <Spinner size={15} /> : null}
        </div>

        {error ? (
          <p className="auth-alert" role="alert">
            {error}
          </p>
        ) : null}

        <div className="new-chat__results">
          {debounced.trim().length < 2 ? (
            <EmptyState
              compact
              icon={AtSign}
              title="Search for people"
              description="Try a name, or a full @username if you know it."
            />
          ) : results.length === 0 && !searching ? (
            <EmptyState
              compact
              icon={Search}
              title="No one found"
              description="Chazter only finds people who have completed their profile. Check the spelling or exact @handle."
            />
          ) : (
            <ul className="people-list">
              {results.map((profile) => {
                const isSelected = selected.some((entry) => entry.uid === profile.uid);
                return (
                  <li key={profile.uid}>
                    <button
                      type="button"
                      className={cx('people-row', mode === 'group' && isSelected && 'is-selected')}
                      onClick={() => (mode === 'direct' ? startDirect(profile) : toggleMember(profile))}
                      disabled={creating && mode === 'direct'}
                    >
                      <Avatar
                        src={profile.photoURL}
                        name={profile.displayName}
                        userId={profile.uid}
                        size={40}
                        showStatus
                        online={isUserOnline(profile)}
                      />
                      <span className="people-row__info">
                        <span className="people-row__name">{profile.displayName}</span>
                        <span className="people-row__handle">@{profile.username}</span>
                      </span>
                      {mode === 'group' ? (
                        <span className={cx('people-row__check', isSelected && 'is-on')} aria-hidden="true">
                          {isSelected ? '✓' : ''}
                        </span>
                      ) : (
                        <span className="people-row__cta">Message</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {mode === 'group' ? (
          <div className="new-chat__footer">
            <Button
              variant="solid"
              fullWidth
              onClick={createGroup}
              loading={creating}
              disabled={displayNameError && groupName.length > 0 ? true : undefined}
              icon={Users}
            >
              Create group {selected.length ? `· ${selected.length}` : ''}
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
