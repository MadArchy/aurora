/**
 * DIAG-C regression — a realtime snapshot older than a local client approval must not erase it
 * before it is captured, persisted and confirmed. Real `dbService`, real Firestore sync and the
 * real ReviewClientArticle use case; only the Firebase SDK is simulated. Snapshots are delivered
 * by hand so every interleaving below is deterministic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;
type Write = { path: string; data: Doc };
type SnapshotDoc = { id: string; data: () => Doc; metadata: { hasPendingWrites: boolean } };
type Snapshot = { metadata: { fromCache: boolean }; docs: SnapshotDoc[] };
type Filter = { field: string; op: string; value: unknown };
type Listener = { path: string; constraints: Filter[]; callback: (snap: Snapshot) => void };

const h = vi.hoisted(() => {
  class MemoryStorage {
    private store = new Map<string, string>();
    get length() {
      return this.store.size;
    }
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.get(key) ?? null;
    }
    key(index: number) {
      return [...this.store.keys()][index] ?? null;
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
    setItem(key: string, value: string) {
      this.store.set(key, value);
    }
  }
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  return {
    state: {
      remote: new Map<string, Record<string, unknown>>(),
      claims: {} as Record<string, unknown>,
      attempts: [] as Array<Array<{ path: string; data: Record<string, unknown> }>>,
      commits: [] as Array<Array<{ path: string; data: Record<string, unknown> }>>,
      failNext: null as string | null,
      hold: null as Promise<void> | null,
      tick: 0,
      listeners: [] as Array<{
        path: string;
        constraints: Array<{ field: string; op: string; value: unknown }>;
        callback: (snap: {
          metadata: { fromCache: boolean };
          docs: Array<{ id: string; data: () => Record<string, unknown>; metadata: { hasPendingWrites: boolean } }>;
        }) => void;
      }>,
    },
  };
});

/** CLIENT task edges firestore.rules enforces; mirrored only to judge what reaches the server. */
const LEGAL_CLIENT_TASK_EDGES: Record<string, readonly string[]> = {
  ASSIGNED: ['VIEWED', 'IN_PROGRESS'],
  VIEWED: ['IN_PROGRESS', 'COMPLETED'],
  IN_PROGRESS: ['COMPLETED'],
};

vi.mock('firebase/firestore', () => {
  type Query = { col: { path: string }; constraints: Filter[] };
  const parent = (path: string) => path.slice(0, path.lastIndexOf('/'));
  const toSnapshot = (rows: Array<[string, Doc]>): Snapshot => ({
    metadata: { fromCache: false },
    docs: rows.map(([path, data]) => ({
      id: path.slice(path.lastIndexOf('/') + 1),
      data: () => ({ ...data }),
      metadata: { hasPendingWrites: false },
    })),
  });
  const matches = (q: Query) =>
    [...h.state.remote.entries()].filter(
      ([path, data]) => parent(path) === q.col.path && q.constraints.every((c) => data[c.field] === c.value)
    );
  const taskEdgeDenied = (write: Write) => {
    if (h.state.claims.role !== 'CLIENT' || !/^clients\/[^/]+\/tasks\//.test(write.path)) return false;
    const next = write.data.status;
    const current = h.state.remote.get(write.path)?.status;
    if (typeof next !== 'string' || typeof current !== 'string' || next === current) return false;
    return !(LEGAL_CLIENT_TASK_EDGES[current] ?? []).includes(next);
  };
  return {
    doc: (_db: unknown, path: string) => ({ path }),
    collection: (_db: unknown, path: string) => ({ path }),
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    query: (col: { path: string }, ...constraints: Filter[]) => ({ col, constraints }),
    serverTimestamp: () => {
      const at = new Date(Date.UTC(2026, 9, 12, 12, 0, ++h.state.tick));
      return { toDate: () => at };
    },
    deleteField: () => ({ deleteField: true }),
    writeBatch: () => {
      const pending: Write[] = [];
      return {
        set(ref: { path: string }, data: Doc) {
          pending.push({ path: ref.path, data });
        },
        delete(ref: { path: string }) {
          pending.push({ path: ref.path, data: { deleted: true } });
        },
        async commit() {
          h.state.attempts.push(pending.map((write) => ({ ...write })));
          if (h.state.hold) await h.state.hold;
          if (h.state.failNext) {
            const message = h.state.failNext;
            h.state.failNext = null;
            throw new Error(message);
          }
          if (pending.some(taskEdgeDenied)) throw new Error('PERMISSION_DENIED');
          h.state.commits.push(pending.map((write) => ({ ...write })));
          for (const write of pending) {
            h.state.remote.set(write.path, { ...(h.state.remote.get(write.path) ?? {}), ...write.data });
          }
        },
      };
    },
    onSnapshot: (q: Query, callback: (snap: Snapshot) => void) => {
      const listener: Listener = { path: q.col.path, constraints: q.constraints, callback };
      h.state.listeners.push(listener);
      return () => {
        h.state.listeners = h.state.listeners.filter((entry) => entry !== listener);
      };
    },
    getDoc: async (ref: { path: string }) => ({
      id: ref.path.slice(ref.path.lastIndexOf('/') + 1),
      exists: () => h.state.remote.has(ref.path),
      data: () => ({ ...(h.state.remote.get(ref.path) ?? {}) }),
      metadata: { fromCache: false, hasPendingWrites: false },
    }),
    getDocs: async (q: Query) => toSnapshot(matches(q)),
  };
});

vi.mock('../src/firebase/app', () => ({
  getFirebaseFirestore: async () => ({}),
  getFirebaseAuth: async () => ({
    currentUser: { getIdTokenResult: async () => ({ claims: h.state.claims }) },
  }),
}));

vi.mock('../src/firebase/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/firebase/config')>();
  return {
    ...actual,
    FIREBASE_ENABLED: true,
    readFirebaseConfig: () => ({ projectId: 'demo-aurora-e2e' }),
  };
});

vi.mock('../src/services/auth', () => ({
  authService: { getCurrentUser: () => null },
}));

vi.mock('../src/services/audit', () => ({
  auditService: { log: () => undefined },
}));

vi.mock('../src/services/notifications', () => ({
  notificationService: { mergeFromRemote: () => undefined },
}));

const ORG = 'org_aurora_01';
/** Not the built-in demo client, whose seed backfill would add unrelated local rows. */
const CID = 'client_race_001';
const OTHER_CID = 'client_race_002';
const ROOT = `clients/${CID}`;
const CONTENT_ID = 'cnt_race';
const TASK_ID = 'task_review';
const OTHER_TASK_ID = 'task_other';
const CONTENT = `${ROOT}/contents/${CONTENT_ID}`;
const TASK = `${ROOT}/tasks/${TASK_ID}`;
const OTHER_TASK = `${ROOT}/tasks/${OTHER_TASK_ID}`;
const T0 = '2026-10-01T10:00:00.000Z';
const ORIGINAL_BODY = 'Borrador original del manager.';
const EDITED_TITLE = 'Borrador editado';
const EDITED_BODY = 'Borrador editado por el cliente.';
const CLIENT_CLAIMS = { role: 'CLIENT', organizationId: ORG, clientId: CID };
const REALTIME_SUBS = ['tasks', 'contents', 'feedbackEvents'] as const;

let db: typeof import('../src/services/db');
let sync: typeof import('../src/services/firestore/sync');
let composition: typeof import('../src/composition/executionDelivery/composeExecutionDelivery');
let pushErrors: string[] = [];

function seed(contentStage: 'sent_to_client' | 'client_in_progress') {
  h.state.remote.set(ROOT, {
    id: CID,
    organizationId: ORG,
    name: 'Juan',
    displayName: 'Juan',
    completedTasksCount: 5,
    createdAt: T0,
    updatedAt: T0,
  });
  h.state.remote.set(CONTENT, {
    id: CONTENT_ID,
    organizationId: ORG,
    clientId: CID,
    title: 'Borrador',
    body: ORIGINAL_BODY,
    type: 'LINKEDIN_ARTICLE',
    targetPlatform: 'LinkedIn',
    status: contentStage === 'sent_to_client' ? 'CLIENT_REVIEW' : 'CHANGES_REQUESTED',
    pipelineStatus: contentStage,
    clientReviewBaseline: ORIGINAL_BODY,
    createdAt: T0,
    updatedAt: T0,
  });
  h.state.remote.set(TASK, {
    id: TASK_ID,
    organizationId: ORG,
    clientId: CID,
    type: 'REVIEW_ARTICLE',
    title: 'Revisar artículo',
    status: 'IN_PROGRESS',
    contentItemId: CONTENT_ID,
    estimatedMinutes: 20,
    createdAt: T0,
    updatedAt: T0,
  });
  h.state.remote.set(OTHER_TASK, {
    id: OTHER_TASK_ID,
    organizationId: ORG,
    clientId: CID,
    type: 'SUBMIT_INFO',
    title: 'Otra tarea',
    status: 'ASSIGNED',
    estimatedMinutes: 10,
    createdAt: T0,
    updatedAt: T0,
  });
}

function emptySnapshot(): import('../src/services/firestore/types').LocalV5Snapshot {
  return {
    clients: [],
    theses: [],
    profiles: {},
    sources: [],
    signals: [],
    recommendations: [],
    tasks: [],
    contents: [],
    opportunities: [],
    campaigns: [],
    campaignMilestones: [],
    evidenceVault: [],
    aiRuns: [],
    subscription: null,
    invitations: [],
    results: [],
    curation: [],
    deliveries: [],
    advices: [],
    files: [],
    topicPins: [],
    dossiers: {},
    feedbackEvents: [],
    signalOutcomes: [],
    proofWallItems: [],
    notifications: [],
  };
}

/** Server rows of one client subcollection as they are right now (a later delivery is stale). */
function serverRows(sub: string, clientId = CID): Array<[string, Doc]> {
  const prefix = `clients/${clientId}/${sub}/`;
  return [...h.state.remote.entries()]
    .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
    .map(([path, data]) => [path, { ...data }]);
}

/** Delivers a server-confirmed listener snapshot, exactly like the SDK after a write ack. */
function deliver(sub: string, rows: Array<[string, Doc]> = serverRows(sub), clientId = CID) {
  const path = `clients/${clientId}/${sub}`;
  const snap: Snapshot = {
    metadata: { fromCache: false },
    docs: rows
      .filter(([, data]) => data.organizationId === ORG && data.clientId === clientId)
      .map(([docPath, data]) => ({
        id: docPath.slice(docPath.lastIndexOf('/') + 1),
        data: () => ({ ...data }),
        metadata: { hasPendingWrites: false },
      })),
  };
  for (const listener of [...h.state.listeners]) {
    if (listener.path === path) listener.callback(snap);
  }
}

function staleSnapshots(clientId = CID) {
  return REALTIME_SUBS.map((sub) => [sub, serverRows(sub, clientId)] as const);
}

function deliverAll(snapshots: ReturnType<typeof staleSnapshots>, clientId = CID) {
  for (const [sub, rows] of snapshots) deliver(sub, rows, clientId);
}

async function settle() {
  await vi.advanceTimersByTimeAsync(800);
  await sync.importSnapshotToFirestore(emptySnapshot());
}

async function startClientSession(options: { preloadSync: boolean; clientIds?: string[] }) {
  h.state.claims = CLIENT_CLAIMS;
  sync.setFirestoreAuthoritative(true);
  if (options.preloadSync) {
    await db.dbService.hydrateFromRemote([CID]);
  } else {
    db.dbService.importSnapshot(await sync.pullClientDataFromFirestore([CID]), { merge: false, skipRemote: true });
  }
  await sync.startFirestoreRealtimeSync(options.clientIds ?? [CID], (partial, meta) => {
    db.dbService.importSnapshot(partial, { merge: true, skipRemote: true, scopeClientId: meta.clientId });
  });
  for (const clientId of options.clientIds ?? [CID]) {
    for (const sub of REALTIME_SUBS) deliver(sub, serverRows(sub, clientId), clientId);
  }
  h.state.attempts = [];
  h.state.commits = [];
}

function review(decision: 'save_revision' | 'approve', withRevision = true) {
  return composition.composeExecutionDelivery().reviewClientArticle({
    trusted: {
      actorId: 'user_juan',
      actorRole: 'CLIENT',
      organizationId: ORG,
      clientId: CID,
      now: new Date().toISOString(),
    },
    contentId: CONTENT_ID,
    decision,
    taskId: TASK_ID,
    ...(withRevision ? { title: EDITED_TITLE, body: EDITED_BODY } : {}),
  });
}

function serverFeedbackKinds(kind: string): number {
  return serverRows('feedbackEvents').filter(([, data]) => data.kind === kind).length;
}

function localTask(id: string, clientId = CID) {
  return db.dbService.getAllTasks().find((task) => task.id === id && task.clientId === clientId);
}

function localFeedbackKinds(kind: string): number {
  return db.dbService.getFeedbackEventsForContent(CONTENT_ID).filter((event) => event.kind === kind).length;
}

function committedFieldHistory(path: string, field: string): unknown[] {
  return h.state.commits.flat().filter((w) => w.path === path && field in w.data).map((w) => w.data[field]);
}

function expectServerApproved() {
  expect(h.state.remote.get(CONTENT)?.pipelineStatus).toBe('client_submitted');
  expect(h.state.remote.get(CONTENT)?.status).toBe('CLIENT_APPROVED');
  expect(h.state.remote.get(TASK)?.status).toBe('COMPLETED');
  expect(serverFeedbackKinds('CLIENT_APPROVE')).toBe(1);
  expect(h.state.remote.get(ROOT)?.completedTasksCount).toBe(6);
}

function expectLocalApproved() {
  expect(db.dbService.getContentById(CONTENT_ID)?.pipelineStatus).toBe('client_submitted');
  expect(db.dbService.getContentById(CONTENT_ID)?.status).toBe('CLIENT_APPROVED');
  expect(localTask(TASK_ID)?.status).toBe('COMPLETED');
  expect(localFeedbackKinds('CLIENT_APPROVE')).toBe(1);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.resetModules();
  h.state.remote.clear();
  h.state.attempts = [];
  h.state.commits = [];
  h.state.failNext = null;
  h.state.hold = null;
  h.state.tick = 0;
  h.state.listeners = [];
  pushErrors = [];
  db = await import('../src/services/db');
  sync = await import('../src/services/firestore/sync');
  composition = await import('../src/composition/executionDelivery/composeExecutionDelivery');
  sync.resetKnownRemoteDocPaths();
  sync.onFirestorePushError((message) => pushErrors.push(message));
});

afterEach(() => {
  sync.onFirestorePushError(null);
  sync.stopFirestoreRealtimeSync();
  sync.setFirestoreAuthoritative(false);
  vi.useRealTimers();
});

describe('DIAG-C — client approval survives a stale realtime snapshot', () => {
  it('R1: the approval is captured before the sync module import resolves', async () => {
    seed('client_in_progress');
    await startClientSession({ preloadSync: false });
    const stale = staleSnapshots();

    review('approve', false);
    deliverAll(stale);
    await settle();

    expectServerApproved();
    expect(pushErrors).toEqual([]);
  });

  it('R2/R3: a stale echo between approval and push loses nothing, locally or on the server', async () => {
    seed('sent_to_client');
    await startClientSession({ preloadSync: true });
    review('save_revision');
    await settle();
    expect(h.state.remote.get(CONTENT)?.pipelineStatus).toBe('client_in_progress');
    const stale = staleSnapshots();

    review('approve');
    deliverAll(stale);
    expectLocalApproved();
    await settle();

    expectServerApproved();
    expectLocalApproved();
    expect(db.dbService.getClientById(CID)?.completedTasksCount).toBe(6);
    expect(pushErrors).toEqual([]);

    const attempts = h.state.attempts.length;
    deliverAll(staleSnapshots());
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.state.attempts).toHaveLength(attempts);
    expectLocalApproved();
  });

  it('R2: a capture taken after the stale echo cannot revert the pending approval', async () => {
    seed('sent_to_client');
    await startClientSession({ preloadSync: true });
    review('save_revision');
    await settle();
    const stale = staleSnapshots();

    review('approve');
    await vi.advanceTimersByTimeAsync(0);
    deliverAll(stale);
    expectLocalApproved();
    db.dbService.updateTaskStatus(OTHER_TASK_ID, 'VIEWED');
    await settle();

    expectServerApproved();
    expect(h.state.remote.get(OTHER_TASK)?.status).toBe('VIEWED');
    expect(pushErrors).toEqual([]);
  });

  it('R6: the echo of an earlier save never reverts the later approval', async () => {
    seed('sent_to_client');
    await startClientSession({ preloadSync: true });
    let release = () => undefined as void;
    h.state.hold = new Promise<void>((resolve) => {
      release = resolve;
    });

    review('save_revision');
    await vi.advanceTimersByTimeAsync(800);
    review('approve');
    h.state.hold = null;
    release();
    await vi.advanceTimersByTimeAsync(0);
    deliverAll(staleSnapshots());
    expectLocalApproved();
    await settle();

    expectServerApproved();
    expectLocalApproved();
    expect(committedFieldHistory(CONTENT, 'pipelineStatus')).toEqual(['client_in_progress', 'client_submitted']);
    expect(pushErrors).toEqual([]);
  });

  it('R7: pending mutations of one client never touch another client or tenant', async () => {
    seed('sent_to_client');
    const otherTaskPath = `clients/${OTHER_CID}/tasks/task_elena`;
    h.state.remote.set(otherTaskPath, {
      id: 'task_elena',
      organizationId: ORG,
      clientId: OTHER_CID,
      type: 'REVIEW_ARTICLE',
      title: 'Tarea de Elena',
      status: 'IN_PROGRESS',
      createdAt: T0,
      updatedAt: T0,
    });
    await startClientSession({ preloadSync: true, clientIds: [CID, OTHER_CID] });
    review('save_revision');
    await settle();
    const stale = staleSnapshots();

    review('approve');
    deliverAll(stale);
    deliver('tasks', serverRows('tasks', OTHER_CID), OTHER_CID);
    deliver('contents', serverRows('contents', OTHER_CID), OTHER_CID);
    deliver('feedbackEvents', serverRows('feedbackEvents', OTHER_CID), OTHER_CID);

    const otherRows = db.dbService.getAllTasks().filter((task) => task.clientId === OTHER_CID);
    expect(otherRows.map((task) => task.id)).toEqual(['task_elena']);
    expect(otherRows[0]).toMatchObject({ title: 'Tarea de Elena', status: 'IN_PROGRESS' });
    expect(db.dbService.getContentById(CONTENT_ID)?.clientId).toBe(CID);
    expectLocalApproved();
    await settle();

    expectServerApproved();
    expect(h.state.attempts.flat().some((w) => w.path.startsWith(`clients/${OTHER_CID}`))).toBe(false);
    expect(h.state.remote.get(otherTaskPath)?.status).toBe('IN_PROGRESS');
  });

  it('R7: a pending row never overlays a snapshot scoped to another tenant', async () => {
    seed('sent_to_client');
    await startClientSession({ preloadSync: true });
    review('save_revision');
    await settle();

    review('approve');
    h.state.claims = { role: 'CLIENT', organizationId: 'org_other_tenant', clientId: CID };
    sync.stopFirestoreRealtimeSync();
    await sync.startFirestoreRealtimeSync([CID], (partial, meta) => {
      db.dbService.importSnapshot(partial, { merge: true, skipRemote: true, scopeClientId: meta.clientId });
    });
    const foreign = h.state.listeners.find((listener) => listener.path === `${ROOT}/tasks`);
    foreign?.callback({ metadata: { fromCache: false }, docs: [] });

    expect(localTask(TASK_ID)).toBeUndefined();
  });

  it('R8: a late ack of the approval never releases a later pending mutation', async () => {
    seed('sent_to_client');
    await startClientSession({ preloadSync: true });
    review('save_revision');
    await settle();
    let release = () => undefined as void;
    h.state.hold = new Promise<void>((resolve) => {
      release = resolve;
    });

    review('approve');
    await vi.advanceTimersByTimeAsync(800);
    db.dbService.updateTaskStatus(OTHER_TASK_ID, 'VIEWED');
    h.state.hold = null;
    release();
    await vi.advanceTimersByTimeAsync(0);
    deliverAll(staleSnapshots());

    expect(localTask(OTHER_TASK_ID)?.status).toBe('VIEWED');
    expectLocalApproved();
    await settle();

    expectServerApproved();
    expect(h.state.remote.get(OTHER_TASK)?.status).toBe('VIEWED');
    expect(pushErrors).toEqual([]);
  });
});

describe('DIAG-C — confirmation, failure and idempotency', () => {
  it('R4: persistence is confirmed only after the server acknowledges the approval', async () => {
    seed('sent_to_client');
    await startClientSession({ preloadSync: true });
    review('save_revision');
    await settle();
    let release = () => undefined as void;
    h.state.hold = new Promise<void>((resolve) => {
      release = resolve;
    });

    const scope = db.dbService.beginRemotePersistenceScope();
    review('approve');
    let outcome: Awaited<ReturnType<typeof db.dbService.awaitRemotePersistence>> | null = null;
    const confirmation = db.dbService.awaitRemotePersistence(scope).then((result) => {
      outcome = result;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome).toBeNull();
    expect(h.state.remote.get(CONTENT)?.pipelineStatus).toBe('client_in_progress');

    h.state.hold = null;
    release();
    await confirmation;
    expect(outcome).toEqual({ status: 'confirmed' });
    expectServerApproved();
  });

  it('R5: a rejected approval is reported as rejected and reconciled to the server state', async () => {
    seed('sent_to_client');
    await startClientSession({ preloadSync: true });
    review('save_revision');
    await settle();

    const scope = db.dbService.beginRemotePersistenceScope();
    h.state.failNext = 'PERMISSION_DENIED: rules rejected the write';
    review('approve');
    const outcome = await db.dbService.awaitRemotePersistence(scope);

    expect(outcome.status).toBe('rejected');
    expect(h.state.remote.get(CONTENT)?.pipelineStatus).toBe('client_in_progress');
    expect(h.state.remote.get(TASK)?.status).toBe('IN_PROGRESS');
    expect(h.state.remote.get(ROOT)?.completedTasksCount).toBe(5);
    expect(serverFeedbackKinds('CLIENT_APPROVE')).toBe(0);
    expect(db.dbService.getContentById(CONTENT_ID)?.pipelineStatus).toBe('client_in_progress');
    expect(localTask(TASK_ID)?.status).toBe('IN_PROGRESS');
    expect(localFeedbackKinds('CLIENT_APPROVE')).toBe(0);
    expect(db.dbService.getClientById(CID)?.completedTasksCount).toBe(5);
    expect(pushErrors).toHaveLength(1);

    db.dbService.updateTaskStatus(OTHER_TASK_ID, 'VIEWED');
    await settle();
    expect(h.state.remote.get(ROOT)?.completedTasksCount).toBe(5);
  });

  it('R5: an unavailable backend is reported as failed, never as confirmed', async () => {
    seed('sent_to_client');
    await startClientSession({ preloadSync: true });
    const scope = db.dbService.beginRemotePersistenceScope();
    h.state.failNext = 'unavailable';
    review('approve');
    const outcome = await db.dbService.awaitRemotePersistence(scope);
    expect(outcome).toEqual({ status: 'failed', message: 'unavailable' });
  });

  it('R9: a retry after a failure persists exactly one approval and one increment', async () => {
    seed('sent_to_client');
    await startClientSession({ preloadSync: true });
    review('save_revision');
    await settle();

    h.state.failNext = 'unavailable';
    review('approve');
    await settle();
    expect(serverFeedbackKinds('CLIENT_APPROVE')).toBe(0);
    expect(localTask(TASK_ID)?.status).toBe('IN_PROGRESS');

    review('approve');
    await settle();
    expectServerApproved();
    expect(db.dbService.getClientById(CID)?.completedTasksCount).toBe(6);

    await sync.importSnapshotToFirestore(db.dbService.exportSnapshot());
    await sync.importSnapshotToFirestore(db.dbService.exportSnapshot());
    expectServerApproved();
  });

  it('R10: a forbidden direct ASSIGNED → COMPLETED edge is still rejected and never confirmed', async () => {
    seed('sent_to_client');
    await startClientSession({ preloadSync: true });
    const other = localTask(OTHER_TASK_ID);
    expect(other?.status).toBe('ASSIGNED');

    const scope = db.dbService.beginRemotePersistenceScope();
    if (other) other.status = 'COMPLETED';
    db.dbService.updateTaskStatus(TASK_ID, 'COMPLETED');
    const outcome = await db.dbService.awaitRemotePersistence(scope);

    expect(outcome.status).toBe('rejected');
    expect(committedFieldHistory(OTHER_TASK, 'status')).toEqual([]);
    expect(h.state.remote.get(OTHER_TASK)?.status).toBe('ASSIGNED');
    expect(localTask(OTHER_TASK_ID)?.status).toBe('ASSIGNED');
  });
});
