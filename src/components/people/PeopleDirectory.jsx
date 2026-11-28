import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserRoundSearch, MessageCirclePlus, Users } from 'lucide-react';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { EmptyState, Spinner, ListSkeleton } from '../ui/States.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useWorkspace } from '../../context/NewChatContext.jsx';
import { useDebouncedValue } from '../../hooks/useMisc.js';
import { searchUsers} from '../../lib/services/userService.js';
import { isUserOnline } from '../../lib/services/presence.js';
import { startPrivateConversation } from '../../lib/services/conversationService.js';
import { errorMessage } from '../../lib/utils/errors.js';
import { formatMonthYear } from '../../lib/utils/time.js';

/**
 * People directory — search all Chazter profiles, jump to a profile or chat.
 */
export default function PeopleDirectory({ onStartChat }) {
  const { user, uid } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { openComposer } = useWorkspace();
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 300);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyUid, setBusyUid] = useState(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (debounced.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setSearched(false);
      return undefined;
    }
    setLoading(true);
    searchUsers(debounced, { excludeUid: uid, max: 24 })
      .then((found) => {
        if (!cancelled) {
          setResults(found);
          setSearched(true);
        }
      })
      .catch((error) => {
        if (!cancelled) toast.error('Search failed', errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, uid]);

  const startChat = async (profile) => {
    setBusyUid(profile.uid);
    try {
      const { id } = await startPrivateConversation(user, profile);
      onStartChat?.(id);
    } catch (error) {
      toast.error('Could not start chat', errorMessage(error));
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="people">
      <header className="people__header">
        <div>
          <h1 className="people__title display">
            Find <em>people</em>
          </h1>
          <p className="people__lede">Search by display name or exact @username.</p>
        </div>
        <Button variant="outline" size="sm" icon={Users} onClick={() => openComposer('group')}>
          New group
        </Button>
      </header>

      <div className="people__search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search Chazter"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          aria-label="Search people"
          autoFocus
        />
        {loading ? <Spinner size={16} /> : null}
      </div>

      <div className="people__body">
        {debounced.trim().length < 2 ? (
          <EmptyState
            icon={UserRoundSearch}
            title="Who are you looking for?"
            description="Start typing a name or @username. Results appear as you type — only people who’ve finished setting up their profile show up here."
          />
        ) : loading ? (
          <ListSkeleton rows={5} />
        ) : results.length === 0 && searched ? (
          <EmptyState
            icon={UserRoundSearch}
            title="No matches yet"
            description={`Nothing found for “${debounced.trim()}”. Try the exact @username, or invite them to Chazter.`}
            action={
              <Button variant="ghost" size="sm" onClick={() => setTerm('')}>
                Clear search
              </Button>
            }
          />
        ) : (
          <ul className="people-grid">
            {results.map((profile) => (
              <li key={profile.uid} className="people-card">
                <button
                  type="button"
                  className="people-card__profile"
                  onClick={() => navigate(`/app/u/${profile.username}`)}
                >
                  <Avatar
                    src={profile.photoURL}
                    name={profile.displayName}
                    userId={profile.uid}
                    size={56}
                    showStatus
                    online={isUserOnline(profile)}
                  />
                  <span className="people-card__name">{profile.displayName}</span>
                  <span className="people-card__handle">@{profile.username}</span>
                </button>
                {profile.bio ? <p className="people-card__bio">{profile.bio}</p> : null}
                <p className="people-card__joined">Joined {formatMonthYear(profile.createdAt)}</p>
                <div className="people-card__actions">
                  <Button
                    variant="solid"
                    size="sm"
                    fullWidth
                    icon={MessageCirclePlus}
                    loading={busyUid === profile.uid}
                    onClick={() => startChat(profile)}
                  >
                    Message
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
