import type { User } from '../types';
import { parsePosturaClaims } from './claims';
import { getFirebaseAuth, ensureFirebaseApp } from './app';
import { readFirebaseConfig } from './config';

export type FirebaseAuthListener = (user: User | null) => void;

let unsubscribe: (() => void) | null = null;
/** Bumped on rebind/unsubscribe so in-flight getIdTokenResult callbacks cannot restore stale claims. */
let authListenerEpoch = 0;

function mapFirebaseUser(
  fbUser: import('firebase/auth').User,
  claims: ReturnType<typeof parsePosturaClaims>
): User | null {
  if (!claims) return null;
  const isAdmin = claims.role === 'ADMIN';
  return {
    uid: fbUser.uid,
    organizationId: claims.organizationId,
    email: fbUser.email || '',
    displayName: fbUser.displayName || (isAdmin ? 'Brand Manager' : fbUser.email || 'Cliente'),
    role: claims.role,
    status: 'ACTIVE',
    clientId: claims.clientId ?? null,
    managerId: isAdmin ? null : 'user_admin_01',
    mustCompleteOnboarding: false,
    aiKeyManagementAllowed: isAdmin,
    locale: 'es-ES',
    timezone: 'America/Bogota',
    lastLoginAt: new Date().toISOString(),
    createdAt: '2026-08-01T00:00:00Z',
    createdBy: 'firebase',
    updatedAt: new Date().toISOString(),
    updatedBy: 'firebase',
  };
}

export async function firebaseSignIn(
  email: string,
  password: string
): Promise<{ ok: true; user: User } | { ok: false; message: string }> {
  if (!readFirebaseConfig()) return { ok: false, message: 'Firebase no configurado.' };
  await ensureFirebaseApp();
  const auth = await getFirebaseAuth();
  if (!auth) return { ok: false, message: 'Firebase Auth no disponible.' };

  try {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const token = await credential.user.getIdTokenResult(true);
    const claims = parsePosturaClaims(token.claims);
    const user = mapFirebaseUser(credential.user, claims);
    if (!user) return { ok: false, message: 'La cuenta no tiene permisos POSTURA (custom claims).' };
    return { ok: true, user };
  } catch {
    return { ok: false, message: 'Credenciales inválidas o cuenta no provisionada en Firebase.' };
  }
}

export async function firebaseSignOut(): Promise<void> {
  const auth = await getFirebaseAuth();
  if (!auth) return;
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

export async function bindFirebaseAuthState(listener: FirebaseAuthListener): Promise<() => void> {
  if (!readFirebaseConfig()) return () => undefined;
  await ensureFirebaseApp();
  const auth = await getFirebaseAuth();
  if (!auth) return () => undefined;

  const authModule = await import('firebase/auth');
  /**
   * Prefer onIdTokenChanged when the modular export is a function (real Firebase Auth).
   * Do not treat a missing instance method as success — fall back only when the export is absent.
   * Access via Record so incomplete ambient stubs (without onIdTokenChanged) still typecheck;
   * runtime uses the real modular export from the installed Firebase package.
   */
  type AuthStateSubscribe = typeof authModule.onAuthStateChanged;
  const idTokenChanged = (authModule as Record<string, unknown>).onIdTokenChanged;
  const subscribeAuth: AuthStateSubscribe =
    typeof idTokenChanged === 'function'
      ? (idTokenChanged as AuthStateSubscribe)
      : authModule.onAuthStateChanged;

  unsubscribe?.();
  const epoch = ++authListenerEpoch;
  unsubscribe = subscribeAuth(auth, async (fbUser: import('firebase/auth').User | null) => {
    if (epoch !== authListenerEpoch) return;
    if (!fbUser) {
      listener(null);
      return;
    }
    try {
      const token = await fbUser.getIdTokenResult();
      if (epoch !== authListenerEpoch) return;
      listener(mapFirebaseUser(fbUser, parsePosturaClaims(token.claims)));
    } catch {
      if (epoch !== authListenerEpoch) return;
      listener(null);
    }
  });

  return () => {
    authListenerEpoch += 1;
    unsubscribe?.();
    unsubscribe = null;
  };
}

export async function getFirebaseIdToken(): Promise<string | null> {
  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  return token;
}
