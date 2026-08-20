import { readFirebaseConfig, type FirebaseRuntimeConfig } from './config';

let initPromise: Promise<boolean> | null = null;
let firebaseApp: import('firebase/app').FirebaseApp | null = null;

export function getFirebaseConfig(): FirebaseRuntimeConfig | null {
  return readFirebaseConfig();
}

export async function ensureFirebaseApp(): Promise<import('firebase/app').FirebaseApp | null> {
  const config = readFirebaseConfig();
  if (!config) return null;

  if (firebaseApp) return firebaseApp;

  if (!initPromise) {
    initPromise = (async () => {
      const { initializeApp, getApps } = await import('firebase/app');
      firebaseApp = getApps()[0] || initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
        measurementId: config.measurementId,
      });

      if (config.useEmulators) {
        await connectEmulators(config);
      }
      return true;
    })();
  }

  await initPromise;
  return firebaseApp;
}

async function connectEmulators(_config: FirebaseRuntimeConfig) {
  const app = firebaseApp;
  if (!app) return;

  const [
    { getAuth, connectAuthEmulator },
    { getFirestore, connectFirestoreEmulator },
    { getStorage, connectStorageEmulator },
  ] = await Promise.all([
    import('firebase/auth'),
    import('firebase/firestore'),
    import('firebase/storage'),
  ]);

  connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
  connectStorageEmulator(getStorage(app), '127.0.0.1', 9199);
}

export async function getFirebaseAuth() {
  const app = await ensureFirebaseApp();
  if (!app) return null;
  const { getAuth } = await import('firebase/auth');
  return getAuth(app);
}

export async function getFirebaseFirestore() {
  const app = await ensureFirebaseApp();
  if (!app) return null;
  const { getFirestore } = await import('firebase/firestore');
  return getFirestore(app);
}

export async function getFirebaseStorage() {
  const app = await ensureFirebaseApp();
  if (!app) return null;
  const { getStorage } = await import('firebase/storage');
  return getStorage(app);
}
