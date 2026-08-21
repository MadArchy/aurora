/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_FIREBASE_USE_EMULATORS?: string;
  /** Base URL Cloud Functions (prod). Ej: https://us-central1-aurora-postura-app.cloudfunctions.net */
  readonly VITE_POSTURA_FUNCTIONS_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
