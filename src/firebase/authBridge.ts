import type { User } from '../types';
import { parsePosturaClaims } from './claims';
import { getFirebaseAuth, ensureFirebaseApp } from './app';
import { readFirebaseConfig } from './config';

export type FirebaseAuthListener = (user: User | null) => void;

let unsubscribe: (() => void) | null = null;

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

  const { onAuthStateChanged } = await import('firebase/auth');
  unsubscribe?.();
  unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      listener(null);
      return;
    }
    try {
      const token = await fbUser.getIdTokenResult();
      listener(mapFirebaseUser(fbUser, parsePosturaClaims(token.claims)));
    } catch {
      listener(null);
    }
  });

  return () => {
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
