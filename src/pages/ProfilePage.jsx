import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, CalendarDays, MessageCirclePlus, Moon, Pencil, Sun } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Button, IconButton } from '../components/ui/Button.jsx';
import { EmptyState, Spinner } from '../components/ui/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { isUserOnline } from '../lib/services/presence.js';
import { startPrivateConversation } from '../lib/services/conversationService.js';
import { errorMessage } from '../lib/utils/errors.js';
import { formatLastSeen, formatMonthYear } from '../lib/utils/time.js';

/**
 * Public profile at /app/u/:username.
 * Your own handle shows an edit shortcut; someone else's shows Message.
 */
export default function ProfilePage() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { isDark, toggleTheme } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const isSelf = me?.username?.toLowerCase() === String(username || '').toLowerCase();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (isSelf) {
      setProfile(me);
      setLoading(false);
      document.title = `${me.displayName} · Chazter`;
      return () => {
        cancelled = true;
      };
    }
    // Resolve @handle → uid → profile.
    import('../lib/services/conversationService.js')
      .then(({ findUserByUsername }) => findUserByUsername(username))
      .then((found) => {
        if (cancelled) return;
        setProfile(found);
        if (found) document.title = `${found.displayName} · Chazter`;
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, isSelf, me?.uid]);

  const handleMessage = async () => {
    if (!profile || !me) return;
    setStarting(true);
    try {
      const { id } = await startPrivateConversation(me, profile);
      navigate(`/app/c/${id}`);
    } catch (error) {
      toast.error('Could not open chat', errorMessage(error));
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page profile-page--loading">
        <Spinner size={24} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate(-1)} className="profile-page__back" />
        <EmptyState
          title="Profile not found"
          description={`No one on Chazter has the handle @${username}.`}
          action={<Button variant="outline" onClick={() => navigate('/app/people')}>Find people</Button>}
        />
      </div>
    );
  }

  const online = isUserOnline(profile);

  return (
    <div className="profile-page">
      <div className="profile-page__topbar">
        <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate(-1)} />
        <div className="profile-page__topbar-right">
          <IconButton
            icon={isDark ? Sun : Moon}
            label={isDark ? 'Light theme' : 'Dark theme'}
            onClick={toggleTheme}
          />
        </div>
      </div>

      <div className="profile-page__inner page-fade">
        <div className="profile-hero">
          <div className="profile-hero__banner" aria-hidden="true" />
          <div className="profile-hero__avatar">
            <Avatar src={profile.photoURL} name={profile.displayName} userId={profile.uid} size={104} ring />
            <span className={`profile-hero__presence ${online ? 'is-online' : ''}`}>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="profile-hero__body">
            <div className="profile-hero__name-row">
              <h1 className="profile-hero__name display">{profile.displayName}</h1>
              <BadgeCheck size={20} className="profile-hero__verified" aria-label="Chazter member" />
            </div>
            <p className="profile-hero__handle">@{profile.username}</p>
            {profile.bio ? <p className="profile-hero__bio">{profile.bio}</p> : <p className="profile-hero__bio profile-hero__bio--empty">No bio yet.</p>}

            <div className="profile-hero__facts">
              <span>
                <CalendarDays size={14} aria-hidden="true" /> Joined {formatMonthYear(profile.createdAt)}
              </span>
              <span>
                <span className={`status-dot ${online ? 'is-online' : ''}`} aria-hidden="true" />
                {online ? 'Active now' : formatLastSeen(profile.presence?.lastActiveAt)}
              </span>
            </div>

            <div className="profile-hero__actions">
              {isSelf ? (
                <Button variant="outline" icon={Pencil} onClick={() => navigate('/app/settings')}>
                  Edit profile
                </Button>
              ) : (
                <>
                  <Button variant="solid" icon={MessageCirclePlus} onClick={handleMessage} loading={starting}>
                    Message
                  </Button>
                  <Button variant="ghost" onClick={() => navigate('/app')}>
                    Back to chats
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="profile-grid">
          <section className="profile-card">
            <h2 className="profile-card__title">About</h2>
            <dl className="profile-card__list">
              <div>
                <dt>Username</dt>
                <dd>@{profile.username}</dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{formatMonthYear(profile.createdAt) || '—'}</dd>
              </div>
              <div>
                <dt>Sign-in</dt>
                <dd>{profile.provider === 'google' ? 'Google account' : 'Chazter account'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{online ? 'Online' : formatLastSeen(profile.presence?.lastActiveAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="profile-card profile-card--note">
            <h2 className="profile-card__title">On Chazter</h2>
            <p>
              Chazter profiles are intentionally small. Conversation happens in chat, not on a
              feed — what you share with someone stays between you and your members-only
              conversations.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
