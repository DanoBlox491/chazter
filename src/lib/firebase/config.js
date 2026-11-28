/**
 * Firebase web configuration for the Chazter project.
 *
 * NOTE ON SECRETS
 * ---------------
 * These values are *not* secrets. Firebase web API keys only identify the
 * project — every request is authorised by Firebase Security Rules and by
 * the App Check / auth domain restrictions you configure in the console.
 * They are safe to ship to the browser and to commit. Private credentials
 * (service accounts, Admin SDK keys) must NEVER be placed in this repo.
 *
 * Values are read from Vite env vars when present so that a fork can point
 * at its own Firebase project via `.env.local`. The committed defaults keep
 * the deployed Chazter build working out of the box.
 */

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBzlrDwm6TCuVY6BvKWD0lfzC-23p8u9ZA',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'chazter-fcf99.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'chazter-fcf99',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'chazter-fcf99.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '668136454225',
  appId: env.VITE_FIREBASE_APP_ID || '1:668136454225:web:536b2e1f3ca56827752070',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-7JQHPN0SVX',
};

/** Optional: image sharing works only once Storage is enabled + configured. */
export const storageBucketUrl =
  env.VITE_FIREBASE_STORAGE_BUCKET_URL || `gs://${firebaseConfig.storageBucket}`;

/** Emulator support for local development (`npm run dev:emulators`). */
export const emulatorConfig = {
  enabled: env.VITE_USE_FIREBASE_EMULATORS === 'true',
  authHost: env.VITE_EMULATOR_AUTH_HOST || '127.0.0.1',
  firestoreHost: env.VITE_EMULATOR_FIRESTORE_HOST || '127.0.0.1',
  authPort: Number(env.VITE_EMULATOR_AUTH_PORT || 9099),
  firestorePort: Number(env.VITE_EMULATOR_FIRESTORE_PORT || 8080),
  storagePort: Number(env.VITE_EMULATOR_STORAGE_PORT || 9199),
};
