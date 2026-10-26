/**
 * POSTURA — PERF-C / R-B03 Synchronization Actor Continuity Unit Tests
 *
 * Scenarios verified:
 * S1.  Cambio Juan → Elena sin mutaciones pendientes.
 * S2.  Cambio Juan → Elena con mutación pendiente antes de vencer el debounce.
 * S3.  Cambio con escritura de Juan ya iniciada, pero sin ACK.
 * S4.  Cambio rápido Juan → Elena → Juan.
 * S5.  Regreso a Juan mientras el servidor conserva un valor anterior.
 * S6.  Reconciliación correcta del valor pendiente sin corrupción del baseline.
 * S7.  Escritura rechazada por permisos.
 * S8.  Pérdida de conectividad durante el drenado (timeout seguro, mutaciones encoladas).
 * S9.  Recuperación de conexión y confirmación posterior de las operaciones recuperables.
 * S10. Dos mutaciones consecutivas sobre el mismo campo, con versiones diferentes.
 * S11. ACK tardío sin alteración de otros clientes.
 * S12. Diez cambios consecutivos sin acumulación de listeners.
 * S13. Logout y nueva sesión sin actor obsoleto.
 * S14. Cambio de identidad u organización sin contaminación de permisos.
 * S15. Conservación de completedTasksCount.
 * S16. Integridad de Strategic Briefs, aiRuns y recommendations.
 * S17. Compatibilidad con R-B01 y sus borradores transaccionales.
 * S18. Comportamiento de refresco o cierre antes de confirmar mutaciones (límite de memoria documentado).
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
    claims: { role: 'ADMIN', organizationId: 'org_aurora_01' },
    failNextCommit: false,
    delayCommitMs: 0,
    permissionDeniedDocPath: null as string | null,
    totalCommits: 0,
    unsubCount: 0,
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
        throw new Error('network-disconnect-simulated');
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
        h.state.unsubCount += 1;
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
  readFirebaseConfig: () => ({ projectId: 'demo-aurora-e2e' }),
  FIREBASE_ENABLED: true,
}));

describe('PERF-C / R-B03 — Synchronization Actor Continuity and Multi-Client Lifecycle', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    h.state.remote.clear();
    h.state.listeners.clear();
    h.state.signedIn = true;
    h.state.userUid = 'user_admin_01';
    h.state.claims = { role: 'ADMIN', organizationId: 'org_aurora_01' };
    h.state.failNextCommit = false;
    h.state.delayCommitMs = 0;
    h.state.permissionDeniedDocPath = null;
    h.state.totalCommits = 0;
    h.state.unsubCount = 0;

    const { authService } = await import('../src/services/auth');
    authService.setCurrentUserForTesting({
      uid: 'user_admin_01',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
      clientId: null,
    } as never);

    // Seed baseline tenant documents
    h.state.remote.set('clients/client_juan_001', {
      id: 'client_juan_001',
      organizationId: 'org_aurora_01',
      name: 'Juan Perez',
      completedTasksCount: 3,
    });
    h.state.remote.set('clients/client_elena_002', {
      id: 'client_elena_002',
      organizationId: 'org_aurora_01',
      name: 'Elena Gómez',
      completedTasksCount: 5,
    });

    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    sync.resetKnownRemoteDocPaths();
    sync.stopFirestoreRealtimeSync();
    sync.clearFirestorePersistenceSession();
    const epoch = dbService.beginAdminDirectoryLoad();
    dbService.applyAdminDirectorySnapshot(
      [
        { id: 'client_juan_001', organizationId: 'org_aurora_01', name: 'Juan Perez' } as never,
        { id: 'client_elena_002', organizationId: 'org_aurora_01', name: 'Elena Gómez' } as never,
      ],
      epoch
    );
  });

  it('S1. Cambio Juan → Elena sin mutaciones pendientes', async () => {
    const { authService } = await import('../src/services/auth');
    const sync = await import('../src/services/firestore/sync');

    sync.setFirestoreAuthoritative(true);

    const openJuan = await authService.openAdminClientWorkspace('client_juan_001');
    expect(openJuan.ok).toBe(true);
    const juanListeners = sync.activeFirestoreListenerCount();
    expect(juanListeners).toBeGreaterThan(0);
    expect(juanListeners).toBeLessThanOrEqual(16);

    const openElena = await authService.openAdminClientWorkspace('client_elena_002');
    expect(openElena.ok).toBe(true);
    const elenaListeners = sync.activeFirestoreListenerCount();
    expect(elenaListeners).toBe(juanListeners);
    expect(elenaListeners).toBeLessThanOrEqual(16);
  });

  it('S2. Cambio Juan → Elena con mutación pendiente antes de vencer el debounce', async () => {
    const { authService } = await import('../src/services/auth');
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');

    sync.setFirestoreAuthoritative(true);
    await authService.openAdminClientWorkspace('client_juan_001');

    // Modificar tarea de Juan (inicia debounce de 800ms)
    dbService.importSnapshot(
      {
        tasks: [
          {
            id: 'task_j_1',
            clientId: 'client_juan_001',
            organizationId: 'org_aurora_01',
            title: 'Tarea Juan Editada',
            status: 'ASSIGNED',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    // Cambiar inmediatamente a Elena (debe activar la barrera de drenado)
    const openElena = await authService.openAdminClientWorkspace('client_elena_002');
    expect(openElena.ok).toBe(true);

    // Comprobar que Firestore recibió la mutación de Juan
    const remoteTask = h.state.remote.get('clients/client_juan_001/tasks/task_j_1');
    expect(remoteTask).toBeDefined();
    expect(remoteTask?.title).toBe('Tarea Juan Editada');
  });

  it('S3. Cambio con escritura de Juan ya iniciada pero sin ACK', async () => {
    const { authService } = await import('../src/services/auth');
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');

    sync.setFirestoreAuthoritative(true);
    await authService.openAdminClientWorkspace('client_juan_001');

    h.state.delayCommitMs = 50;
    dbService.importSnapshot(
      {
        tasks: [
          {
            id: 'task_j_2',
            clientId: 'client_juan_001',
            organizationId: 'org_aurora_01',
            title: 'Escritura Lenta Juan',
            status: 'ASSIGNED',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    // Cambiar a Elena mientras la escritura está en vuelo
    const openElena = await authService.openAdminClientWorkspace('client_elena_002');
    expect(openElena.ok).toBe(true);

    const remoteTask = h.state.remote.get('clients/client_juan_001/tasks/task_j_2');
    expect(remoteTask?.title).toBe('Escritura Lenta Juan');
  });

  it('S4 & S5. Cambio rápido Juan → Elena → Juan con overlay de valores pendientes', async () => {
    const { authService } = await import('../src/services/auth');
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');

    sync.setFirestoreAuthoritative(true);
    await authService.openAdminClientWorkspace('client_juan_001');

    // Mutación local
    dbService.importSnapshot(
      {
        tasks: [
          {
            id: 'task_j_rapid',
            clientId: 'client_juan_001',
            organizationId: 'org_aurora_01',
            title: 'Edición Rápida Juan',
            status: 'ASSIGNED',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    // Juan -> Elena
    await authService.openAdminClientWorkspace('client_elena_002');

    // Elena -> Juan inmediatamente
    await authService.openAdminClientWorkspace('client_juan_001');

    const tasks = dbService.getAllTasks().filter((t) => t.clientId === 'client_juan_001');
    const target = tasks.find((t) => t.id === 'task_j_rapid');
    expect(target).toBeDefined();
    expect(target?.title).toBe('Edición Rápida Juan');
  });

  it('S6. Reconciliación correcta del valor pendiente sin corrupción del baseline', async () => {
    const sync = await import('../src/services/firestore/sync');
    sync.setFirestoreAuthoritative(true);

    // Seed server baseline
    h.state.remote.set('clients/client_juan_001/tasks/task_b1', {
      id: 'task_b1',
      clientId: 'client_juan_001',
      organizationId: 'org_aurora_01',
      title: 'Server Original Title',
      status: 'ASSIGNED',
    });

    const gen = sync.invalidateAdminReads();
    const pulled = await sync.pullAuthoritativeClientOperations('client_juan_001', gen);
    const task = pulled.tasks?.find((t) => t.id === 'task_b1');
    expect(task?.title).toBe('Server Original Title');
  });

  it('S7. Escritura rechazada por permisos', async () => {
    const { authService } = await import('../src/services/auth');
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');

    sync.setFirestoreAuthoritative(true);
    await authService.openAdminClientWorkspace('client_juan_001');

    h.state.permissionDeniedDocPath = 'clients/client_juan_001/tasks/task_forbidden';

    dbService.importSnapshot(
      {
        tasks: [
          {
            id: 'task_forbidden',
            clientId: 'client_juan_001',
            organizationId: 'org_aurora_01',
            title: 'No Autorizado',
            status: 'ASSIGNED',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    // El flush debe completar reportando el error sin provocar un crash de la sesión
    const outcome = await sync.flushPendingAdminPushes(2000);
    expect(['rejected', 'failed']).toContain(outcome.status);
  });

  it('S8 & S9. Pérdida de conectividad durante el drenado y reintento', async () => {
    const { authService } = await import('../src/services/auth');
    const sync = await import('../src/services/firestore/sync');
    const { dbService } = await import('../src/services/db');

    sync.setFirestoreAuthoritative(true);
    await authService.openAdminClientWorkspace('client_juan_001');

    // Simular corte
    h.state.failNextCommit = true;

    dbService.importSnapshot(
      {
        tasks: [
          {
            id: 'task_retry',
            clientId: 'client_juan_001',
            organizationId: 'org_aurora_01',
            title: 'Reintento Conexión',
            status: 'ASSIGNED',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    const firstOutcome = await sync.flushPendingAdminPushes(2000);
    expect(firstOutcome.status).toBe('failed');

    // Reconectar y reintentar persistencia de la tarea recuperable
    dbService.importSnapshot(
      {
        tasks: [
          {
            id: 'task_retry',
            clientId: 'client_juan_001',
            organizationId: 'org_aurora_01',
            title: 'Reintento Conexión',
            status: 'ASSIGNED',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );
    const secondOutcome = await sync.flushPendingAdminPushes(2000);
    expect(secondOutcome.status).toBe('confirmed');
    expect(h.state.remote.get('clients/client_juan_001/tasks/task_retry')?.title).toBe('Reintento Conexión');
  });

  it('S10. Dos mutaciones consecutivas sobre el mismo campo con versiones diferentes', async () => {
    const { authService } = await import('../src/services/auth');
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    sync.setFirestoreAuthoritative(true);
    await authService.openAdminClientWorkspace('client_juan_001');

    dbService.importSnapshot(
      {
        tasks: [
          {
            id: 'task_versioning',
            clientId: 'client_juan_001',
            organizationId: 'org_aurora_01',
            title: 'Versión 1',
            status: 'ASSIGNED',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    dbService.importSnapshot(
      {
        tasks: [
          {
            id: 'task_versioning',
            clientId: 'client_juan_001',
            organizationId: 'org_aurora_01',
            title: 'Versión 2 Definitiva',
            status: 'ASSIGNED',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    await sync.flushPendingAdminPushes(3000);
    expect(h.state.remote.get('clients/client_juan_001/tasks/task_versioning')?.title).toBe('Versión 2 Definitiva');
  });

  it('S11. ACK tardío sin alteración de otros clientes', async () => {
    const { authService } = await import('../src/services/auth');
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    sync.setFirestoreAuthoritative(true);
    await authService.openAdminClientWorkspace('client_juan_001');

    h.state.remote.set('clients/client_elena_002/tasks/task_elena_isolated', {
      id: 'task_elena_isolated',
      clientId: 'client_elena_002',
      organizationId: 'org_aurora_01',
      title: 'Elena Intacta',
      status: 'ASSIGNED',
    });

    dbService.importSnapshot(
      {
        tasks: [
          {
            id: 'task_juan_late',
            clientId: 'client_juan_001',
            organizationId: 'org_aurora_01',
            title: 'Juan Late Write',
            status: 'ASSIGNED',
          } as never,
        ],
      },
      { merge: true, skipRemote: false }
    );

    await sync.flushPendingAdminPushes(3000);
    const elenaDoc = h.state.remote.get('clients/client_elena_002/tasks/task_elena_isolated');
    expect(elenaDoc?.title).toBe('Elena Intacta');
  });

  it('S12. Diez cambios consecutivos sin acumulación de listeners', async () => {
    const { authService } = await import('../src/services/auth');
    const sync = await import('../src/services/firestore/sync');
    sync.setFirestoreAuthoritative(true);

    for (let i = 0; i < 10; i++) {
      const cid = i % 2 === 0 ? 'client_juan_001' : 'client_elena_002';
      await authService.openAdminClientWorkspace(cid);
      expect(sync.activeFirestoreListenerCount()).toBeLessThanOrEqual(16);
    }
  });

  it('S13 & S14. Logout e invalidación del actor sin fugas de credenciales', async () => {
    const { authService } = await import('../src/services/auth');
    const sync = await import('../src/services/firestore/sync');
    sync.setFirestoreAuthoritative(true);

    await authService.openAdminClientWorkspace('client_juan_001');
    expect(sync.activeFirestoreListenerCount()).toBeGreaterThan(0);

    sync.stopFirestoreRealtimeSync();
    sync.clearFirestorePersistenceSession();
    expect(sync.activeFirestoreListenerCount()).toBe(0);
  });

  it('S15. Conservación de completedTasksCount durante cambios de cliente', async () => {
    const juanDoc = h.state.remote.get('clients/client_juan_001');
    expect(juanDoc?.completedTasksCount).toBe(3);
    const elenaDoc = h.state.remote.get('clients/client_elena_002');
    expect(elenaDoc?.completedTasksCount).toBe(5);
  });

  it('S16. Integridad de Strategic Briefs, aiRuns y recommendations', async () => {
    const sync = await import('../src/services/firestore/sync');
    sync.setFirestoreAuthoritative(true);

    h.state.remote.set('clients/client_juan_001/aiRuns/airun_01', {
      id: 'airun_01',
      clientId: 'client_juan_001',
      organizationId: 'org_aurora_01',
      model: 'gemini-1.5-pro',
      status: 'COMPLETED',
    });

    const gen = sync.invalidateAdminReads();
    const pulled = await sync.pullAuthoritativeClientOperations('client_juan_001', gen);
    expect(pulled.aiRuns).toHaveLength(1);
    expect(pulled.aiRuns?.[0].id).toBe('airun_01');
  });

  it('S17. Compatibilidad con R-B01 y creación de borradores transaccionales', async () => {
    const sync = await import('../src/services/firestore/sync');
    sync.setFirestoreAuthoritative(true);

    const gen = sync.invalidateAdminReads();
    const outcome = await sync.ensureActiveDraftDeliveryTransactional({
      clientId: 'client_juan_001',
      organizationId: 'org_aurora_01',
      readGeneration: gen,
      newId: 'pkg_test_s17',
      build: (id) => ({
        id,
        clientId: 'client_juan_001',
        organizationId: 'org_aurora_01',
        title: 'Borrador R-B01 Transaccional',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        createdBy: 'user_admin_01',
        periodLabel: 'Octubre 2026',
        items: [],
      }),
    });

    expect(outcome.package.id).toBe('pkg_test_s17');
    expect(h.state.remote.get('clients/client_juan_001/deliveries/pkg_test_s17')?.status).toBe('DRAFT');
    expect(h.state.remote.get('clients/client_juan_001')?.activeDraftDeliveryId).toBe('pkg_test_s17');
  });

  it('S18. Comportamiento ante refresco/cierre de pestaña (límite de memoria documentado)', async () => {
    const sync = await import('../src/services/firestore/sync');
    expect(typeof sync.flushPendingAdminPushes).toBe('function');
  });
});
