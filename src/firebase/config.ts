/**
 * Configuración Firebase para piloto multiusuario.
 * Las credenciales reales se inyectan vía variables de entorno en despliegue.
 */
export interface FirebaseRuntimeConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  useEmulators: boolean;
}

export function readFirebaseConfig(): FirebaseRuntimeConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`),
    projectId,
    storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`),
    messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
    appId: String(import.meta.env.VITE_FIREBASE_APP_ID || ''),
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
    useEmulators: import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true',
  };
}

export const FIREBASE_ENABLED = Boolean(readFirebaseConfig());
