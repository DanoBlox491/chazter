import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Hash, Loader2, ShieldAlert, Users } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { BrandMark } from '../components/brand/Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getInvite, joinViaInvite } from '../lib/services/serverService.js';
import { INVITE_TYPES } from '../lib/services/models.js';
import { errorMessage } from '../lib/utils/errors.js';

/**
 * JoinPage — resolves an invite link.
 *
 * Two states matter and both are handled explicitly:
 *  - signed out: show what the invite is for, then send them to sign in and
 *    bring them straight back (the code survives in the URL)
 *  - signed in: join and redirect into the server or group
 */
export default function JoinPage() {
  const { code } = useParams();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | invalid | joining | error
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!code) {
      setState('invalid');
      return undefined;
    }
    if (authLoading) return undefined;

    getInvite(code)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setState('invalid');
          return;
        }
        setInvite(result);
        setState('ready');
      })
      .catch((loadError) => {
        if (cancelled) return;
        // Reading an invite requires being signed in; that is a routing
        // problem, not a broken link.
        if (loadError?.code === 'permission-denied' || !user) {
          setState('ready');
          return;
        }
        setError(errorMessage(loadError));
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [code, user, authLoading]);

  const join = async () => {
    setState('joining');
    try {
      const result = await joinViaInvite(code, user);
      toast.success(result.alreadyMember ? 'You’re already in' : 'Joined');
      if (result.conversationId) navigate(`/app/c/${result.conversationId}`, { replace: true });
      else if (result.serverId) {
        navigate(`/app/s/${result.serverId}/c/${result.channelId || ''}`, { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    } catch (joinError) {
      setError(errorMessage(joinError));
      setState('error');
    }
  };

  const isGroup = invite?.type === INVITE_TYPES.group;
  const title = invite?.targetName || (isGroup ? 'a group chat' : 'a server');

  return (
    <div className="join-page">
      <div className="ambient" aria-hidden="true" />
      <div className="join-card">
        <a className="join-card__brand" href="/" aria-label="Chazter home">
          <BrandMark size={30} />
        </a>

        {state === 'loading' ? (
          <p className="join-card__status">
            <Loader2 size={16} className="join-card__spin" aria-hidden="true" /> Checking this invite…
          </p>
        ) : null}

        {state === 'invalid' ? (
          <div className="join-card__body">
            <span className="join-card__icon join-card__icon--warn" aria-hidden="true">
              <ShieldAlert size={20} />
            </span>
            <h1 className="join-card__title">This invite link isn’t valid</h1>
            <p className="join-card__text">
              It may have been revoked, or the code was copied incorrectly. Ask whoever sent it
              for a fresh link.
            </p>
            <Button variant="outline" onClick={() => navigate('/app')}>
              Go to Chazter
            </Button>
          </div>
        ) : null}

        {state === 'ready' || state === 'joining' || state === 'error' ? (
          <div className="join-card__body">
            <span className="join-card__icon" aria-hidden="true">
              {isGroup ? <Users size={20} /> : <Hash size={20} />}
            </span>
            <p className="join-card__eyebrow">{isGroup ? 'Group chat invite' : 'Server invite'}</p>
            <h1 className="join-card__title">Join {title}</h1>
            <p className="join-card__text">
              {user
                ? isGroup
                  ? 'You’ll be added to the group and can start reading straight away.'
                  : 'You’ll be added to every channel in this server.'
                : 'Sign in or create an account to accept — you’ll come right back to this invite.'}
            </p>

            {state === 'error' ? <p className="join-card__error">{error}</p> : null}

            {user ? (
              <Button variant="solid" onClick={join} loading={state === 'joining'}>
                Join {isGroup ? 'group' : 'server'}
              </Button>
            ) : (
              <div className="join-card__actions">
                {/* SignInPage/SignUpPage already honour `location.state.from`,
                    which is how GuardedRoute bounces people here. Reusing that
                    convention means the invite survives the whole auth flow
                    without teaching the auth pages about a second parameter. */}
                <Button
                  variant="solid"
                  onClick={() =>
                    navigate('/signin', { state: { from: { pathname: `/join/${code}` } } })
                  }
                >
                  Sign in to join
                </Button>
                <Button
                  variant="quiet"
                  onClick={() =>
                    navigate('/signup', { state: { from: { pathname: `/join/${code}` } } })
                  }
                >
                  Create an account
                </Button>
              </div>
            )}
            <p className="join-card__fine">This link does not expire, but an admin can revoke it.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
