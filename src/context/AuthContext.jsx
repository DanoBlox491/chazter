/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase/firebase.js';
import {
  subscribeUserProfile,
  startPresenceHeartbeat,
  stopPresenceHeartbeat,
  setPresence,
} from '../lib/services/userService.js';
import { resolveAuthState, AUTH_STATES } from '../lib/services/authFlow.js';
import {
  signInWithGoogle,
  signUpWithEmail,
  signInWithEmail,
  logOut,
} from '../lib/firebase/auth.js';
import { createUserProfile } from '../lib/services/userService.js';
import { onboardingDefaults } from '../lib/services/authFlow.js';

export const AuthContext = createContext(null);

/**
 * Auth provider.
 *
 * One auth listener + one profile listener for the entire app. The profile
 * listener is attached as soon as Firebase reports a user, and detached on
 * sign-out, so there is exactly one live profile subscription at any time.
 */
export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const profileUnsubRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setInitialising(false);
      profileUnsubRef.current?.();
      profileUnsubRef.current = null;

      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        setProfileError(null);
        stopPresenceHeartbeat();
        return;
      }

      setProfileLoading(true);
      profileUnsubRef.current = subscribeUserProfile(
        user.uid,
        (data) => {
          setProfile(data);
          setProfileLoading(false);
          setProfileError(null);
        },
        (error) => {
          console.error('[chazter] profile subscription failed', error);
          setProfileError(error);
          setProfileLoading(false);
        },
      );
    });

    return () => {
      unsubscribe();
      profileUnsubRef.current?.();
      stopPresenceHeartbeat();
    };
  }, []);

  // Presence heartbeat + goodbye ping while signed in.
  useEffect(() => {
    if (!firebaseUser || !profile?.onboardingComplete) return undefined;
    const stop = startPresenceHeartbeat(firebaseUser.uid);
    const onBeforeUnload = () => {
      // Fire-and-forget offline marker; the stale-timestamp fallback covers failures.
      setPresence(firebaseUser.uid, 'offline');
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') setPresence(firebaseUser.uid, 'away');
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onHidden);
      stop();
    };
  }, [firebaseUser, profile?.onboardingComplete]);

  const authResolution = useMemo(
    () => (initialising ? { state: AUTH_STATES.initialising } : resolveAuthState({ user: firebaseUser, profile })),
    [initialising, firebaseUser, profile],
  );

  /** Complete onboarding for any provider (Google or email/password). */
  const completeOnboarding = useCallback(
    async ({ username, displayName, bio, photoURL }) => {
      if (!firebaseUser) throw new Error('Not signed in');
      const provider = firebaseUser.providerData?.some((p) => p.providerId === 'google.com')
        ? 'google'
        : 'password';
      const created = await createUserProfile({
        uid: firebaseUser.uid,
        username,
        displayName,
        bio,
        photoURL: photoURL || onboardingDefaults(firebaseUser).photoURL,
        provider,
      });
      setProfile(created);
      return created;
    },
    [firebaseUser],
  );

  const signInGoogle = useCallback(async () => {
    const result = await signInWithGoogle();
    return result;
  }, []);

  const signUpEmail = useCallback(async (credentials) => signUpWithEmail(credentials), []);
  const signInEmail = useCallback(async (credentials) => signInWithEmail(credentials), []);

  const signOutUser = useCallback(async () => {
    if (firebaseUser) await setPresence(firebaseUser.uid, 'offline');
    await logOut();
  }, [firebaseUser]);

  /** Re-read the profile after an update made outside the listener. */
  const replaceProfile = useCallback((next) => setProfile(next), []);

  const value = useMemo(
    () => ({
      firebaseUser,
      user: profile,
      profile,
      uid: firebaseUser?.uid || null,
      state: authResolution.state,
      isAuthenticated: Boolean(firebaseUser),
      isLoading: initialising || (Boolean(firebaseUser) && profileLoading),
      profileError,
      completeOnboarding,
      signInGoogle,
      signUpEmail,
      signInEmail,
      signOutUser,
      replaceProfile,
    }),
    [
      firebaseUser,
      profile,
      authResolution.state,
      initialising,
      profileLoading,
      profileError,
      completeOnboarding,
      signInGoogle,
      signUpEmail,
      signInEmail,
      signOutUser,
      replaceProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
