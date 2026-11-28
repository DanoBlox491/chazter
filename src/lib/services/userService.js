/**
 * User profiles, the username registry and presence.
 *
 * Username uniqueness is enforced with a `usernames/{usernameLower}` document
 * inside a transaction. Firestore's "create fails if the document exists"
 * guarantee — combined with Security Rules that forbid writes to a claim the
 * caller doesn't own — makes duplicate usernames impossible even if two
 * people submit at the same instant.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAt,
  endAt,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { COLLECTIONS, buildUserProfile } from './models.js';
import { normaliseUsername, validateUsername, validateDisplayName, validateBio } from '../utils/validation.js';
import { AppError } from '../utils/errors.js';

const usersCol = () => collection(db, COLLECTIONS.users);
const usernamesCol = () => collection(db, COLLECTIONS.usernames);
const userRef = (uid) => doc(db, COLLECTIONS.users, uid);
const usernameRef = (username) => doc(db, COLLECTIONS.usernames, normaliseUsername(username));

/** Live profile subscription. Returns the unsubscribe function. */
export function subscribeUserProfile(uid, onData, onError) {
  if (!uid) return () => {};
  return onSnapshot(
    userRef(uid),
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** True when the username claim is free (transactional check happens on save). */
export async function isUsernameAvailable(username) {
  const error = validateUsername(username);
  if (error) return { available: false, reason: error };
  const snap = await getDoc(usernameRef(username));
  return { available: !snap.exists(), reason: snap.exists() ? 'That username is taken.' : '' };
}

/**
 * Create the public profile and claim the username atomically.
 * Throws `username-taken` when the claim already exists.
 */
export async function createUserProfile({
  uid,
  username,
  displayName,
  bio = '',
  photoURL = '',
  provider = 'password',
}) {
  const usernameError = validateUsername(username);
  if (usernameError) throw new AppError('username-invalid', usernameError);
  const nameError = validateDisplayName(displayName);
  if (nameError) throw new AppError('invalid-display-name', nameError);
  const bioError = validateBio(bio);
  if (bioError) throw new AppError('invalid-bio', bioError);
  if (!uid) throw new AppError('auth/no-user', 'You need to be signed in.');

  const usernameLower = normaliseUsername(username);
  const claimRef = doc(usernamesCol(), usernameLower);
  const profileRef = userRef(uid);

  await runTransaction(db, async (transaction) => {
    // All reads must happen before any writes in a Firestore transaction.
    const claimSnap = await transaction.get(claimRef);
    const profileSnap = await transaction.get(profileRef);

    if (claimSnap.exists() && claimSnap.data().uid !== uid) {
      throw new AppError('username-taken', 'That username is already taken. Try another.');
    }
    if (profileSnap.exists()) {
      const data = profileSnap.data();
      if (data.onboardingComplete) {
        throw new AppError('profile-exists', 'Your profile already exists.');
      }
      // Retry path: profile shell exists (e.g. previous failed attempt) — reuse.
      if (data.usernameLower && data.usernameLower !== usernameLower) {
        const previousClaim = doc(usernamesCol(), data.usernameLower);
        const previousSnap = await transaction.get(previousClaim);
        if (previousSnap.exists() && previousSnap.data().uid === uid) {
          transaction.delete(previousClaim);
        }
      }
    }

    transaction.set(claimRef, {
      uid,
      username: String(username).trim(),
      usernameLower,
      createdAt: serverTimestamp(),
    });

    transaction.set(
      profileRef,
      buildUserProfile({ uid, username, displayName, photoURL, provider, bio }),
    );
  });

  return getUserProfile(uid);
}

/**
 * Update editable profile fields.
 *
 * Username changes move the claim: old claim deleted, new claim created and
 * the profile updated in one batch, so a crash can never orphan the mapping.
 */
export async function updateUserProfile(uid, { displayName, bio, photoURL, username }) {
  if (!uid) throw new AppError('auth/no-user', 'You need to be signed in.');
  const profile = await getUserProfile(uid);
  if (!profile) throw new AppError('profile-missing', 'Your profile could not be found.');

  const patch = { updatedAt: serverTimestamp() };
  const batch = writeBatch(db);

  if (typeof displayName === 'string') {
    const error = validateDisplayName(displayName);
    if (error) throw new AppError('invalid-display-name', error);
    patch.displayName = displayName.trim();
  }
  if (typeof bio === 'string') {
    const error = validateBio(bio);
    if (error) throw new AppError('invalid-bio', error);
    patch.bio = bio.trim();
  }
  if (typeof photoURL === 'string') {
    patch.photoURL = photoURL;
  }

  if (typeof username === 'string' && normaliseUsername(username) !== profile.usernameLower) {
    const error = validateUsername(username);
    if (error) throw new AppError('username-invalid', error);
    const nextUsernameLower = normaliseUsername(username);
    const claimRef = usernameRef(username);
    const claimSnap = await getDoc(claimRef);
    if (claimSnap.exists() && claimSnap.data().uid !== uid) {
      throw new AppError('username-taken', 'That username is already taken. Try another.');
    }
    batch.set(claimRef, {
      uid,
      username: username.trim(),
      usernameLower: nextUsernameLower,
      createdAt: serverTimestamp(),
    });
    if (profile.usernameLower && profile.usernameLower !== nextUsernameLower) {
      batch.delete(usernameRef(profile.usernameLower));
    }
    patch.username = username.trim();
    patch.usernameLower = nextUsernameLower;
  }

  batch.update(userRef(uid), patch);
  await batch.commit();

  // Keep denormalised member cards in sync (rare operation, best effort).
  syncProfileToConversations(uid, {
    displayName: patch.displayName ?? profile.displayName,
    username: patch.username ?? profile.username,
    photoURL: patch.photoURL ?? profile.photoURL,
  }).catch((error) => console.warn('[chazter] Profile sync skipped', error?.code));

  return { ...profile, ...patch };
}

/**
 * Copy the latest display name / username / avatar into every conversation
 * the user belongs to. Snapshot listeners then update the UI everywhere.
 */
export async function syncProfileToConversations(uid, profile) {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.conversations),
      where('memberIds', 'array-contains', uid),
      limit(60),
    ),
  );
  if (snap.empty) return;
  let batch = writeBatch(db);
  let operations = 0;
  for (const conversation of snap.docs) {
    const data = conversation.data();
    if (!data.members?.[uid]) continue;
    batch.update(conversation.ref, {
      [`members.${uid}.displayName`]: profile.displayName,
      [`members.${uid}.username`]: profile.username,
      [`members.${uid}.photoURL`]: profile.photoURL || '',
    });
    operations += 1;
    if (operations === 400) {
      await batch.commit();
      batch = writeBatch(db);
      operations = 0;
    }
  }
  if (operations > 0) await batch.commit();
}

/** Prefix search over usernames and display names. */
export async function searchUsers(term, { excludeUid, max = 12 } = {}) {
  const value = String(term || '').trim().toLowerCase().replace(/^@/, '');
  if (value.length < 2) return [];

  const results = new Map();
  const collect = (snap) => {
    for (const item of snap.docs) {
      const data = { id: item.id, ...item.data() };
      if (data.uid === excludeUid) continue;
      if (!data.onboardingComplete) continue;
      results.set(data.uid, data);
    }
  };

  // Firestore has no substring search; prefix ranges are indexed and cheap.
  const end = `${value}\uf8ff`;
  const [byUsername, byName] = await Promise.all([
    getDocs(
      query(usernamesCol(), orderBy('usernameLower'), startAt(value), endAt(end), limit(max)),
    ).catch(() => ({ docs: [] })),
    getDocs(
      query(
        usersCol(),
        orderBy('displayNameLower'),
        startAt(value),
        endAt(end),
        limit(max),
      ),
    ).catch(() => ({ docs: [] })),
  ]);

  // Username hits: fetch the profiles they point at.
  const profileReads = byUsername.docs
    .map((d) => d.data())
    .filter((claim) => claim.uid && claim.uid !== excludeUid)
    .slice(0, max)
    .map((claim) => getUserProfile(claim.uid));
  const profiles = await Promise.all(profileReads);
  collect({ docs: byName.docs });
  for (const profile of profiles) {
    if (profile && profile.onboardingComplete && profile.uid !== excludeUid) {
      results.set(profile.uid, profile);
    }
  }

  return [...results.values()]
    .sort((a, b) => {
      const aExact = a.usernameLower === value ? 0 : 1;
      const bExact = b.usernameLower === value ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return (a.displayName || '').localeCompare(b.displayName || '');
    })
    .slice(0, max);
}

/** Fetch several profiles at once (deduped) for member cards. */
export async function getUserProfiles(uids) {
  const unique = [...new Set(uids)].filter(Boolean);
  const profiles = await Promise.all(unique.map((uid) => getUserProfile(uid)));
  return profiles.filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * Presence
 * ------------------------------------------------------------------ */

let heartbeatTimer = null;
let lastPresenceWrite = 0;

/**
 * Presence is a heartbeat, not a socket: the client marks itself online and
 * refreshes `lastActiveAt` every 45s while the tab is visible. Everyone else
 * derives "online" from a recent timestamp (see isUserOnline), so a crashed
 * browser can never leave a zombie "online" badge.
 */
export async function setPresence(uid, state = 'online') {
  if (!uid) return;
  const now = Date.now();
  if (state === 'online' && now - lastPresenceWrite < 15000) return;
  lastPresenceWrite = now;
  try {
    await updateDoc(userRef(uid), {
      presence: { state, lastActiveAt: serverTimestamp() },
    });
  } catch (error) {
    // Profile may be mid-creation; presence is never critical.
    if (!import.meta.env.PROD) console.warn('[chazter] presence write failed', error?.code);
  }
}

export function startPresenceHeartbeat(uid) {
  stopPresenceHeartbeat();
  const tick = () => {
    if (document.visibilityState === 'visible' && navigator.onLine !== false) {
      setPresence(uid, 'online');
    }
  };
  tick();
  heartbeatTimer = setInterval(tick, 45000);
  const onVisibility = () => {
    if (document.visibilityState === 'visible') setPresence(uid, 'online');
  };
  document.addEventListener('visibilitychange', onVisibility);
  heartbeatTimer.onVisibility = onVisibility;
  return stopPresenceHeartbeat;
}

export function stopPresenceHeartbeat() {
  if (!heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  if (heartbeatTimer.onVisibility) {
    document.removeEventListener('visibilitychange', heartbeatTimer.onVisibility);
  }
  heartbeatTimer = null;
}

/** Remove the profile and release the username claim. */
export async function deleteUserProfile(uid, usernameLower) {
  const batch = writeBatch(db);
  batch.delete(userRef(uid));
  if (usernameLower) batch.delete(usernameRef(usernameLower));
  await batch.commit();
}

/** Sign-up helper: reserve nothing, but verify the auth user has no profile. */
export async function profileExists(uid) {
  const snap = await getDoc(userRef(uid));
  return snap.exists();
}

export { setDoc, deleteDoc };
