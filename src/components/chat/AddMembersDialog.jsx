import { useEffect, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { EmptyState, Spinner } from '../ui/States.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDebouncedValue } from '../../hooks/useMisc.js';
import { searchUsers} from '../../lib/services/userService.js';
import { isUserOnline } from '../../lib/services/presence.js';
import { addGroupMembers } from '../../lib/services/conversationService.js';
import { errorMessage } from '../../lib/utils/errors.js';
import { cx } from '../../lib/utils/general.js';

/** Add people to an existing group (admins only). */
export function AddMembersDialog({ open, onClose, conversation, uid, onAdded }) {
  const toast = useToast();
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 280);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTerm('');
      setSelected([]);
    }
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (!open || debounced.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    setSearching(true);
    searchUsers(debounced, { excludeUid: uid, max: 20 })
      .then((found) => {
        if (cancelled) return;
        setResults(found.filter((profile) => !conversation?.memberIds?.includes(profile.uid)));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open, uid, conversation?.memberIds]);

  const handleAdd = async () => {
    if (!selected.length) return;
    setSaving(true);
    try {
      await addGroupMembers(conversation.id, uid, selected);
      toast.success(`Added ${selected.length} ${selected.length === 1 ? 'person' : 'people'}`);
      onAdded?.();
      onClose();
    } catch (error) {
      toast.error('Could not add members', errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add people"
      description={`Invite more people to ${conversation?.name || 'this group'}.`}
      size="md"
      footer={
        <>
          <Button variant="quiet" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="solid" size="md" icon={UserPlus} onClick={handleAdd} loading={saving} disabled={!selected.length}>
            Add {selected.length ? `· ${selected.length}` : ''}
          </Button>
        </>
      }
    >
      <div className="new-chat">
        <div className="new-chat__search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by name or @username"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            aria-label="Search people to add"
            data-autofocus
          />
          {searching ? <Spinner size={15} /> : null}
        </div>

        {debounced.trim().length < 2 ? (
          <EmptyState compact icon={Search} title="Search for people" description="Find someone by name or @handle." />
        ) : results.length === 0 && !searching ? (
          <EmptyState compact icon={Search} title="No one to add" description="Everyone matching is already in this group." />
        ) : (
          <ul className="people-list">
            {results.map((profile) => {
              const isSelected = selected.some((entry) => entry.uid === profile.uid);
              return (
                <li key={profile.uid}>
                  <button
                    type="button"
                    className={cx('people-row', isSelected && 'is-selected')}
                    onClick={() =>
                      setSelected((current) =>
                        isSelected
                          ? current.filter((entry) => entry.uid !== profile.uid)
                          : [...current, profile],
                      )
                    }
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
                    <span className={cx('people-row__check', isSelected && 'is-on')} aria-hidden="true">
                      {isSelected ? '✓' : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
