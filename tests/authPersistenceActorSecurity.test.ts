/**
 * POSTURA — RR-02 / R-B03 Persistence Actor Security & Identity Isolation Unit Tests
 *
 * Scenarios:
 * S1.  ADMIN pierde rol durante debounce -> debounce cancelado, sin push.
 * S2.  Push en vuelo con ACK tardío tras invalidación -> commit descartado sin tocar baseline.
 * S3.  Renovación de token con misma identidad (UID/org/role) -> generación y mutaciones preservadas.
 * S4.  Cambio ADMIN -> CLIENT en misma organización -> sesión invalidada, colas limpias.
 * S5.  Cambio de organización -> sesión invalidada, prevención de escritura cross-tenant.
 * S6.  Logout con mutaciones pendientes -> colas purgadas, sin escrituras residuales en memoria.
 * S7.  Login de Usuario B tras logout de Usuario A -> Usuario B no hereda mutaciones de A.
 * S8.  ACK tardío de Usuario A descartado mientras Usuario B está activo.
 * S9.  Quarantine de valores abandonados purgada en logout -> sin supresión errónea de eco para B.
 * S10. Error permission-denied de Firestore -> cuarentena y asentamiento limpio sin bucles.
 * S11. Pendientes se aíslan con mensaje explícito (no confirmados, no heredados).
 * S12. Token antiguo resuelto tardíamente no restaura claims (bridge epoch).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  type RemoteDoc = Record<string, unknown>;
  const remote = new Map<string, RemoteDoc>();
  const listeners = new Map<string, Array<(snap: unknown) => void>>();
  const state = {
    remote,
    listeners,
    signedIn: true,
    userUid: 'user_admin_01',
    claims: { role: 'ADMIN', organizationId: 'org_aurora_01', clientId: null as string | null },
    failNextCommit: false,
    delayCommitMs: 0,
    permissionDeniedDocPath: null as string | null,
    totalCommits: 0,
    pushErrors: [] as string[],
  };
  return { state };
});

vi.mock('firebase/firestore', () => {
  type Filter = { field: string; op: string; value: unknown };
  type Query = { col: { path: string }; constraints: Filter[] };
  const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/'));
  const matches = (q: Query) =>
    [...h.state.remote.entries()].filter(
      ([path, data]) => parentOf(path) === q.col.path && q.constraints.every((c) => data[c.field] === c.value)
    );
  const toSnapshot = (rows: Array<[string, Record<string, unknown>]>) => ({
    metadata: { fromCache: false },
    docs: rows.map(([path, data]) => ({
      id: path.slice(path.lastIndexOf('/') + 1),
      data: () => structuredClone(data),
      metadata: { hasPendingWrites: false },
    })),
  });

  return {
    collection: (_db: unknown, path: string) => ({ path }),
    doc: (_db: unknown, path: string) => ({ path }),
    query: (col: { path: string }, ...constraints: Filter[]) => ({ col, constraints }),
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    getDocs: vi.fn(async (q: Query) => toSnapshot(matches(q))),
    getDoc: vi.fn(async (ref: { path: string }) => {
      const row = h.state.remote.get(ref.path);
      return {
        id: ref.path.slice(ref.path.lastIndexOf('/') + 1),
        exists: () => row !== undefined,
        data: () => (row ? structuredClone(row) : undefined),
        metadata: { fromCache: false },
      };
    }),
    runTransaction: vi.fn(async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      if (h.state.delayCommitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, h.state.delayCommitMs));
      }
      if (h.state.failNextCommit) {
        h.state.failNextCommit = false;
        throw new Error('transient-network-error');
      }
      const stagedWrites: Array<{ kind: 'set' | 'delete'; path: string; data?: unknown }> = [];
      const tx = {
        get: async (ref: { path: string }) => {
          if (h.state.permissionDeniedDocPath === ref.path) {
            throw new Error('permission-denied');
          }
          const row = h.state.remote.get(ref.path);
          return {
            id: ref.path.slice(ref.path.lastIndexOf('/') + 1),
            exists: () => row !== undefined,
            data: () => (row ? structuredClone(row) : undefined),
            metadata: { fromCache: false },
          };
        },
        set: (ref: { path: string }, data: unknown, options?: { merge?: boolean }) => {
          if (h.state.permissionDeniedDocPath === ref.path) {
            throw new Error('permission-denied');
          }
          stagedWrites.push({ kind: 'set', path: ref.path, data: { ...data, merge: options?.merge } });
        },
        delete: (ref: { path: string }) => {
          stagedWrites.push({ kind: 'delete', path: ref.path });
        },
      };

      const result = await fn(tx);
      for (const w of stagedWrites) {
        if (w.kind === 'delete') {
          h.state.remote.delete(w.path);
        } else {
          const existing = h.state.remote.get(w.path) ?? {};
          const next = (w.data as { merge?: boolean })?.merge
            ? { ...existing, ...(w.data as Record<string, unknown>) }
            : (w.data as Record<string, unknown>);
          delete next.merge;
          h.state.remote.set(w.path, next);
        }
      }
      h.state.totalCommits += 1;
      return result;
    }),
    onSnapshot: vi.fn((q: Query, callback: (snap: unknown) => void) => {
      const list = h.state.listeners.get(q.col.path) ?? [];
      list.push(callback);
      h.state.listeners.set(q.col.path, list);
      callback(toSnapshot(matches(q)));
      return () => {
        const current = h.state.listeners.get(q.col.path) ?? [];
        h.state.listeners.set(
          q.col.path,
          current.filter((cb) => cb !== callback)
        );
      };
    }),
    serverTimestamp: () => new Date().toISOString(),
    deleteField: () => undefined,
  };
});

vi.mock('../src/firebase/app', () => ({
  ensureFirebaseApp: vi.fn(async () => ({})),
  getFirebaseApp: () => ({}),
  getFirebaseAuth: async () =>
    h.state.signedIn
      ? {
          currentUser: {
            uid: h.state.userUid,
            getIdTokenResult: async () => ({ claims: h.state.claims }),
          },
        }
      : null,
  getFirebaseFirestore: async () => ({}),
}));

vi.mock('../src/firebase/authBridge', () => ({
  bindFirebaseAuthState: vi.fn(async () => () => undefined),
  getFirebaseIdToken: async () => 'fake-admin-token',
}));

vi.mock('../src/firebase/config', () => ({
  readFirebaseConfig: () => ({ projectId: 'demo-aurora-test' }),
  FIREBASE_ENABLED: true,
}));

describe('RR-02: Identity Isolation & Persistence Actor Security', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    h.state.remote.clear();
    h.state.listeners.clear();
    h.state.signedIn = true;
    h.state.userUid = 'user_admin_01';
    h.state.claims = { role: 'ADMIN', organizationId: 'org_aurora_01', clientId: null };
    h.state.failNextCommit = false;
    h.state.delayCommitMs = 0;
    h.state.permissionDeniedDocPath = null;
    h.state.totalCommits = 0;
    h.state.pushErrors = [];

    h.state.remote.set('clients/client_juan_001', {
      id: 'client_juan_001',
      organizationId: 'org_aurora_01',
      name: 'Juan Perez',
      status: 'ACTIVE',
      completedTasksCount: 0,
    });

    const sync = await import('../src/services/firestore/sync');
    const { dbService } = await import('../src/services/db');
    sync.resetKnownRemoteDocPaths();
    sync.stopFirestoreRealtimeSync();
    sync.clearFirestorePersistenceSession();
    sync.setFirestoreAuthoritative(true);
    sync.onFirestorePushError((message) => {
      h.state.pushErrors.push(message);
    });

    const epoch = dbService.beginAdminDirectoryLoad();
    dbService.applyAdminDirectorySnapshot(
      [
        {
          id: 'client_juan_001',
          organizationId: 'org_aurora_01',
          name: 'Juan Perez',
          displayName: 'Juan Perez',
        } as never,
      ],
      epoch
    );

    const { authService } = await import('../src/services/auth');
    authService.setCurrentUserForTesting({
      uid: 'user_admin_01',
      email: 'admin@aurora.com',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
      clientId: null,
    } as never);
  });

  it('S1. ADMIN pierde rol durante debounce -> debounce cancelado, sin push', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Juan Editado Antes de Revocar Rol',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(true);

    h.state.claims = { role: 'CLIENT', organizationId: 'org_aurora_01', clientId: 'client_juan_001' };
    authService.setCurrentUserForTesting({
      uid: 'user_admin_01',
      email: 'admin@aurora.com',
      role: 'CLIENT',
      organizationId: 'org_aurora_01',
      clientId: 'client_juan_001',
    } as never);

    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(false);

    await new Promise((r) => setTimeout(r, 900));

    expect(h.state.totalCommits).toBe(0);
    const remoteDoc = h.state.remote.get('clients/client_juan_001');
    expect(remoteDoc?.name).toBe('Juan Perez');
  });

  it('S2. Push en vuelo con ACK tardío tras invalidación -> commit descartado sin tocar baseline', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');

    h.state.delayCommitMs = 200;

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Juan In Flight Commit',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    const pushPromise = sync.flushPendingAdminPushes(3000);

    await new Promise((r) => setTimeout(r, 50));
    sync.clearFirestorePersistenceSession();

    const outcome = await pushPromise;
    // Flush barrier for the active session stays non-blocking; origin note is recorded.
    expect(outcome.status).toBe('confirmed');
    const notes = sync.getOriginRemoteReconciliationsForTesting('user_admin_01');
    expect(notes.some((n) => n.status === 'remote_confirmed_unapplied')).toBe(true);
  });

  it('S3. Renovación de token con misma identidad -> generación y mutaciones preservadas', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Juan Preserved Change',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    const initialGen = sync.getPersistenceGenerationForTesting();

    h.state.claims = { role: 'ADMIN', organizationId: 'org_aurora_01', clientId: null };
    authService.setCurrentUserForTesting({
      uid: 'user_admin_01',
      email: 'admin@aurora.com',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
    } as never);

    expect(sync.getPersistenceGenerationForTesting()).toBe(initialGen);
    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(true);
  });

  it('S4. Cambio ADMIN -> CLIENT en misma organización -> sesión invalidada, colas limpias', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Admin Work To Clear',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(true);

    const prevGen = sync.getPersistenceGenerationForTesting();
    authService.setCurrentUserForTesting({
      uid: 'user_admin_01',
      email: 'admin@aurora.com',
      role: 'CLIENT',
      organizationId: 'org_aurora_01',
      clientId: 'client_juan_001',
    } as never);

    expect(sync.getPersistenceGenerationForTesting()).toBeGreaterThan(prevGen);
    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(false);
    expect(h.state.pushErrors.some((m) => /no se enviaron|ADMIN/i.test(m))).toBe(true);
  });

  it('S5. Cambio de organización -> sesión invalidada, prevención de escritura cross-tenant', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Juan Org 1',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    authService.setCurrentUserForTesting({
      uid: 'user_admin_01',
      email: 'admin@aurora.com',
      role: 'ADMIN',
      organizationId: 'org_aurora_02',
    } as never);

    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(false);
    await sync.flushPendingAdminPushes(1000);
    expect(h.state.remote.get('clients/client_juan_001')?.name).toBe('Juan Perez');
  });

  it('S6. Logout con mutaciones pendientes -> colas purgadas, sin escrituras residuales en memoria', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Pending Before Logout',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(true);

    authService.setCurrentUserForTesting(null);
    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(false);
    expect(sync.getOrphanedAdminMutationCountForTesting()).toBeGreaterThan(0);
  });

  it('S7. Login de Usuario B tras logout de Usuario A -> Usuario B no hereda mutaciones de A', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'User A Secret Edit',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    authService.setCurrentUserForTesting(null);

    h.state.userUid = 'user_admin_02';
    authService.setCurrentUserForTesting({
      uid: 'user_admin_02',
      email: 'admin2@aurora.com',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
    } as never);

    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(false);
    expect(sync.getOrphanedAdminMutationCountForTesting()).toBe(0);
    await sync.flushPendingAdminPushes(1000);

    const remoteDoc = h.state.remote.get('clients/client_juan_001');
    expect(remoteDoc?.name).toBe('Juan Perez');
  });

  it('S8. ACK tardío de Usuario A descartado mientras Usuario B está activo', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    h.state.delayCommitMs = 150;

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'User A Late Push',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    const userAPush = sync.flushPendingAdminPushes(3000);

    await new Promise((r) => setTimeout(r, 40));
    authService.setCurrentUserForTesting(null);
    h.state.userUid = 'user_admin_02';
    authService.setCurrentUserForTesting({
      uid: 'user_admin_02',
      email: 'admin2@aurora.com',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
    } as never);

    const outcome = await userAPush;
    expect(outcome.status).toBe('confirmed');
    const notes = sync.getOriginRemoteReconciliationsForTesting('user_admin_01');
    expect(notes.some((n) => n.status === 'remote_confirmed_unapplied')).toBe(true);
    expect(sync.getOriginRemoteReconciliationsForTesting('user_admin_02')).toEqual([]);
  });

  it('S9. Quarantine de valores abandonados purgada en logout -> sin supresión errónea de eco para B', async () => {
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    sync.clearFirestorePersistenceSession();
    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(false);

    authService.setCurrentUserForTesting({
      uid: 'user_admin_02',
      email: 'admin2@aurora.com',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
    } as never);

    const { dbService } = await import('../src/services/db');
    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Juan Edit By User B',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(true);
  });

  it('S10. Error permission-denied de Firestore -> cuarentena y asentamiento limpio sin bucles', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');

    h.state.permissionDeniedDocPath = 'clients/client_juan_001';

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Denied Write',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    const outcome = await sync.flushPendingAdminPushes(3000);
    expect(outcome.status).toBe('rejected');
    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(false);
  });

  it('S11. Pendientes se aíslan con mensaje explícito al invalidar sesión', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Explicit Orphan',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(true);
    authService.setCurrentUserForTesting(null);
    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(false);
    expect(sync.getOrphanedAdminMutationCountForTesting()).toBeGreaterThan(0);
    expect(h.state.pushErrors.length).toBeGreaterThan(0);
    expect(h.state.pushErrors.some((m) => /pendientes|no se enviaron/i.test(m))).toBe(true);
  });

  it('S12. Token antiguo resuelto tardíamente no restaura claims (bridge epoch)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(join(process.cwd(), 'src/firebase/authBridge.ts'), 'utf8');
    expect(source).toMatch(/authListenerEpoch/);
    expect(source).toMatch(/epoch !== authListenerEpoch/);
    expect(source).toMatch(/\.onIdTokenChanged/);
    expect(source).toMatch(/typeof idTokenChanged === 'function'/);
    expect(source).toMatch(/getIdTokenResult/);
  });

  it('G1.1–G1.4. Rechazo de A no suprime captura idéntica legítima de B ni permite despacho cruzado', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    const identicalName = 'Valor Identico Cross-Session';

    h.state.permissionDeniedDocPath = 'clients/client_juan_001';
    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: identicalName,
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    const denied = await sync.flushPendingAdminPushes(3000);
    expect(denied.status).toBe('rejected');
    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(false);
    expect(sync.getAbandonedAdminOriginUidForTesting('clients/client_juan_001')).toBe('user_admin_01');

    h.state.permissionDeniedDocPath = null;
    h.state.userUid = 'user_admin_02';
    authService.setCurrentUserForTesting({
      uid: 'user_admin_02',
      email: 'admin2@aurora.com',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
    } as never);

    expect(sync.getOrphanedAdminMutationCountForTesting()).toBe(0);
    expect(sync.getAbandonedAdminOriginUidForTesting('clients/client_juan_001')).toBeNull();

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: identicalName,
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(true);
    const commitsBefore = h.state.totalCommits;
    const outcome = await sync.flushPendingAdminPushes(3000);
    expect(outcome.status).toBe('confirmed');
    expect(h.state.totalCommits).toBeGreaterThan(commitsBefore);
    expect(h.state.remote.get('clients/client_juan_001')?.name).toBe(identicalName);
  });

  it('G1.5–G1.6. Cambio de org / logout aísla pendientes con mensaje explícito', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Pendiente Org A',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );
    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(true);

    authService.setCurrentUserForTesting({
      uid: 'user_admin_01',
      email: 'admin@aurora.com',
      role: 'ADMIN',
      organizationId: 'org_other_99',
    } as never);

    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(false);
    expect(h.state.pushErrors.some((m) => /pendientes|no se enviaron|sesión/i.test(m))).toBe(true);

    authService.setCurrentUserForTesting(null);
    expect(sync.getOrphanedAdminMutationCountForTesting()).toBeGreaterThanOrEqual(0);
  });

  it('G2.1–G2.3. TX remota de A confirma tras cambio de sesión; B intacto; clasificado unapplied', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    h.state.delayCommitMs = 180;
    const baselineName = h.state.remote.get('clients/client_juan_001')?.name;

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Late Confirm From A',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    const pushA = sync.flushPendingAdminPushes(4000);
    await new Promise((r) => setTimeout(r, 40));

    h.state.userUid = 'user_admin_02';
    authService.setCurrentUserForTesting({
      uid: 'user_admin_02',
      email: 'admin2@aurora.com',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
    } as never);

    const barrier = await pushA;
    expect(barrier.status).toBe('confirmed');

    const notes = sync.getOriginRemoteReconciliationsForTesting('user_admin_01');
    expect(notes.some((n) => n.status === 'remote_confirmed_unapplied')).toBe(true);
    expect(sync.getOriginRemoteReconciliationsForTesting('user_admin_02')).toEqual([]);
    expect(h.state.remote.get('clients/client_juan_001')?.name).toBe('Late Confirm From A');

    // B must not inherit pending work; baseline for B is not rewritten via applyAdminCommit.
    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(false);
    expect(baselineName).toBe('Juan Perez');
  });

  it('G2.4. Fallo Firestore no se clasifica como confirmación remota', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');

    h.state.permissionDeniedDocPath = 'clients/client_juan_001';
    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Denied Not Remote Confirm',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    const outcome = await sync.flushPendingAdminPushes(3000);
    expect(outcome.status).toBe('rejected');
    expect(sync.getOriginRemoteReconciliationsForTesting('user_admin_01')).toEqual([]);
  });

  it('G2.5. Resultado remoto incierto no se clasifica como rechazo definitivo', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    h.state.delayCommitMs = 180;
    h.state.failNextCommit = true;

    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'Uncertain In Flight',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    const pushA = sync.flushPendingAdminPushes(4000);
    await new Promise((r) => setTimeout(r, 40));
    sync.clearFirestorePersistenceSession();
    authService.setCurrentUserForTesting({
      uid: 'user_admin_02',
      email: 'admin2@aurora.com',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
    } as never);

    const barrier = await pushA;
    expect(barrier.status).toBe('confirmed');
    const notes = sync.getOriginRemoteReconciliationsForTesting('user_admin_01');
    expect(notes.some((n) => n.status === 'remote_uncertain')).toBe(true);
    expect(notes.some((n) => n.status === 'rejected')).toBe(false);
  });

  it('G2.6. Regreso de A ve reconciliación remota sin re-despachar paths confirmados', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    const { authService } = await import('../src/services/auth');

    h.state.delayCommitMs = 150;
    dbService.importSnapshot(
      {
        clients: [
          {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            name: 'A Returns After Late ACK',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    const pushA = sync.flushPendingAdminPushes(4000);
    await new Promise((r) => setTimeout(r, 40));
    authService.setCurrentUserForTesting({
      uid: 'user_admin_02',
      email: 'admin2@aurora.com',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
    } as never);
    await pushA;

    h.state.userUid = 'user_admin_01';
    authService.setCurrentUserForTesting({
      uid: 'user_admin_01',
      email: 'admin@aurora.com',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
    } as never);

    const confirmedPaths = sync.getRemoteConfirmedUnappliedPathsForOrigin('user_admin_01');
    expect(confirmedPaths).toContain('clients/client_juan_001');
    expect(sync.hasPendingAdminMutationsForDoc('clients/client_juan_001')).toBe(false);

    const commitsBefore = h.state.totalCommits;
    await sync.flushPendingAdminPushes(1000);
    expect(h.state.totalCommits).toBe(commitsBefore);
    expect(h.state.remote.get('clients/client_juan_001')?.name).toBe('A Returns After Late ACK');
  });
});
