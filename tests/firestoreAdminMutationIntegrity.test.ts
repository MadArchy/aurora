import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;

const h = vi.hoisted(() => {
  const state = {
    remote: new Map<string, Record<string, unknown>>(),
    claims: {} as Record<string, unknown>,
    /** Every commit the SDK was asked to make, including rejected and retried ones. */
    attempts: [] as Array<{ kind: 'transaction' | 'batch'; writes: Array<{ path: string; data: Record<string, unknown> | null }> }>,
    commits: [] as Array<{ kind: 'transaction' | 'batch'; writes: Array<{ path: string; data: Record<string, unknown> | null }> }>,
    failNextCommit: false,
    /** Runs after a transaction's reads, before it commits: a concurrent writer for that window. */
    duringTransaction: null as null | (() => void),
    /** Holds a transaction commit (late ACK) until released. */
    gate: null as null | Promise<void>,
    releaseGate: () => undefined as void,
    gateReached: false,
    signedIn: true,
    listeners: [] as Array<{ path: string; constraints: Array<{ field: string; value: unknown }>; cb: (snap: unknown) => void }>,
    tick: 0,
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
  const apply = (writes: Array<{ path: string; data: Record<string, unknown> | null }>) => {
    for (const write of writes) {
      if (write.data === null) {
        h.state.remote.delete(write.path);
        continue;
      }
      const next: Record<string, unknown> = { ...(h.state.remote.get(write.path) ?? {}) };
      for (const [key, value] of Object.entries(write.data)) {
        if (typeof value === 'object' && value !== null && 'deleteField' in value) delete next[key];
        else next[key] = value;
      }
      h.state.remote.set(write.path, next);
    }
  };
  return {
    doc: (_db: unknown, path: string) => ({ path }),
    collection: (_db: unknown, path: string) => ({ path }),
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    query: (col: { path: string }, ...constraints: Filter[]) => ({ col, constraints }),
    serverTimestamp: () => ({ serverTimestamp: ++h.state.tick }),
    deleteField: () => ({ deleteField: true }),
    writeBatch: () => {
      const pending: Array<{ path: string; data: Record<string, unknown> | null }> = [];
      const batch = {
        set(ref: { path: string }, data: Record<string, unknown>) {
          pending.push({ path: ref.path, data });
          return batch;
        },
        delete(ref: { path: string }) {
          pending.push({ path: ref.path, data: null });
          return batch;
        },
        async commit() {
          h.state.attempts.push({ kind: 'batch', writes: pending.map((write) => ({ ...write })) });
          if (h.state.failNextCommit) {
            h.state.failNextCommit = false;
            throw new Error('unavailable');
          }
          h.state.commits.push({ kind: 'batch', writes: pending.map((write) => ({ ...write })) });
          apply(pending);
        },
      };
      return batch;
    },
    runTransaction: async <T,>(
      _db: unknown,
      update: (tx: {
        get(ref: { path: string }): Promise<{ exists(): boolean; data(): Record<string, unknown> | undefined }>;
        set(ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }): unknown;
        delete(ref: { path: string }): unknown;
      }) => Promise<T>
    ): Promise<T> => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const reads = new Map<string, string>();
        const pending: Array<{ path: string; data: Record<string, unknown> | null }> = [];
        const tx = {
          async get(ref: { path: string }) {
            if (pending.length > 0) throw new Error('Firestore transactions require all reads before writes');
            const data = h.state.remote.get(ref.path);
            reads.set(ref.path, JSON.stringify(data ?? null));
            return { exists: () => data !== undefined, data: () => (data ? structuredClone(data) : undefined) };
          },
          set(ref: { path: string }, data: Record<string, unknown>) {
            pending.push({ path: ref.path, data });
            return tx;
          },
          delete(ref: { path: string }) {
            pending.push({ path: ref.path, data: null });
            return tx;
          },
        };
        const result = await update(tx);
        const concurrent = h.state.duringTransaction;
        h.state.duringTransaction = null;
        concurrent?.();
        if (h.state.gate) {
          h.state.gateReached = true;
          await h.state.gate;
        }
        h.state.attempts.push({ kind: 'transaction', writes: pending.map((write) => ({ ...write })) });
        if (h.state.failNextCommit) {
          h.state.failNextCommit = false;
          throw new Error('unavailable');
        }
        const changed = [...reads].some(([path, seen]) => JSON.stringify(h.state.remote.get(path) ?? null) !== seen);
        if (changed) continue;
        h.state.commits.push({ kind: 'transaction', writes: pending.map((write) => ({ ...write })) });
        apply(pending);
        return result;
      }
      throw new Error('aborted: transaction contention');
    },
    onSnapshot: (q: Query, cb: (snap: unknown) => void) => {
      const listener = { path: q.col.path, constraints: q.constraints, cb };
      h.state.listeners.push(listener);
      return () => {
        h.state.listeners = h.state.listeners.filter((candidate) => candidate !== listener);
      };
    },
    getDoc: async (ref: { path: string }) => ({
      id: ref.path.slice(ref.path.lastIndexOf('/') + 1),
      exists: () => h.state.remote.has(ref.path),
      data: () => structuredClone(h.state.remote.get(ref.path)),
      metadata: { fromCache: false, hasPendingWrites: false },
    }),
    getDocs: async (q: Query) => toSnapshot(matches(q)),
    /** Test hook: emits a server snapshot of `path`, optionally from rows captured earlier. */
    __deliver: (path: string, rows?: Array<[string, Record<string, unknown>]>) => {
      for (const listener of h.state.listeners.filter((candidate) => candidate.path === path)) {
        const source = rows ?? [...h.state.remote.entries()];
        listener.cb(
          toSnapshot(
            source.filter(
              ([docPath, data]) =>
                parentOf(docPath) === path && listener.constraints.every((c) => data[c.field] === c.value)
            )
          )
        );
      }
    },
  };
});

vi.mock('../src/firebase/app', () => ({
  getFirebaseFirestore: async () => ({}),
  getFirebaseAuth: async () => ({
    currentUser: h.state.signedIn ? { getIdTokenResult: async () => ({ claims: h.state.claims }) } : null,
  }),
}));

vi.mock('../src/firebase/config', () => ({
  readFirebaseConfig: () => ({ projectId: 'demo-aurora-e2e' }),
}));

import * as firestoreMock from 'firebase/firestore';
import {
  importSnapshotToFirestore,
  onFirestorePushError,
  pullClientDataFromFirestore,
  resetKnownRemoteDocPaths,
  scheduleFirestorePush,
  setFirestoreAuthoritative,
  startFirestoreRealtimeSync,
  stopFirestoreRealtimeSync,
  type AdminRowReconcile,
} from '../src/services/firestore/sync';
import type { LocalV5Snapshot } from '../src/services/firestore/types';
import type { Client, Task } from '../src/types';

const ORG = 'org_aurora_01';
const OTHER_ORG = 'org_other_02';
const CID = 'client_juan_001';
const OTHER_CID = 'client_other_009';
const ROOT = `clients/${CID}`;
const TASKS = `${ROOT}/tasks`;
const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-10-14T12:00:00.000Z';
const ADMIN = { role: 'ADMIN', organizationId: ORG };
const CLIENT = { role: 'CLIENT', organizationId: ORG, clientId: CID };
const TASK_IDS = ['a', 'b', 'c', 'd', 'u'];

function deliver(path: string, rows?: Array<[string, Record<string, unknown>]>) {
  const hook: unknown = Reflect.get(firestoreMock, '__deliver');
  if (typeof hook !== 'function') throw new Error('firestore mock without __deliver');
  hook(path, rows);
}

function clientRow(id = CID, organizationId = ORG): Client {
  return {
    id,
    organizationId,
    primaryManagerId: 'manager_1',
    firstName: 'Juan',
    lastName: 'Pérez',
    displayName: 'Juan',
    primaryEmail: 'juan@example.test',
    onboardingStatus: 'COMPLETED',
    status: 'ACTIVE',
    createdAt: T0,
    createdBy: 'manager_1',
    updatedAt: T0,
    updatedBy: 'manager_1',
    activeThesesCount: 0,
    completedTasksCount: 0,
  };
}

function taskRow(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    organizationId: ORG,
    clientId: CID,
    type: 'SUBMIT_INFO',
    title: `Task ${id}`,
    description: 'Seed',
    estimatedMinutes: 5,
    status: 'IN_PROGRESS',
    evidenceUrl: 'https://diag.local/seed',
    createdAt: T0,
    ...extra,
  };
}

function emptySnapshot(): LocalV5Snapshot {
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

let store: LocalV5Snapshot = emptySnapshot();
let pushErrors: string[] = [];
let reconciled: AdminRowReconcile[] = [];

function seed() {
  h.state.remote.set(ROOT, { ...clientRow(), completedTasksCount: 5 });
  for (const id of TASK_IDS) h.state.remote.set(`${TASKS}/${id}`, { ...taskRow(id), updatedAt: T0 });
  store = emptySnapshot();
  store.clients = [{ ...clientRow(), completedTasksCount: 5 }];
  store.tasks = TASK_IDS.map((id) => taskRow(id));
}

/** Mirrors `dbService.importSnapshot(partial, { scopeClientId })`: the client's rows are replaced. */
function onRealtimePartial(partial: Partial<LocalV5Snapshot>, meta: { clientId: string }) {
  if (partial.tasks) {
    store.tasks = [...store.tasks.filter((row) => row.clientId !== meta.clientId), ...partial.tasks];
  }
}

/** Mirrors `dbService.applyReconciledAdminRows`. */
function onAdminRows(rows: ReadonlyArray<AdminRowReconcile>) {
  reconciled.push(...rows);
  for (const { target, clientId, id, row } of rows) {
    if (target !== 'tasks' && target !== 'clients') continue;
    const list: unknown[] = store[target];
    const index = list.findIndex(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        item.id === id &&
        (target === 'clients' || ('clientId' in item && item.clientId === clientId))
    );
    if (row && index >= 0) list[index] = row;
    else if (row) list.push(row);
    else if (index >= 0) list.splice(index, 1);
  }
}

function push() {
  scheduleFirestorePush(store, undefined, onAdminRows);
}

function task(id: string, clientId = CID): Task {
  const found = store.tasks.find((row) => row.id === id && row.clientId === clientId);
  if (!found) throw new Error(`missing local task ${id}`);
  return found;
}

function remote(path: string): Doc {
  const found = h.state.remote.get(path);
  if (!found) throw new Error(`missing remote ${path}`);
  return found;
}

function foreignWrite(path: string, fields: Doc) {
  h.state.remote.set(path, { ...remote(path), ...fields });
}

function attemptedPaths(): string[] {
  return h.state.attempts.flatMap((attempt) => attempt.writes.map((write) => write.path));
}

function committedWrites(path: string): Doc[] {
  return h.state.commits.flatMap((commit) =>
    commit.writes.flatMap((write) => (write.path === path && write.data ? [write.data] : []))
  );
}

function complete(id: string) {
  Object.assign(task(id), { status: 'COMPLETED', completedAt: T1, updatedAt: T1 });
  store.clients[0].completedTasksCount += 1;
}

/** Yields to real I/O (dynamic imports) without advancing the faked debounce timers. */
async function waitUntil(condition: () => boolean, limitMs = 5_000) {
  const deadline = Date.now() + limitMs;
  while (!condition() && Date.now() < deadline) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

/** Runs the 800 ms debounce, then waits behind every queued remote write with a write-free import. */
async function settle() {
  await vi.advanceTimersByTimeAsync(800);
  await importSnapshotToFirestore(emptySnapshot());
}

async function boot(claims: Doc = ADMIN) {
  h.state.claims = claims;
  await pullClientDataFromFirestore([CID]);
  await startFirestoreRealtimeSync([CID], onRealtimePartial);
  deliver(TASKS);
  h.state.attempts = [];
  h.state.commits = [];
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await settle();
  stopFirestoreRealtimeSync();
  h.state.remote.clear();
  h.state.attempts = [];
  h.state.commits = [];
  h.state.failNextCommit = false;
  h.state.duringTransaction = null;
  h.state.gate = null;
  h.state.gateReached = false;
  h.state.signedIn = true;
  h.state.listeners = [];
  h.state.tick = 0;
  pushErrors = [];
  reconciled = [];
  onFirestorePushError((message) => pushErrors.push(message));
  resetKnownRemoteDocPaths();
  setFirestoreAuthoritative(true);
  seed();
});

afterEach(() => {
  h.state.gate = null;
  h.state.releaseGate();
  stopFirestoreRealtimeSync();
  onFirestorePushError(null);
  setFirestoreAuthoritative(false);
  vi.useRealTimers();
});

describe('ADMIN pending mutation integrity (ADMIN-D1)', () => {
  it('S1: an ADMIN edit writes only its own doc and keeps a foreign write to another task and the root', async () => {
    await boot();
    task('a').evidenceUrl = 'https://diag.local/s1-a';
    push();
    foreignWrite(`${TASKS}/b`, { status: 'COMPLETED', completedAt: T1 });
    foreignWrite(ROOT, { displayName: 'Juan (owner edit)' });
    await settle();

    expect(attemptedPaths()).toEqual([`${TASKS}/a`]);
    expect(remote(`${TASKS}/a`).evidenceUrl).toBe('https://diag.local/s1-a');
    expect(remote(`${TASKS}/b`).status).toBe('COMPLETED');
    expect(remote(ROOT).displayName).toBe('Juan (owner edit)');
    expect(pushErrors).toEqual([]);
  });

  it('S2: consecutive ADMIN mutations both persist across a realtime snapshot that predates the first', async () => {
    await boot();
    task('a').title = 'S2 A';
    push();
    deliver(TASKS);
    expect(task('a').title).toBe('S2 A');
    task('c').title = 'S2 C';
    push();
    await settle();

    expect(remote(`${TASKS}/a`).title).toBe('S2 A');
    expect(remote(`${TASKS}/c`).title).toBe('S2 C');
    deliver(TASKS);
    expect([task('a').title, task('c').title]).toEqual(['S2 A', 'S2 C']);
    expect(pushErrors).toEqual([]);
  });

  it('S3: another session editing a different doc and field is preserved', async () => {
    await boot();
    task('a').title = 'Session 1';
    push();
    foreignWrite(`${TASKS}/b`, { title: 'Session 2' });
    foreignWrite(`${TASKS}/a`, { evidenceUrl: 'https://diag.local/session-2' });
    await settle();

    expect(remote(`${TASKS}/a`)).toMatchObject({ title: 'Session 1', evidenceUrl: 'https://diag.local/session-2' });
    expect(remote(`${TASKS}/b`).title).toBe('Session 2');
    expect(pushErrors).toEqual([]);
  });

  it('S3-conflict: a same-field edit by another session is reported, not overwritten, and local shows the server', async () => {
    await boot();
    task('a').title = 'Mine';
    push();
    foreignWrite(`${TASKS}/a`, { title: 'Theirs' });
    await settle();

    expect(remote(`${TASKS}/a`).title).toBe('Theirs');
    expect(pushErrors).toHaveLength(1);
    expect(pushErrors[0]).toMatch(/Conflicto de sincronización/);
    expect(task('a').title).toBe('Theirs');
    expect(reconciled.map((row) => row.id)).toEqual(['a']);

    h.state.attempts = [];
    push();
    await settle();
    expect(h.state.attempts).toEqual([]);
  });

  it('S4: completions derive the counter in the transaction, also against a concurrent completion', async () => {
    await boot();
    complete('c');
    complete('d');
    push();
    h.state.duringTransaction = () => foreignWrite(ROOT, { completedTasksCount: 9 });
    await settle();

    expect(h.state.attempts.filter((attempt) => attempt.kind === 'transaction')).toHaveLength(2);
    expect(h.state.commits).toHaveLength(1);
    expect(remote(`${TASKS}/c`).status).toBe('COMPLETED');
    expect(remote(`${TASKS}/d`).status).toBe('COMPLETED');
    expect(remote(ROOT).completedTasksCount).toBe(11);
    expect(store.clients[0].completedTasksCount).toBe(11);

    complete('b');
    push();
    await settle();
    expect(remote(ROOT).completedTasksCount).toBe(12);
    expect(store.clients[0].completedTasksCount).toBe(12);
    expect(pushErrors).toEqual([]);
  });

  it('S5: a snapshot that predates an acknowledged commit does not revert the row; newer versions win', async () => {
    await boot();
    const before: Array<[string, Doc]> = [...h.state.remote.entries()].map(([path, data]) => [path, structuredClone(data)]);
    task('a').title = 'S5 committed';
    push();
    await settle();
    expect(remote(`${TASKS}/a`).title).toBe('S5 committed');

    deliver(TASKS, before);
    expect(task('a').title).toBe('S5 committed');
    deliver(TASKS);
    expect(task('a').title).toBe('S5 committed');
    foreignWrite(`${TASKS}/a`, { title: 'S5 later foreign' });
    deliver(TASKS);
    expect(task('a').title).toBe('S5 later foreign');

    h.state.attempts = [];
    push();
    await settle();
    expect(h.state.attempts).toEqual([]);
  });

  it('S6: a late ACK of an older capture neither releases nor conflicts with a newer capture of the same field', async () => {
    await boot();
    h.state.gate = new Promise<void>((resolve) => {
      h.state.releaseGate = resolve;
    });
    task('a').title = 'V1';
    push();
    await vi.advanceTimersByTimeAsync(800);
    await waitUntil(() => h.state.gateReached);
    expect(h.state.gateReached).toBe(true);
    task('a').title = 'V2';
    push();
    h.state.gate = null;
    h.state.releaseGate();
    await waitUntil(() => h.state.commits.length > 0);
    expect(remote(`${TASKS}/a`).title).toBe('V1');
    deliver(TASKS);
    expect(task('a').title).toBe('V2');
    await settle();

    expect(committedWrites(`${TASKS}/a`).map((data) => data.title)).toEqual(['V1', 'V2']);
    expect(remote(`${TASKS}/a`).title).toBe('V2');
    expect(task('a').title).toBe('V2');
    expect(pushErrors).toEqual([]);
  });

  it('S7: a failed push reports the error, reverts the local row and never resends the lost value', async () => {
    await boot();
    h.state.failNextCommit = true;
    complete('a');
    push();
    await settle();

    expect(pushErrors).toEqual(['unavailable']);
    expect(remote(`${TASKS}/a`).status).toBe('IN_PROGRESS');
    expect(task('a').status).toBe('IN_PROGRESS');
    expect(remote(ROOT).completedTasksCount).toBe(5);
    expect(store.clients[0].completedTasksCount).toBe(5);
    expect(h.state.commits).toEqual([]);

    h.state.attempts = [];
    push();
    await settle();
    expect(h.state.attempts).toEqual([]);
  });

  it('S7-signout: a push that runs after sign-out writes nothing, keeps local rows and does not leak into the next session', async () => {
    await boot();
    store.clients.push(clientRow('client_new_001'));
    task('a').title = 'Before sign-out';
    push();
    h.state.signedIn = false;
    await settle();

    expect(h.state.attempts).toEqual([]);
    expect(pushErrors).toHaveLength(1);
    expect(pushErrors[0]).toMatch(/Sin sesión activa/);
    expect(store.clients.some((client) => client.id === 'client_new_001')).toBe(true);
    expect(task('a').title).toBe('Before sign-out');
    expect(reconciled).toEqual([]);

    h.state.signedIn = true;
    task('b').title = 'Next session';
    push();
    await settle();
    expect(attemptedPaths()).toEqual([`${TASKS}/b`]);
    expect(remote(`${TASKS}/a`).title).toBe('Task a');
    expect(h.state.remote.has('clients/client_new_001')).toBe(false);

    h.state.attempts = [];
    task('a').title = 'Edited in the next session';
    push();
    await settle();
    expect(attemptedPaths()).toEqual([`${TASKS}/a`]);
    expect(remote(`${TASKS}/a`).title).toBe('Edited in the next session');
    expect(pushErrors).toHaveLength(1);
  });

  it('S8: rows of another tenant, or tagged with another organization, are never written', async () => {
    await boot();
    store.clients.push(clientRow(OTHER_CID, OTHER_ORG));
    store.tasks.push(taskRow('x', { clientId: OTHER_CID, organizationId: OTHER_ORG, title: 'Other tenant' }));
    store.tasks.push(taskRow('y', { organizationId: OTHER_ORG, title: 'Mis-tagged' }));
    task('a').title = 'S8 own tenant';
    push();
    await settle();

    expect(attemptedPaths()).toEqual([`${TASKS}/a`]);
    expect(attemptedPaths().some((path) => path.includes(OTHER_CID))).toBe(false);
    expect(h.state.remote.has(`${TASKS}/y`)).toBe(false);
  });

  it('S9: historical timestamps of untouched docs stay; edits never resend createdAt; creates stamp it once', async () => {
    await boot();
    Object.assign(task('a'), { title: 'S9 edit', updatedAt: T1 });
    store.tasks.push(taskRow('n', { title: 'S9 new', createdAt: T1 }));
    push();
    await settle();

    const edit = committedWrites(`${TASKS}/a`);
    expect(edit).toHaveLength(1);
    expect(Object.keys(edit[0]).sort()).toEqual(['title', 'updatedAt']);
    expect(edit[0].updatedAt).toMatchObject({ serverTimestamp: expect.any(Number) });
    expect(committedWrites(`${TASKS}/n`)[0].createdAt).toMatchObject({ serverTimestamp: expect.any(Number) });
    for (const id of ['b', 'c', 'd', 'u']) {
      expect(remote(`${TASKS}/${id}`)).toMatchObject({ createdAt: T0, updatedAt: T0 });
    }
    expect(remote(ROOT)).toMatchObject({ createdAt: T0, updatedAt: T0 });
  });

  it('S10: bootstrap/migration import still writes the full snapshot', async () => {
    await boot();
    await importSnapshotToFirestore(store);

    const written = new Set(h.state.commits.flatMap((commit) => commit.writes.map((write) => write.path)));
    expect([...written].sort()).toEqual([ROOT, ...TASK_IDS.map((id) => `${TASKS}/${id}`)].sort());
    expect(h.state.commits.every((commit) => commit.kind === 'batch')).toBe(true);
  });

  it('S11: re-scheduling a settled state writes nothing and a completion is counted once', async () => {
    await boot();
    complete('c');
    push();
    push();
    await settle();
    expect(remote(ROOT).completedTasksCount).toBe(6);

    h.state.attempts = [];
    push();
    push();
    await settle();
    expect(h.state.attempts).toEqual([]);

    foreignWrite(`${TASKS}/d`, { status: 'COMPLETED', completedAt: T1 });
    complete('d');
    push();
    await settle();
    expect(remote(ROOT).completedTasksCount).toBe(6);
    expect(store.clients[0].completedTasksCount).toBe(6);
  });

  it('S12: CLIENT persistence keeps its ordered batch path, untouched by the ADMIN transaction path', async () => {
    await boot(CLIENT);
    complete('a');
    push();
    await settle();

    expect(h.state.attempts.some((attempt) => attempt.kind === 'transaction')).toBe(false);
    const batch = h.state.commits.find((commit) => commit.writes.some((write) => write.path === `${TASKS}/a`));
    expect(batch?.kind).toBe('batch');
    expect(remote(`${TASKS}/a`).status).toBe('COMPLETED');
    expect(remote(ROOT).completedTasksCount).toBe(6);
    expect(pushErrors).toEqual([]);
  });
});
