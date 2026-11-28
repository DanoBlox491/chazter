/**
 * Single Firebase bootstrap for the whole app.
 *
 * Everything that talks to Firebase imports the lazy handles from here so the
 * SDK is initialised exactly once and code-split cleanly by Vite.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { firebaseConfig, emulatorConfig } from './config.js';

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);

/**
 * Firestore with a persistent (IndexedDB) local cache.
 *
 * The cache gives us offline reads, instant re-opening of recent chats and —
 * importantly — cheap real-time listeners that resume without a round trip.
 * `persistentMultipleTabManager` keeps several tabs in sync.
 */
let dbInstance;
function createFirestore() {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch (error) {
    // initializeFirestore throws if it was already initialised (HMR / double import).
    if (error?.code === 'failed-precondition' || /already been called/i.test(error?.message || '')) {
      return getFirestore(firebaseApp);
    }
    // Private browsing modes without IndexedDB: fall back to memory cache.
    console.warn('[chazter] Falling back to in-memory Firestore cache.', error);
    return getFirestore(firebaseApp);
  }
}
dbInstance = createFirestore();
export const db = dbInstance;

/** Storage is optional — image uploads degrade gracefully when unavailable. */
export const storage = getStorage(firebaseApp);

if (emulatorConfig.enabled) {
  const { authHost, firestoreHost, authPort, firestorePort, storagePort } = emulatorConfig;
  connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, firestoreHost, firestorePort);
  connectStorageEmulator(storage, firestoreHost, storagePort);
  console.info('[chazter] Firebase emulators connected.');
}
