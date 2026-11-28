/**
 * Firebase Authentication wrapper.
 *
 * Every auth screen talks to this module — never to the SDK directly — so
 * sign-in policy (error mapping, linking, profile bootstrapping) lives in one
 * place and stays testable.
 */
import {
  GoogleAuthProvider,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  linkWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
  reauthenticateWithCredential,
  deleteUser,
} from 'firebase/auth';
import { auth } from './firebase.js';
import { authErrorMessage, AppError } from '../utils/errors.js';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Popup is the best UX on desktop; on mobile browsers redirects are more
 * reliable, but popup still works on modern iOS/Android Chrome + Safari.
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, isNewUser: isNewAuthUser(result) };
  } catch (error) {
    throw new AppError(error.code || 'auth/unknown', authErrorMessage(error));
  }
}

function isNewAuthUser(result) {
  // `additionalUserInfo.isNewUser` is provided by the popup result.
  return Boolean(result?._tokenResponse?.isNewUser);
}

export function getGoogleCredentialFromError(error) {
  const credential =
    GoogleAuthProvider.credentialFromError(error) ||
    error?.customData?._tokenResponse ||
    null;
  return credential;
}

export async function signUpWithEmail({ email, password }) {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    // Fire-and-forget: verification is encouraged, not enforced (avoids lockout).
    sendEmailVerification(credential.user).catch((error) => {
      console.warn('[chazter] Could not send verification email', error?.code);
    });
    return credential.user;
  } catch (error) {
    throw new AppError(error.code || 'auth/unknown', authErrorMessage(error));
  }
}

export async function signInWithEmail({ email, password }) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error) {
    throw new AppError(error.code || 'auth/unknown', authErrorMessage(error));
  }
}

export async function sendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    // Don't leak whether an address is registered.
    if (error?.code === 'auth/user-not-found') return;
    throw new AppError(error.code || 'auth/unknown', authErrorMessage(error));
  }
}

export async function resendVerificationEmail(user = auth.currentUser) {
  if (!user) throw new AppError('auth/no-user', 'You need to be signed in.');
  try {
    if (user.emailVerified) return { alreadyVerified: true };
    await sendEmailVerification(user);
    return { sent: true };
  } catch (error) {
    throw new AppError(error.code || 'auth/unknown', authErrorMessage(error));
  }
}

export async function logOut() {
  await signOut(auth);
}

export async function updateAuthDisplayName(displayName) {
  if (!auth.currentUser) return;
  await updateProfile(auth.currentUser, { displayName });
}

export async function updateAuthPhoto(photoURL) {
  if (!auth.currentUser) return;
  await updateProfile(auth.currentUser, { photoURL });
}

export async function updateAuthEmail(email, password) {
  const user = auth.currentUser;
  if (!user) throw new AppError('auth/no-user', 'You need to be signed in.');
  try {
    if (password) {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    }
    await updateEmail(user, email.trim());
  } catch (error) {
    throw new AppError(error.code || 'auth/unknown', authErrorMessage(error));
  }
}

export async function updateAuthPassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new AppError('auth/no-user', 'You need to be signed in.');
  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  } catch (error) {
    throw new AppError(error.code || 'auth/unknown', authErrorMessage(error));
  }
}

/**
 * Safely link a Google identity to the current email/password account.
 *
 * Firebase refuses to link a provider that already belongs to another
 * account. When that happens we surface `account-exists-with-different-credential`
 * to the UI with the pending credential so it can guide the user to sign in
 * to the original account instead — never silently merging accounts.
 */
export async function linkGoogleToCurrentUser() {
  const user = auth.currentUser;
  if (!user) throw new AppError('auth/no-user', 'You need to be signed in.');
  try {
    const result = await linkWithPopup(user, googleProvider);
    return result.user;
  } catch (error) {
    if (error?.code === 'auth/credential-already-in-use') {
      throw new AppError(
        'link/in-use',
        'That Google account is already connected to another Chazter profile.',
      );
    }
    if (error?.code === 'auth/provider-already-linked') {
      const linked = auth.currentUser.providerData.some((p) => p.providerId === 'google.com');
      if (linked) return auth.currentUser;
    }
    throw new AppError(error.code || 'auth/unknown', authErrorMessage(error));
  }
}

/**
 * Attach an email/password credential to a Google-only account so the user
 * can sign in both ways.
 */
export async function linkEmailPasswordToCurrentUser(email, password) {
  const user = auth.currentUser;
  if (!user) throw new AppError('auth/no-user', 'You need to be signed in.');
  try {
    const credential = EmailAuthProvider.credential(email.trim(), password);
    const result = await linkWithCredential(user, credential);
    return result.user;
  } catch (error) {
    if (error?.code === 'auth/email-already-in-use') {
      throw new AppError(
        'link/in-use',
        'That email already belongs to another Chazter profile. Sign in to it and connect Google there instead.',
      );
    }
    if (error?.code === 'auth/provider-already-linked') return auth.currentUser;
    throw new AppError(error.code || 'auth/unknown', authErrorMessage(error));
  }
}

/**
 * Detects collisions before we create anything: if the Google email is
 * already registered with a password account, tell the user to sign in with
 * their password and then link Google from Settings.
 */
export async function describeEmailMethods(email) {
  try {
    return await fetchSignInMethodsForEmail(auth, email);
  } catch {
    return [];
  }
}

export function getLinkedProviders() {
  return (auth.currentUser?.providerData || []).map((p) => p.providerId);
}

/**
 * Re-authentication is required by Firebase for sensitive changes. For
 * password accounts we ask for the password; Google accounts re-use popup.
 */
export async function reauthenticate(currentPassword = '') {
  const user = auth.currentUser;
  if (!user) throw new AppError('auth/no-user', 'You need to be signed in.');
  const hasPassword = user.providerData.some((p) => p.providerId === 'password');
  try {
    if (hasPassword) {
      if (!currentPassword) throw new AppError('auth/password-required', 'Enter your password.');
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
    } else {
      await reauthenticateWithPopupSafe();
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.code || 'auth/unknown', authErrorMessage(error));
  }
}

async function reauthenticateWithPopupSafe() {
  const { reauthenticateWithPopup } = await import('firebase/auth');
  return reauthenticateWithPopup(auth.currentUser, googleProvider);
}

export async function deleteAccount(currentPassword) {
  await reauthenticate(currentPassword);
  const user = auth.currentUser;
  if (!user) throw new AppError('auth/no-user', 'You need to be signed in.');
  try {
    await deleteUser(user);
  } catch (error) {
    throw new AppError(error.code || 'auth/unknown', authErrorMessage(error));
  }
}

export { auth };
