/**
 * Post-authentication routing logic.
 *
 * Firebase Auth tells us *who* someone is; the Firestore profile tells us
 * whether they've finished onboarding. This module decides which of the
 * three states the app should render:
 *
 *   loading      → waiting for auth + profile
 *   onboarding   → signed in, no profile yet (Google first-timers, or a
 *                  half-finished email signup)
 *   ready        → signed in with a complete profile
 *
 * Keeping this pure makes it easy to unit test the tricky edges:
 * refresh mid-signup, a Google user who already has a password profile, a
 * profile whose username claim was removed by an admin, etc.
 */

export const AUTH_STATES = {
  initialising: 'initialising',
  signedOut: 'signedOut',
  needsProfile: 'needsProfile',
  needsVerification: 'needsVerification',
  ready: 'ready',
};

/**
 * @param {{ user: object|null, profile: object|null, profileError?: Error|null }} input
 * @returns {{ state: string, reason?: string }}
 */
export function resolveAuthState({ user, profile }) {
  if (!user) return { state: AUTH_STATES.signedOut };
  if (!profile) return { state: AUTH_STATES.needsProfile, reason: 'no-profile' };
  if (profile.onboardingComplete === false) {
    return { state: AUTH_STATES.needsProfile, reason: 'onboarding' };
  }
  if (profile.suspended === true) {
    return { state: AUTH_STATES.signedOut, reason: 'suspended' };
  }
  return { state: AUTH_STATES.ready };
}

/** Prefill values for the onboarding form from a Firebase user. */
export function onboardingDefaults(user) {
  if (!user) return { displayName: '', email: '', photoURL: '' };
  const provider = user.providerData?.find((p) => p.providerId === 'google.com');
  return {
    displayName: user.displayName || provider?.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || provider?.photoURL || '',
  };
}

/**
 * Decide how to handle "this email already has an account with another
 * provider" during Google sign-in. Never auto-merges accounts.
 */
export function linkGuidance(existingMethods = []) {
  if (existingMethods.includes('google.com') && existingMethods.includes('password')) {
    return { action: 'signed-in-either-way' };
  }
  if (existingMethods.includes('password')) {
    return {
      action: 'sign-in-with-password',
      message:
        'An account with this email already exists. Sign in with your password, then connect Google from Settings → Account.',
    };
  }
  return {
    action: 'sign-in-with-provider',
    message: 'This email is already registered. Sign in with the method you used originally.',
  };
}

/** Should the app prompt for email verification? (Soft prompt only.) */
export function needsEmailVerification(user) {
  if (!user) return false;
  const hasPasswordProvider = user.providerData?.some((p) => p.providerId === 'password');
  return Boolean(hasPasswordProvider && !user.emailVerified);
}
