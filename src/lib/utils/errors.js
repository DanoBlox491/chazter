/**
 * Human-readable messages for Firebase Auth / Firestore errors.
 *
 * Firebase codes are stable but their default messages are developer-facing,
 * so we translate the ones Chazter can actually trigger.
 */

const AUTH_MESSAGES = {
  'auth/email-already-in-use': 'An account already exists with this email address.',
  'auth/invalid-email': 'That email address isn’t valid.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/user-disabled': 'This account has been disabled. Contact support if that’s unexpected.',
  'auth/weak-password': 'That password is too weak — use at least 8 characters with a number.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network problem — check your connection and try again.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/account-exists-with-different-credential':
    'This email is already registered with a different sign-in method.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
  'auth/operation-not-allowed': 'This sign-in method isn’t enabled for the project yet.',
  'auth/unauthorized-domain':
    'This domain isn’t authorised for sign-in. Add it in Firebase Console → Authentication → Settings.',
  'auth/credential-already-in-use': 'That account is already linked to a different profile.',
  'auth/provider-already-linked': 'That sign-in method is already connected to your profile.',
  'auth/missing-or-invalid-nonce': 'Google sign-in could not be verified. Please try again.',
  'auth/internal-error': 'Something went wrong on our side. Please try again.',
  'auth/timeout': 'The sign-in request timed out. Please try again.',
};

const FIRESTORE_MESSAGES = {
  'permission-denied': 'You don’t have permission to do that.',
  unavailable: 'You appear to be offline. Chazter will retry automatically.',
  'failed-precondition': 'This action needs a newer version of the app. Refresh and try again.',
  'not-found': 'That item no longer exists.',
  cancelled: 'The request was cancelled.',
  'deadline-exceeded': 'The request took too long. Please try again.',
  'resource-exhausted': 'Too many requests right now. Please slow down a moment.',
  unauthenticated: 'Please sign in again to continue.',
  'invalid-argument': 'Something in that request wasn’t valid.',
  'already-exists': 'That already exists.',
  'storage/unauthorized': 'You don’t have permission to access that file.',
  'storage/retry-limit-exceeded': 'The upload kept failing — check your connection.',
  'storage/canceled': 'The upload was cancelled.',
  'storage/unknown': 'The upload failed. This usually means Cloud Storage isn’t enabled yet.',
  'storage/object-not-found': 'That file no longer exists.',
  'storage/quota-exceeded': 'The storage quota for this project is full.',
};

const customMessages = new Map();

/** Register an app-specific error message for a code (e.g. `username-taken`). */
export function registerErrorMessage(code, message) {
  customMessages.set(code, message);
}

export function authErrorMessage(error) {
  const code = error?.code || '';
  return (
    AUTH_MESSAGES[code] ||
    customMessages.get(code) ||
    // Never surface raw internals to users; log for debugging instead.
    (console.warn('[chazter] Unmapped auth error', error), 'We couldn’t complete that. Please try again.')
  );
}

export function firebaseErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const code = error?.code || '';
  if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  if (customMessages.has(code)) return customMessages.get(code);

  // permission-denied almost always means the deployed rules and the client
  // disagree (stale rules, different project, or a path the rules deny). The
  // Firebase message names the exact operation and path, so log it verbosely
  // instead of silently collapsing it into "you don't have permission".
  if (code === 'permission-denied') {
    console.error(
      '[chazter] permission-denied — check that firestore.rules is deployed to this project.',
      { message: error?.message, path: error?.customData?.path, operation: error?.customData?.operation },
    );
    return FIRESTORE_MESSAGES[code];
  }

  if (FIRESTORE_MESSAGES[code]) return FIRESTORE_MESSAGES[code];
  if (error?.message && !import.meta.env.PROD && code) {
    console.warn('[chazter] Unmapped Firebase error', code, error);
  }
  return fallback;
}

/** Throwable error with a user-facing message and a stable code. */
export class AppError extends Error {
  constructor(code, message) {
    super(message || customMessages.get(code) || code);
    this.name = 'AppError';
    this.code = code;
  }
}

export function errorMessage(error, fallback) {
  if (!error) return fallback || '';
  if (error instanceof AppError) return error.message;
  if (error.code) return firebaseErrorMessage(error, error.message || fallback);
  return error.message || fallback || 'Something went wrong.';
}

registerErrorMessage('username-taken', 'That username is already taken. Try another.');
registerErrorMessage('username-invalid', 'That username isn’t valid.');
registerErrorMessage('username-unchanged', 'That’s already your username.');
registerErrorMessage('storage-unconfigured', 'Image sharing needs Cloud Storage enabled in Firebase.');
registerErrorMessage('conversation-not-found', 'This conversation is no longer available.');
registerErrorMessage('not-a-member', 'You’re no longer part of this conversation.');
registerErrorMessage('empty-message', 'Write something before sending.');
registerErrorMessage('image-too-large', 'That image is too large — pick one under 5 MB.');
