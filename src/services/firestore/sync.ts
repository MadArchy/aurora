import type { LocalV5Snapshot } from './types';
import { getFirebaseAuth, getFirebaseFirestore } from '../../firebase/app';
import { readFirebaseConfig } from '../../firebase/config';
import { CLIENT_SUBCOLLECTIONS, clientDocPath } from './paths';
import { stripNonAuthoritativeContentHistory } from '../../domain/contentHistoryPolicy';
import { saveOutboxBundle } from './durableOutbox';

type CollectionKey = keyof LocalV5Snapshot;

const COLLECTION_MAP: Partial<Record<CollectionKey, typeof CLIENT_SUBCOLLECTIONS[number] | 'profile'>> = {
  signals: 'signals',
  tasks: 'tasks',
  curation: 'curation',
  deliveries: 'deliveries',
  contents: 'contents',
  opportunities: 'opportunities',
  results: 'results',
  theses: 'theses',
  campaigns: 'campaigns',
  campaignMilestones: 'campaignMilestones',
  evidenceVault: 'evidence',
  advices: 'advices',
  feedbackEvents: 'feedbackEvents',
  signalOutcomes: 'signalOutcomes',
  proofWallItems: 'proofWallItems',
  sources: 'sources',
  notifications: 'notifications',
  recommendations: 'recommendations',
  aiRuns: 'aiRuns',
};

/** Snapshot collection keys CLIENT may persist (SEC-009-020). */
export const CLIENT_PERSIST_COLLECTION_KEYS = [
  'tasks',
  'deliveries',
  'contents',
  'opportunities',
  'results',
  'theses',
  'evidenceVault',
  'feedbackEvents',
  'notifications',
] as const satisfies ReadonlyArray<CollectionKey>;

const CLIENT_PERSIST_KEY_SET = new Set<string>(CLIENT_PERSIST_COLLECTION_KEYS);

/**
 * Workflow fields written as serverTimestamp for SEC-009-017.
 * `createdAt` is write-once and handled by `applyCreatedAtWriteOnce`.
 */
const TRUSTED_SCALAR_TIME_FIELDS = new Set([
  'acknowledgedAt',
  'completedAt',
  'submittedAt',
  'clientApprovedAt',
  'updatedAt',
]);

/** Document paths observed to exist in Firestore (pull, realtime snapshots, committed writes). */
const knownRemoteDocPaths = new Set<string>();
/**
 * Collections kept current by a live realtime listener; a path absent there is new.
 * One-shot listings (pull, probes) go stale and never populate this set.
 */
const liveCollections = new Set<string>();
/**
 * Last server-confirmed data per document path (pull, realtime, probes, acknowledged CLIENT writes).
 * Pending local writes and cache-only snapshots never enter it; CLIENT persistence diffs against it.
 */
const remoteBaseline = new Map<string, Record<string, unknown>>();

/**
 * CLIENT rows captured for a push but not yet acknowledged by the server, by document path.
 * A realtime snapshot cannot replace them until the capture carrying them settles: success
 * releases versions up to the acknowledged one, failure drops every capture of that epoch.
 */
type PendingClientMutation = {
  collectionPath: string;
  clientId: string;
  organizationId: string | null;
  version: number;
  epoch: number;
  row: Record<string, unknown>;
};
const pendingClientMutations = new Map<string, PendingClientMutation>();

/** Base of a field on a document with no server-confirmed baseline: written as-is, never conflict-checked. */
const NO_BASE = Symbol('no-base');

type PendingAdminField = { value: unknown; base: unknown; version: number };

/**
 * ADMIN changes captured when they were scheduled and not yet acknowledged, by document path.
 * Kept apart from CLIENT mutations: each entry is bound to the tenant that captured it.
 * `create` is the full row of a document the server is not known to hold; otherwise `fields`
 * holds each changed field with the server value it was changed from (`base`).
 */
type PendingAdminDoc = {
  target: CollectionKey;
  clientId: string;
  id: string;
  organizationId: string | null;
  /** Identity that captured this mutation — dispatch requires an exact match. */
  originUid: string;
  originRole: string;
  originOrganizationId: string | null;
  originGeneration: number;
  create: { row: Record<string, unknown>; version: number } | null;
  fields: Map<string, PendingAdminField>;
};
const pendingAdminMutations = new Map<string, PendingAdminDoc>();
/**
 * Pending ADMIN work removed from the active dispatch queue when the capturing session ends.
 * Kept out of the new actor's queue; never dispatched under another uid.
 */
type OrphanedAdminBundle = {
  uid: string;
  organizationId: string | null;
  role: string;
  generation: number;
  mutations: Map<string, PendingAdminDoc>;
  message: string;
};
let orphanedAdminMutations: OrphanedAdminBundle | null = null;
/**
 * ADMIN commits acknowledged before the listener echoed them: a snapshot still showing the
 * pre-commit values is stale and must not revert the row; any other version ends the guard.
 */
type AdminEchoGuard = {
  clientId: string;
  organizationId: string | null;
  create: Record<string, unknown> | null;
  fields: Map<string, { value: unknown; before: unknown }>;
  expiresAt: number;
};
const adminEchoGuards = new Map<string, AdminEchoGuard>();
const ADMIN_ECHO_GUARD_MS = 30_000;
/**
 * ADMIN values discarded because their session ended (or was rejected) before ACK.
 * Each entry is tagged with the capturing identity so echo-suppression never applies to
 * another uid/org. Foreign identities may capture an identical value freely.
 */
type AbandonedAdminValues = {
  create: Record<string, unknown> | null;
  fields: Map<string, unknown>;
  originUid: string;
  originOrganizationId: string | null;
  originGeneration: number;
};
const abandonedAdminValues = new Map<string, AbandonedAdminValues>();

/**
 * Late remote outcomes that must not mutate the active session's store/baseline/queue.
 * Visible only to the origin identity (in-memory; lost on F5 — RR-01 not authorized).
 */
export type OriginRemoteReconciliation = {
  originUid: string;
  originOrganizationId: string | null;
  originGeneration: number;
  status: 'remote_confirmed_unapplied' | 'remote_uncertain';
  paths: string[];
  message: string;
};
let originRemoteReconciliations: OriginRemoteReconciliation[] = [];

/**
 * Test-only ACK pause after successful `runTransaction`, before local apply.
 * Requires Vite *dev* server with `--mode test` (Playwright webServer). Any
 * `vite build` sets DEV=false, so production and adversarial VITE_* envs cannot
 * enable the gate; the pause path DCE's out of production bundles.
 */
const ADMIN_COMMIT_ACK_GATE_ENABLED =
  import.meta.env.DEV === true && import.meta.env.MODE === 'test';

type AdminCommitAckGateState = {
  armed: boolean;
  /** When set, pause only chunks that include this document path. */
  matchPath: string | null;
  paused: boolean;
  paths: string[];
  release: (() => void) | null;
  wait: Promise<void> | null;
};

let adminCommitAckGate: AdminCommitAckGateState | null = null;

/** After a successful remote TX, optionally park before local ACK application (test only). */
async function pauseAfterRemoteAdminCommitAck(paths: ReadonlyArray<string>): Promise<void> {
  if (!ADMIN_COMMIT_ACK_GATE_ENABLED) return;
  const gate = adminCommitAckGate;
  if (!gate?.armed) return;
  if (gate.matchPath && !paths.includes(gate.matchPath)) return;
  gate.paths = [...paths];
  gate.paused = true;
  if (!gate.wait) {
    gate.wait = new Promise<void>((resolve) => {
      gate.release = () => {
        gate.paused = false;
        gate.wait = null;
        gate.release = null;
        resolve();
      };
    });
  }
  await gate.wait;
}

let adminCaptureVersion = 0;
/** Clients of the ADMIN tenant in the last capture; ADMIN removal intents are limited to them. */
let adminScopedClientIds = new Set<string>();

/**
 * Explicit remote removals recorded by local mutations. A merge snapshot push cannot express
 * a deleted document or a cleared field, so each intent names one exact client-scoped document.
 */
export type RemoteMutationIntent =
  | { kind: 'deleteDoc'; collection: CollectionKey; clientId: string; id: string }
  | { kind: 'clearFields'; collection: CollectionKey; clientId: string; id: string; fields: readonly string[] };

/** Pending ADMIN intents by document path; released only after the batch carrying them commits. */
const pendingDocDeletes = new Map<string, { clientId: string }>();
/** Field → registration generation, so a clear re-queued while a push is in flight survives it. */
const pendingFieldClears = new Map<string, { clientId: string; fields: Map<string, number> }>();
let fieldClearGeneration = 0;

export function resetKnownRemoteDocPaths() {
  knownRemoteDocPaths.clear();
  liveCollections.clear();
  remoteBaseline.clear();
  pendingClientMutations.clear();
  pendingAdminMutations.clear();
  orphanedAdminMutations = null;
  adminEchoGuards.clear();
  abandonedAdminValues.clear();
  originRemoteReconciliations = [];
  adminScopedClientIds = new Set();
  pendingDocDeletes.clear();
  pendingFieldClears.clear();
  if (ADMIN_COMMIT_ACK_GATE_ENABLED) {
    adminCommitAckGate?.release?.();
    adminCommitAckGate = null;
  }
}

function intentDocPath(intent: RemoteMutationIntent): string | null {
  const sub = COLLECTION_MAP[intent.collection];
  const clientId = intent.clientId?.trim();
  const id = intent.id?.trim();
  if (!sub || sub === 'profile' || !clientId || !id || clientId.includes('/') || id.includes('/')) return null;
  return `${clientDocPath(clientId)}/${sub}/${id}`;
}

export function queueRemoteMutationIntents(intents: ReadonlyArray<RemoteMutationIntent>) {
  for (const intent of intents) {
    const path = intentDocPath(intent);
    if (!path) continue;
    if (intent.kind === 'deleteDoc') {
      pendingDocDeletes.set(path, { clientId: intent.clientId });
      continue;
    }
    const entry = pendingFieldClears.get(path) ?? { clientId: intent.clientId, fields: new Map<string, number>() };
    for (const field of intent.fields) {
      if (field && !field.includes('.')) entry.fields.set(field, ++fieldClearGeneration);
    }
    if (entry.fields.size) pendingFieldClears.set(path, entry);
  }
}

function parentCollectionPath(docPath: string): string {
  return docPath.slice(0, docPath.lastIndexOf('/'));
}

function docIdOf(docPath: string): string {
  return docPath.slice(docPath.lastIndexOf('/') + 1);
}

function applyLiveCollectionSnapshot(collectionPath: string, docIds: Iterable<string>) {
  for (const path of knownRemoteDocPaths) {
    if (parentCollectionPath(path) === collectionPath) knownRemoteDocPaths.delete(path);
  }
  for (const id of docIds) knownRemoteDocPaths.add(`${collectionPath}/${id}`);
  liveCollections.add(collectionPath);
}

function markRemoteDocsKnown(collectionPath: string, docIds: Iterable<string>) {
  for (const id of docIds) knownRemoteDocPaths.add(`${collectionPath}/${id}`);
}

/** Only server-confirmed docs prove existence; pending local writes may still be rejected. */
type SnapshotMetadataCarrier = { metadata?: { hasPendingWrites?: boolean; fromCache?: boolean } };

function hasPendingWrites(row: { id: string }): boolean {
  return Boolean((row as SnapshotMetadataCarrier).metadata?.hasPendingWrites);
}

function confirmedDocIds(docs: ReadonlyArray<{ id: string }>): string[] {
  return docs.filter((row) => !hasPendingWrites(row)).map((row) => row.id);
}

function isFromCache(snap: unknown): boolean {
  return Boolean((snap as SnapshotMetadataCarrier).metadata?.fromCache);
}

type ServerDocLike = { id: string; data: () => unknown };

/** Callers pass only server-confirmed snapshots; `prune` drops docs absent from a complete listing. */
function recordRemoteBaseline(
  collectionPath: string,
  docs: ReadonlyArray<ServerDocLike>,
  options: { prune: boolean }
) {
  if (options.prune) {
    for (const path of remoteBaseline.keys()) {
      if (parentCollectionPath(path) === collectionPath) remoteBaseline.delete(path);
    }
  }
  for (const row of docs) {
    if (hasPendingWrites(row)) continue;
    remoteBaseline.set(
      `${collectionPath}/${row.id}`,
      normalizeFirestorePulledData((row.data() ?? {}) as Record<string, unknown>)
    );
  }
}

export type PersistenceActor = {
  role: string;
  clientId?: string | null;
  organizationId?: string | null;
  uid?: string | null;
};

/** Signed-in actor from the last token read; push scheduling is synchronous and cannot await claims. */
let sessionPersistenceActor: PersistenceActor | null = null;
/**
 * Session generation for ADMIN persistence. Stable for the same uid/org/role.
 * Bumped only on identity/authorization invalidation — not on every actor read.
 */
let persistenceGeneration = 0;

function actorIdentityKey(actor: PersistenceActor): string {
  return `${actor.uid ?? ''}|${actor.role}|${actor.organizationId ?? ''}`;
}

function itemsForClient<T extends { clientId?: string | null; id?: string }>(
  rows: T[],
  clientId: string
): T[] {
  return rows.filter((row) => row.clientId === clientId);
}

/**
 * SEC-009-020: CLIENT persistence must not attempt manager-only collections.
 * ADMIN retains full snapshot sync.
 */
export function filterSnapshotForPersistenceActor(
  snapshot: LocalV5Snapshot,
  actor: PersistenceActor
): LocalV5Snapshot {
  if (actor.role !== 'CLIENT') return snapshot;

  const clientId = actor.clientId?.trim() || '';
  if (!clientId) {
    return {
      ...snapshot,
      clients: [],
      signals: [],
      tasks: [],
      curation: [],
      deliveries: [],
      contents: [],
      opportunities: [],
      results: [],
      theses: [],
      campaigns: [],
      campaignMilestones: [],
      evidenceVault: [],
      advices: [],
      feedbackEvents: [],
      signalOutcomes: [],
      proofWallItems: [],
      sources: [],
      notifications: [],
      recommendations: [],
      aiRuns: [],
      profiles: {},
      dossiers: {},
    };
  }

  const filtered: LocalV5Snapshot = {
    ...snapshot,
    clients: snapshot.clients.filter((c) => c.id === clientId),
    signals: [],
    curation: [],
    campaigns: [],
    campaignMilestones: [],
    advices: [],
    signalOutcomes: [],
    proofWallItems: [],
    sources: [],
    recommendations: [],
    aiRuns: [],
    dossiers: {},
    profiles: snapshot.profiles[clientId]
      ? { [clientId]: snapshot.profiles[clientId] }
      : {},
    tasks: [],
    deliveries: [],
    contents: [],
    opportunities: [],
    results: [],
    theses: [],
    evidenceVault: [],
    feedbackEvents: [],
    notifications: [],
  };

  for (const key of CLIENT_PERSIST_COLLECTION_KEYS) {
    const rows = snapshot[key];
    if (!Array.isArray(rows)) continue;
    (filtered as unknown as Record<string, unknown>)[key] = itemsForClient(
      rows as Array<{ clientId?: string | null; id?: string }>,
      clientId
    );
  }

  return filtered;
}

export function clientPersistIncludesCollection(collectionKey: string): boolean {
  return CLIENT_PERSIST_KEY_SET.has(collectionKey);
}

/**
 * Firestore no acepta `undefined` en documentos. Quita claves undefined
 * (también anidadas) antes de batch.set / merge.
 */
export function stripUndefinedForFirestore<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedForFirestore(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue;
    out[key] = stripUndefinedForFirestore(entry);
  }
  return out as T;
}

function isFirestoreTimestampLike(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as { toDate?: unknown }).toDate === 'function'
  );
}

/** Convert Timestamps from pull into ISO strings for local domain models. */
export function normalizeFirestorePulledData<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (isFirestoreTimestampLike(value)) {
    return (value as unknown as { toDate: () => Date }).toDate().toISOString() as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFirestorePulledData(item)) as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = normalizeFirestorePulledData(entry);
    }
    return out as T;
  }
  return value;
}

/**
 * Replace trusted workflow clock fields with serverTimestamp so rules can
 * require request.time (SEC-009-017). Local memory keeps ISO strings.
 */
export function applyTrustedServerTimestamps(
  data: Record<string, unknown>,
  serverTimestamp: () => unknown
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const key of TRUSTED_SCALAR_TIME_FIELDS) {
    if (typeof out[key] === 'string') {
      out[key] = serverTimestamp();
    }
  }
  // Do not convert stateHistory[].at — Firestore rejects serverTimestamp inside arrays.
  if (Array.isArray(out.stateHistory) && out.stateHistory.length > 0) {
    /* keep client ISO strings for admin paths; CLIENT persist strips stateHistory */
  }
  return out;
}

/**
 * `createdAt` is write-once: stamped with serverTimestamp only when the document does not
 * exist remotely, and omitted from updates so a merge never replaces (or nulls) the stored value.
 */
export function applyCreatedAtWriteOnce(
  data: Record<string, unknown>,
  docExists: boolean,
  serverTimestamp: () => unknown
): Record<string, unknown> {
  if (!('createdAt' in data)) return data;
  const out: Record<string, unknown> = { ...data };
  if (docExists) {
    delete out.createdAt;
  } else {
    out.createdAt = serverTimestamp();
  }
  return out;
}

interface PrepareDocOptions {
  stripStateHistory?: boolean;
  client?: { id: string; organizationId?: string | null };
}

export function prepareDocForWrite(
  row: Record<string, unknown>,
  serverTimestamp: () => unknown,
  docExists: boolean,
  options?: PrepareDocOptions
): Record<string, unknown> {
  let base = stripUndefinedForFirestore(row) as Record<string, unknown>;
  if (options?.client) {
    base = ensureSubcollectionEnvelope(base, options.client);
  }
  base = applyCreatedAtWriteOnce(base, docExists, serverTimestamp);
  const prepared = applyTrustedServerTimestamps(base, serverTimestamp);
  if (options?.stripStateHistory && 'stateHistory' in prepared) {
    return stripNonAuthoritativeContentHistory(prepared);
  }
  return prepared;
}

/** T-009-14e: stamp denormalized tenant envelope on subcollection writes. */
export function ensureSubcollectionEnvelope(
  row: Record<string, unknown>,
  client: { id: string; organizationId?: string | null }
): Record<string, unknown> {
  const out = { ...row };
  const clientOrg =
    typeof client.organizationId === 'string' ? client.organizationId.trim() : '';
  if (clientOrg && typeof out.organizationId !== 'string') {
    out.organizationId = clientOrg;
  }
  if (typeof out.clientId !== 'string' || !out.clientId.trim()) {
    out.clientId = client.id;
  }
  return out;
}

/**
 * R-B01: `clients/{clientId}` field that coordinates the single open draft delivery.
 * Written only by `ensureActiveDraftDeliveryTransactional`; generic persistence never sends it.
 */
export const ACTIVE_DRAFT_DELIVERY_FIELD = 'activeDraftDeliveryId';

type SnapshotImportResult = { ok: boolean; message: string; written: number; discarded?: boolean };

let snapshotImportQueue: Promise<unknown> = Promise.resolve();

/**
 * Importa snapshot v5 a Firestore (Emulator o producción).
 * Imports run one at a time so create/update classification never races another push's pending writes.
 */
export function importSnapshotToFirestore(snapshot: LocalV5Snapshot): Promise<SnapshotImportResult> {
  return enqueueSnapshotImport(() => runSnapshotImport(snapshot));
}

/** Remote writes (imports and ADMIN pushes) run one at a time, in scheduling order. */
function enqueueSnapshotImport<T>(task: () => Promise<T>): Promise<T> {
  const run = snapshotImportQueue.then(task);
  snapshotImportQueue = run.catch(() => undefined);
  return run;
}

async function readPersistenceActor(): Promise<PersistenceActor> {
  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return { role: 'ADMIN' };
  const token = await user.getIdTokenResult();
  const actor: PersistenceActor = {
    role: typeof token.claims.role === 'string' ? token.claims.role : 'ADMIN',
    clientId: typeof token.claims.clientId === 'string' ? token.claims.clientId : null,
    organizationId:
      typeof token.claims.organizationId === 'string' ? token.claims.organizationId : null,
    uid: user.uid,
  };
  // Bump only when replacing a known actor with a different identity — not on first bind after clear.
  if (sessionPersistenceActor && actorIdentityKey(sessionPersistenceActor) !== actorIdentityKey(actor)) {
    persistenceGeneration++;
  }
  sessionPersistenceActor = actor;
  return actor;
}

async function runSnapshotImport(snapshot: LocalV5Snapshot): Promise<SnapshotImportResult> {
  if (!readFirebaseConfig()) {
    return { ok: false, message: 'Configura VITE_FIREBASE_* para importar.', written: 0 };
  }

  const db = await getFirebaseFirestore();
  if (!db) return { ok: false, message: 'Firestore no inicializado.', written: 0 };

  const actor = await readPersistenceActor();

  const scoped = filterSnapshotForPersistenceActor(snapshot, actor);
  const isClientActor = actor.role === 'CLIENT';

  const planned: PlannedWrite[] = [];

  for (const client of scoped.clients) {
    if (isClientActor && actor.clientId && client.id !== actor.clientId) continue;
    const envelope = { id: client.id, organizationId: client.organizationId };

    const rootRow = { ...(client as unknown as Record<string, unknown>) };
    // Coordination field owned by the draft transaction; never written from a local snapshot.
    delete rootRow[ACTIVE_DRAFT_DELIVERY_FIELD];
    planned.push({
      path: clientDocPath(client.id),
      envelopeClientId: null,
      collection: 'root',
      row: rootRow,
    });

    for (const [key, subName] of Object.entries(COLLECTION_MAP)) {
      if (isClientActor && !CLIENT_PERSIST_KEY_SET.has(key)) continue;
      const rows = scoped[key as CollectionKey];
      if (!Array.isArray(rows)) continue;
      for (const row of itemsForClient(rows as Array<{ clientId?: string | null; id?: string }>, client.id)) {
        if (!row.id) continue;
        planned.push({
          path: `${clientDocPath(client.id)}/${subName}/${row.id}`,
          envelopeClientId: client.id,
          collection: subName,
          row: row as unknown as Record<string, unknown>,
          options: { stripStateHistory: isClientActor && subName === 'contents', client: envelope },
        });
      }
    }

    const profile = scoped.profiles[client.id];
    if (profile) {
      planned.push({
        path: `${clientDocPath(client.id)}/profile/data`,
        envelopeClientId: client.id,
        collection: 'profile',
        row: profile as unknown as Record<string, unknown>,
        options: { client: envelope },
      });
    }

    if (!isClientActor) {
      const dossier = scoped.dossiers[client.id];
      if (dossier) {
        planned.push({
          path: `${clientDocPath(client.id)}/dossier/data`,
          envelopeClientId: client.id,
          collection: 'dossier',
          row: dossier as unknown as Record<string, unknown>,
          options: { client: envelope },
        });
      }
    }
  }

  // Remote removals are ADMIN-only and limited to clients present in this tenant snapshot.
  const scopedClientIds = new Set(scoped.clients.map((client) => client.id));
  const deleteTargets = isClientActor
    ? []
    : [...pendingDocDeletes]
        .filter(([, intent]) => scopedClientIds.has(intent.clientId))
        .map(([path, intent]) => ({ path, envelopeClientId: intent.clientId }));

  const existing = await resolveExistingDocPaths(db, [...planned, ...deleteTargets], {
    organizationId: actor.organizationId?.trim() || null,
    // Root client create is ADMIN-only, so a CLIENT's own root doc always exists.
    rootAlwaysExists: isClientActor,
  });

  const firestore = await import('firebase/firestore');
  const { doc, writeBatch, serverTimestamp } = firestore;

  let writes: PreparedWrite[];
  if (isClientActor) {
    await fillMissingClientBaselines(db, planned, existing, actor.organizationId?.trim() || null);
    writes = projectClientWrites(planned, existing, serverTimestamp);
  } else {
    writes = planAdminWrites(planned, deleteTargets, existing, scopedClientIds, serverTimestamp, () =>
      firestore.deleteField()
    );
  }

  let written = 0;
  let batch = writeBatch(db);
  let batchWrites: PreparedWrite[] = [];

  const flush = async () => {
    if (batchWrites.length === 0) return;
    try {
      await batch.commit();
    } catch (err) {
      // Existence is re-established next push, so a delete of an already-absent doc is dropped.
      for (const write of batchWrites) {
        if (write.delete) knownRemoteDocPaths.delete(write.path);
      }
      throw err;
    }
    for (const write of batchWrites) {
      if (write.delete) {
        knownRemoteDocPaths.delete(write.path);
        remoteBaseline.delete(write.path);
        pendingDocDeletes.delete(write.path);
        continue;
      }
      knownRemoteDocPaths.add(write.path);
      realtimeCollections.get(parentCollectionPath(write.path))?.committedSince.add(docIdOf(write.path));
      if (write.confirmed) {
        remoteBaseline.set(write.path, { ...(remoteBaseline.get(write.path) ?? {}), ...write.confirmed });
      }
      if (write.clearedFields) releaseFieldClears(write.path, write.clearedFields);
    }
    batch = writeBatch(db!);
    batchWrites = [];
  };

  for (const write of writes) {
    if (write.delete) {
      batch.delete(doc(db, write.path));
    } else {
      batch.set(doc(db, write.path), write.data, { merge: true });
    }
    batchWrites.push(write);
    written += 1;
    if (batchWrites.length >= 400) await flush();
  }

  await flush();
  return { ok: true, message: `Importados ${written} documentos a Firestore.`, written };
}

interface PlannedWrite {
  path: string;
  /** Parent client id for subcollection docs; null for the root client doc. */
  envelopeClientId: string | null;
  /** `root`, `profile`, `dossier`, or the Firestore subcollection name. */
  collection: string;
  row: Record<string, unknown>;
  options?: PrepareDocOptions;
}

interface PreparedWrite {
  path: string;
  data: Record<string, unknown>;
  /** Local values the write makes server state once committed (CLIENT baseline). */
  confirmed?: Record<string, unknown>;
  /** ADMIN delete intent: the doc is deleted instead of written. */
  delete?: boolean;
  /** ADMIN clear intents (field → generation) this write settles once committed. */
  clearedFields?: ReadonlyMap<string, number>;
}

/**
 * ADMIN plan: deletes first, then merge writes. A doc with a delete intent is never written;
 * cleared fields still absent locally become `deleteField()` so the merge cannot keep them.
 */
function planAdminWrites(
  planned: ReadonlyArray<PlannedWrite>,
  deleteTargets: ReadonlyArray<{ path: string }>,
  existing: ReadonlySet<string>,
  scopedClientIds: ReadonlySet<string>,
  serverTimestamp: () => unknown,
  deleteField: () => unknown
): PreparedWrite[] {
  const out: PreparedWrite[] = [];
  const deleting = new Set<string>();
  for (const target of deleteTargets) {
    if (existing.has(target.path)) {
      deleting.add(target.path);
      out.push({ path: target.path, data: {}, delete: true });
    } else {
      pendingDocDeletes.delete(target.path);
    }
  }

  const plannedPaths = new Set<string>();
  for (const write of planned) {
    if (deleting.has(write.path)) continue;
    plannedPaths.add(write.path);
    const docExists = existing.has(write.path);
    const data = prepareDocForWrite(write.row, serverTimestamp, docExists, write.options);
    const clear = pendingFieldClears.get(write.path);
    if (!clear) {
      out.push({ path: write.path, data });
      continue;
    }
    // A field set again locally since the clear keeps its new value; the intent is settled either way.
    if (docExists) {
      for (const field of clear.fields.keys()) {
        if (!(field in data)) data[field] = deleteField();
      }
    }
    out.push({ path: write.path, data, clearedFields: new Map(clear.fields) });
  }

  for (const [path, clear] of pendingFieldClears) {
    if (!plannedPaths.has(path) && scopedClientIds.has(clear.clientId)) pendingFieldClears.delete(path);
  }
  return out;
}

function releaseFieldClears(path: string, settled: ReadonlyMap<string, number>) {
  const clear = pendingFieldClears.get(path);
  if (!clear) return;
  for (const [field, generation] of settled) {
    if (clear.fields.get(field) === generation) clear.fields.delete(field);
  }
  if (clear.fields.size === 0) pendingFieldClears.delete(path);
}

/**
 * CLIENT write contract per collection, mirroring firestore.rules. Collections absent here
 * are ADMIN/SYSTEM-owned and never written by CLIENT persistence.
 * `create`: whole new docs may be sent. `update`: fields a CLIENT may change on existing docs.
 * `canUpdate`: rule-level transition shape the local row must already satisfy.
 */
interface ClientWritePolicy {
  create: boolean | ((row: Record<string, unknown>) => boolean);
  createKeys?: readonly string[];
  update: readonly string[];
  canUpdate?: (row: Record<string, unknown>) => boolean;
}

const CLIENT_PROFILE_KEYS = [
  'organizationId', 'clientId',
  'identity', 'goals', 'audience', 'career', 'education', 'careerHistory',
  'ventures', 'keyPublications', 'socialLinks', 'voicePreferences',
  'facts', 'cvExtractedText', 'onboardingCompleted', 'onboardingCurrentStep',
  'updatedAt',
] as const;

const CLIENT_WRITE_POLICIES: Readonly<Record<string, ClientWritePolicy>> = {
  root: {
    create: false,
    update: [
      'userId', 'onboardingStatus', 'profileCompleteness', 'status',
      'displayName', 'firstName', 'lastName', 'profession', 'company',
      'targetMarket', 'completedTasksCount', 'updatedAt',
    ],
  },
  profile: {
    create: true,
    createKeys: CLIENT_PROFILE_KEYS,
    update: CLIENT_PROFILE_KEYS.filter((key) => key !== 'organizationId' && key !== 'clientId'),
  },
  tasks: {
    create: false,
    update: ['status', 'clientNotes', 'evidenceUrl', 'completedAt', 'updatedAt'],
  },
  deliveries: {
    create: false,
    update: ['status', 'acknowledgedAt', 'clientAckNote', 'updatedAt'],
    canUpdate: (row) => row.status === 'ACKNOWLEDGED',
  },
  contents: {
    create: false,
    update: [
      'title', 'body', 'clientFeedback', 'clientReviewBaseline',
      'pipelineStatus', 'status', 'updatedAt',
    ],
  },
  opportunities: {
    create: false,
    update: [
      'clientDecision', 'clientNotes', 'status', 'lifecycleStage',
      'submissionChecklist', 'submittedAt', 'updatedAt',
    ],
  },
  theses: {
    create: false,
    update: [
      'clientApprovalStatus', 'clientApprovedAt', 'clientFeedback',
      'pendingRevision', 'status', 'updatedAt', 'updatedBy',
      'title', 'expertIdentity', 'targetAudience', 'secondaryAudience',
      'domain', 'objective', 'proofPoints', 'differentiator', 'voiceAndTone',
      'complianceRules', 'identityCurrent', 'perceptionTarget', 'audiences',
      'territories', 'objectives', 'voiceProfile', 'limits', 'priority',
    ],
  },
  results: { create: true, update: [] },
  evidence: { create: true, update: [] },
  feedbackEvents: { create: true, update: [] },
  notifications: {
    create: (row) => row.read === false,
    update: ['read', 'updatedAt'],
    canUpdate: (row) => row.read === true,
  },
};

/** Stable structural comparison of pulled (ISO-normalized) and local values. */
function sameFieldValue(a: unknown, b: unknown): boolean {
  return stableSerialize(normalizeFirestorePulledData(a)) === stableSerialize(normalizeFirestorePulledData(b));
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(',')}}`;
}

function pickKeys(row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in row) out[key] = row[key];
  }
  return out;
}

/**
 * Existing docs the CLIENT may update but that have no server-confirmed baseline yet
 * (e.g. only seen in a cache/pending snapshot) are read once from the server so dirtiness
 * can be decided. Docs that still lack a baseline are skipped rather than blindly re-sent.
 */
async function fillMissingClientBaselines(
  db: NonNullable<Awaited<ReturnType<typeof getFirebaseFirestore>>>,
  planned: ReadonlyArray<PlannedWrite>,
  existing: ReadonlySet<string>,
  organizationId: string | null
) {
  const { collection, doc, getDoc, getDocs, query, where } = await import('firebase/firestore');
  const collectionsToList = new Map<string, string>();
  for (const write of planned) {
    const policy = CLIENT_WRITE_POLICIES[write.collection];
    if (!policy || policy.update.length === 0) continue;
    if (!existing.has(write.path) || remoteBaseline.has(write.path)) continue;
    if (write.envelopeClientId === null) {
      try {
        const snap = await getDoc(doc(db, write.path));
        if (snap.exists() && !isFromCache(snap) && !hasPendingWrites(snap as unknown as { id: string })) {
          remoteBaseline.set(write.path, normalizeFirestorePulledData((snap.data() ?? {}) as Record<string, unknown>));
        }
      } catch {
        // No baseline: the root doc is skipped this push.
      }
    } else if (organizationId) {
      collectionsToList.set(parentCollectionPath(write.path), write.envelopeClientId);
    }
  }
  if (collectionsToList.size === 0 || !organizationId) return;

  for (const [collectionPath, envelopeClientId] of collectionsToList) {
    try {
      const snap = await getDocs(
        query(
          collection(db, collectionPath),
          where('organizationId', '==', organizationId),
          where('clientId', '==', envelopeClientId)
        )
      );
      markRemoteDocsKnown(collectionPath, confirmedDocIds(snap.docs));
      if (!isFromCache(snap)) recordRemoteBaseline(collectionPath, snap.docs, { prune: false });
    } catch {
      // No baseline: those docs are skipped this push.
    }
  }
}

/** Existing tasks this CLIENT push moves to COMPLETED, per parent client doc path. */
function taskCompletionsByClient(
  planned: ReadonlyArray<PlannedWrite>,
  existing: ReadonlySet<string>
): Map<string, number> {
  const out = new Map<string, number>();
  for (const write of planned) {
    if (write.collection !== 'tasks' || write.envelopeClientId === null || !existing.has(write.path)) continue;
    const baseline = remoteBaseline.get(write.path);
    if (!baseline || write.row.status !== 'COMPLETED' || baseline.status === 'COMPLETED') continue;
    const root = clientDocPath(write.envelopeClientId);
    out.set(root, (out.get(root) ?? 0) + 1);
  }
  return out;
}

/**
 * `completedTasksCount` is never sent as the local tally: it is the server baseline plus the
 * task completions committed in the same atomic batch, so a lost or rejected task write cannot
 * leave the counter ahead, and resending the same push cannot count a completion twice.
 */
function withDerivedCompletedTasksCount(
  row: Record<string, unknown>,
  baseline: Record<string, unknown>,
  completions: number
): Record<string, unknown> {
  if (!('completedTasksCount' in row)) return row;
  const out = { ...row };
  delete out.completedTasksCount;
  if (completions === 0) return out;
  const base = typeof baseline.completedTasksCount === 'number' ? baseline.completedTasksCount : 0;
  out.completedTasksCount = base + completions;
  return out;
}

/**
 * W4 CLIENT persistence: only docs whose CLIENT-writable state differs from the server
 * baseline are sent, projected to the fields the rules let a CLIENT change. Server-stamped
 * time fields never make a doc dirty; they ride along only with a real change.
 */
function projectClientWrites(
  planned: ReadonlyArray<PlannedWrite>,
  existing: ReadonlySet<string>,
  serverTimestamp: () => unknown
): PreparedWrite[] {
  const out: PreparedWrite[] = [];
  const completions = taskCompletionsByClient(planned, existing);
  for (const write of planned) {
    const policy = CLIENT_WRITE_POLICIES[write.collection];
    if (!policy) continue;
    const row = stripUndefinedForFirestore(write.row) as Record<string, unknown>;

    if (!existing.has(write.path)) {
      const allowed = typeof policy.create === 'function' ? policy.create(row) : policy.create;
      if (!allowed) continue;
      const source = policy.createKeys ? pickKeys(row, policy.createKeys) : row;
      const createOptions = policy.createKeys
        ? { client: write.options?.client }
        : write.options;
      const createRow =
        createOptions?.client ? ensureSubcollectionEnvelope(source, createOptions.client) : source;
      out.push({
        path: write.path,
        data: prepareDocForWrite(source, serverTimestamp, false, createOptions),
        confirmed: createRow,
      });
      continue;
    }

    if (policy.update.length === 0) continue;
    if (policy.canUpdate && !policy.canUpdate(row)) continue;
    const baseline = remoteBaseline.get(write.path);
    if (!baseline) continue;
    const source =
      write.collection === 'root'
        ? withDerivedCompletedTasksCount(row, baseline, completions.get(write.path) ?? 0)
        : row;

    const changed = policy.update.filter(
      (key) => !TRUSTED_SCALAR_TIME_FIELDS.has(key) && key in source && !sameFieldValue(source[key], baseline[key])
    );
    if (changed.length === 0) continue;

    const payload = pickKeys(source, changed);
    for (const key of policy.update) {
      if (!TRUSTED_SCALAR_TIME_FIELDS.has(key) || typeof source[key] !== 'string') continue;
      if (key === 'updatedAt' || !sameFieldValue(source[key], baseline[key])) payload[key] = source[key];
    }
    out.push({
      path: write.path,
      data: prepareDocForWrite(payload, serverTimestamp, true),
      confirmed: payload,
    });
  }
  return out;
}

/**
 * Create/update signal for `createdAt`: remote existence, never the local field value.
 * Known paths exist; unknown paths in a live-listened collection are new; otherwise the
 * collection is listed with the same envelope-scoped query the rules allow for reads.
 * If existence cannot be established the doc is treated as existing so `createdAt` is never re-stamped.
 */
export async function resolveExistingDocPaths(
  db: NonNullable<Awaited<ReturnType<typeof getFirebaseFirestore>>>,
  writes: ReadonlyArray<Pick<PlannedWrite, 'path' | 'envelopeClientId'>>,
  context: { organizationId: string | null; rootAlwaysExists: boolean }
): Promise<Set<string>> {
  const existing = new Set<string>();
  const toProbe = new Map<string, Array<Pick<PlannedWrite, 'path' | 'envelopeClientId'>>>();

  for (const write of writes) {
    const isRoot = write.envelopeClientId === null;
    const collectionPath = parentCollectionPath(write.path);
    if (knownRemoteDocPaths.has(write.path) || (isRoot && context.rootAlwaysExists)) {
      existing.add(write.path);
    } else if (liveCollections.has(collectionPath)) {
      continue;
    } else if (!context.organizationId) {
      existing.add(write.path);
    } else {
      const group = toProbe.get(collectionPath) ?? [];
      group.push(write);
      toProbe.set(collectionPath, group);
    }
  }
  if (toProbe.size === 0) return existing;

  const { collection, getDocs, query, where } = await import('firebase/firestore');
  for (const [collectionPath, group] of toProbe) {
    const envelopeClientId = group[0].envelopeClientId;
    const scopedQuery =
      envelopeClientId === null
        ? query(collection(db, collectionPath), where('organizationId', '==', context.organizationId))
        : query(
            collection(db, collectionPath),
            where('organizationId', '==', context.organizationId),
            where('clientId', '==', envelopeClientId)
          );
    try {
      const snap = await getDocs(scopedQuery);
      markRemoteDocsKnown(collectionPath, confirmedDocIds(snap.docs));
      if (!isFromCache(snap)) recordRemoteBaseline(collectionPath, snap.docs, { prune: false });
      const pendingPaths = new Set(
        snap.docs.filter(hasPendingWrites).map((row) => `${collectionPath}/${row.id}`)
      );
      for (const write of group) {
        if (isFromCache(snap) || pendingPaths.has(write.path) || knownRemoteDocPaths.has(write.path)) {
          existing.add(write.path);
        }
      }
    } catch {
      for (const write of group) existing.add(write.path);
    }
  }
  return existing;
}


/**
 * Resolve the tenant org for Q1 client listing.
 * Authenticated org always wins; a non-empty requested org must match auth org.
 * Returns null when the query must not run (fail-closed).
 */
export function resolveTenantOrganizationIdForQuery(
  authenticatedOrganizationId: string | null | undefined,
  requestedOrganizationId?: string
): string | null {
  const authOrg = authenticatedOrganizationId?.trim() || '';
  if (!authOrg) return null;
  const requested = requestedOrganizationId?.trim() || '';
  if (requested && requested !== authOrg) return null;
  return authOrg;
}

/**
 * Bumped when an ADMIN directory load starts or the session ends.
 * An in-flight read that does not match must not prune baselines or apply rows.
 */
let adminReadGeneration = 0;

export function invalidateAdminReads(): number {
  adminReadGeneration += 1;
  return adminReadGeneration;
}

export function currentAdminReadGeneration(): number {
  return adminReadGeneration;
}

function adminReadStillCurrent(readGeneration: number | undefined): boolean {
  return readGeneration === undefined || readGeneration === adminReadGeneration;
}

/**
 * `null` keeps the previous ADMIN capture (every subcollection row in memory).
 * A set limits subcollection, profile and dossier captures to those clients.
 * Client roots stay eligible: the directory listing is complete.
 */
let adminSubcollectionPushScope: ReadonlySet<string> | null = null;
/**
 * Subcollections whose complete server listing was applied for one client.
 * A confirmation authorizes capture of that collection only.
 */
const adminConfirmedSubcollections = new Map<string, ReadonlySet<string>>();

export function setAdminSubcollectionPushScope(clientIds: ReadonlySet<string> | null): void {
  adminSubcollectionPushScope = clientIds;
}

export function markAdminSubcollectionConfirmed(
  clientId: string,
  subcollection: 'deliveries'
): void {
  const confirmed = new Set(adminConfirmedSubcollections.get(clientId) ?? []);
  confirmed.add(subcollection);
  adminConfirmedSubcollections.set(clientId, confirmed);
}

export function clearAdminConfirmedSubcollections(): void {
  adminConfirmedSubcollections.clear();
}

/** Listeners opened per client: `REALTIME_SUBS` plus the evidence collection. */
export function firestoreRealtimeListenersPerClient(): number {
  return REALTIME_SUBS.length + 1;
}

/** Listeners attached to the current session. Released on sign-out. */
export function activeFirestoreListenerCount(): number {
  return realtimeUnsubs.length;
}

/**
 * ADMIN directory only: the tenant client roots, with no subcollection reads and no
 * baseline pruning. A cache-only snapshot is not an authoritative directory.
 */
export async function pullClientDirectoryFromFirestore(
  readGeneration?: number
): Promise<
  | { ok: true; clients: LocalV5Snapshot['clients'] }
  | { ok: false; reason: string }
> {
  try {
    if (!adminReadStillCurrent(readGeneration)) return { ok: false, reason: 'stale-admin-read' };
    const db = await getFirebaseFirestore();
    if (!db) return { ok: false, reason: 'firestore-unavailable' };
    const scope = await readTenantReadScope();
    if (!scope?.isAdmin) return { ok: false, reason: 'not-admin' };

    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const snap = await getDocs(
      query(collection(db, 'clients'), where('organizationId', '==', scope.organizationId))
    );
    if (!adminReadStillCurrent(readGeneration)) return { ok: false, reason: 'stale-admin-read' };
    if (isFromCache(snap)) return { ok: false, reason: 'directory-not-from-server' };

    const clients: LocalV5Snapshot['clients'] = [];
    for (const docSnap of snap.docs) {
      knownRemoteDocPaths.add(clientDocPath(docSnap.id));
      if (!hasPendingWrites(docSnap)) {
        remoteBaseline.set(
          clientDocPath(docSnap.id),
          normalizeFirestorePulledData((docSnap.data() ?? {}) as Record<string, unknown>)
        );
      }
      clients.push(
        normalizeFirestorePulledData({ id: docSnap.id, ...docSnap.data() }) as LocalV5Snapshot['clients'][number]
      );
    }
    return { ok: true, clients };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'directory-query-failed' };
  }
}

/**
 * SPEC-009 Q1: list clients for the authenticated tenant only.
 * Security Rules are not filters — never unscoped getDocs(collection('clients')).
 * Optional organizationId arg is validated against the auth token org (no arbitrary tenant).
 */
export async function listFirestoreClientIds(organizationId?: string): Promise<string[]> {
  const db = await getFirebaseFirestore();
  if (!db) return [];

  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return [];
  const token = await user.getIdTokenResult();
  const authOrg =
    typeof token.claims.organizationId === 'string' ? token.claims.organizationId : '';

  const orgId = resolveTenantOrganizationIdForQuery(authOrg, organizationId);
  if (!orgId) return [];

  const { collection, getDocs, query, where } = await import('firebase/firestore');
  const snap = await getDocs(query(collection(db, 'clients'), where('organizationId', '==', orgId)));
  return snap.docs.map((docSnap) => docSnap.id);
}

/** Subcollections whose read rule is ADMIN-only; CLIENT sessions must not query them. */
const ADMIN_ONLY_READ_SUBCOLLECTIONS: ReadonlySet<string> = new Set(['signalOutcomes']);

interface TenantReadScope {
  organizationId: string;
  isAdmin: boolean;
}

async function readTenantReadScope(): Promise<TenantReadScope | null> {
  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return null;
  const token = await user.getIdTokenResult();
  const organizationId =
    typeof token.claims.organizationId === 'string' ? token.claims.organizationId.trim() : '';
  const nextActor: PersistenceActor | null = organizationId
    ? {
        role: typeof token.claims.role === 'string' ? token.claims.role : '',
        clientId: typeof token.claims.clientId === 'string' ? token.claims.clientId : null,
        organizationId,
        uid: user.uid,
      }
    : null;
  if (
    sessionPersistenceActor &&
    nextActor &&
    actorIdentityKey(sessionPersistenceActor) !== actorIdentityKey(nextActor)
  ) {
    persistenceGeneration++;
  } else if (sessionPersistenceActor && !nextActor) {
    persistenceGeneration++;
  }
  sessionPersistenceActor = nextActor;
  if (!organizationId) return null;
  return { organizationId, isAdmin: token.claims.role === 'ADMIN' };
}

export function isClientSubcollectionReadable(sub: string, scope: TenantReadScope | null): boolean {
  if (!scope) return false;
  return scope.isAdmin || !ADMIN_ONLY_READ_SUBCOLLECTIONS.has(sub);
}

/**
 * Security Rules are not filters: subcollection reads require organizationId AND clientId
 * equality so every returned doc provably satisfies the envelope rule.
 */
async function scopedClientSubcollectionQuery(
  db: NonNullable<Awaited<ReturnType<typeof getFirebaseFirestore>>>,
  clientId: string,
  sub: string,
  scope: TenantReadScope
) {
  const { collection, query, where } = await import('firebase/firestore');
  return query(
    collection(db, `${clientDocPath(clientId)}/${sub}`),
    where('organizationId', '==', scope.organizationId),
    where('clientId', '==', clientId)
  );
}

/** Descarga datos de Firestore para un cliente (o todos si admin). */
export async function pullClientDataFromFirestore(
  clientIds: string[],
  options?: { skipClientRoots?: boolean }
): Promise<Partial<LocalV5Snapshot>> {
  const db = await getFirebaseFirestore();
  if (!db) return {};

  const { doc, getDoc, getDocs } = await import('firebase/firestore');
  const scope = await readTenantReadScope();
  const partial: Partial<LocalV5Snapshot> = {
    signals: [],
    tasks: [],
    curation: [],
    deliveries: [],
    contents: [],
    opportunities: [],
    results: [],
    theses: [],
    campaigns: [],
    evidenceVault: [],
    advices: [],
    feedbackEvents: [],
    signalOutcomes: [],
    campaignMilestones: [],
    proofWallItems: [],
    sources: [],
    notifications: [],
    recommendations: [],
    aiRuns: [],
    profiles: {},
    dossiers: {},
  };

  if (!options?.skipClientRoots) partial.clients = [];

  for (const clientId of clientIds) {
    if (!options?.skipClientRoots) {
      const clientSnap = await getDoc(doc(db, clientDocPath(clientId)));
      if (clientSnap.exists()) {
        knownRemoteDocPaths.add(clientDocPath(clientId));
        if (!isFromCache(clientSnap) && !hasPendingWrites(clientSnap as unknown as { id: string })) {
          remoteBaseline.set(
            clientDocPath(clientId),
            normalizeFirestorePulledData((clientSnap.data() ?? {}) as Record<string, unknown>)
          );
        }
        partial.clients!.push(
          normalizeFirestorePulledData(clientSnap.data()) as unknown as LocalV5Snapshot['clients'][number]
        );
      }
    }

    for (const sub of CLIENT_SUBCOLLECTIONS) {
      if (!scope || !isClientSubcollectionReadable(sub, scope)) continue;
      const snap = await getDocs(await scopedClientSubcollectionQuery(db, clientId, sub, scope));
      markRemoteDocsKnown(`${clientDocPath(clientId)}/${sub}`, confirmedDocIds(snap.docs));
      if (!isFromCache(snap)) {
        recordRemoteBaseline(`${clientDocPath(clientId)}/${sub}`, snap.docs, { prune: true });
      }
      const targetKey = Object.entries(COLLECTION_MAP).find(([, v]) => v === sub)?.[0] as CollectionKey | undefined;
      if (!targetKey || !Array.isArray(partial[targetKey])) continue;
      for (const row of snap.docs) {
        (partial[targetKey] as unknown[]).push(
          normalizeFirestorePulledData({ id: row.id, ...row.data() })
        );
      }
    }

    if (!scope) continue;

    // A missing singleton doc is denied (not "absent") by envelope rules; list it scoped instead.
    const profileSnap = await getDocs(await scopedClientSubcollectionQuery(db, clientId, 'profile', scope));
    markRemoteDocsKnown(`${clientDocPath(clientId)}/profile`, confirmedDocIds(profileSnap.docs));
    if (!isFromCache(profileSnap)) {
      recordRemoteBaseline(`${clientDocPath(clientId)}/profile`, profileSnap.docs, { prune: true });
    }
    const profileDoc = profileSnap.docs.find((row) => row.id === 'data');
    if (profileDoc) {
      partial.profiles![clientId] = normalizeFirestorePulledData(
        profileDoc.data()
      ) as unknown as LocalV5Snapshot['profiles'][string];
    }

    const dossierSnap = await getDocs(await scopedClientSubcollectionQuery(db, clientId, 'dossier', scope));
    markRemoteDocsKnown(`${clientDocPath(clientId)}/dossier`, confirmedDocIds(dossierSnap.docs));
    if (!isFromCache(dossierSnap)) {
      recordRemoteBaseline(`${clientDocPath(clientId)}/dossier`, dossierSnap.docs, { prune: true });
    }
    const dossierDoc = dossierSnap.docs.find((row) => row.id === 'data');
    if (dossierDoc) {
      partial.dossiers![clientId] = normalizeFirestorePulledData(
        dossierDoc.data()
      ) as unknown as LocalV5Snapshot['dossiers'][string];
    }
  }

  return partial;
}

/**
 * Complete server listing of one client's operational collections.
 * Cache, a stale session, or a failed read records nothing and prunes nothing.
 */
export async function pullAuthoritativeClientOperations(
  clientId: string,
  readGeneration: number
): Promise<Partial<LocalV5Snapshot>> {
  if (!adminReadStillCurrent(readGeneration)) throw new Error('stale-admin-read');
  const db = await getFirebaseFirestore();
  if (!db) throw new Error('firestore-unavailable');
  const scope = await readTenantReadScope();
  if (!scope?.isAdmin) throw new Error('not-admin');
  if (!adminReadStillCurrent(readGeneration)) throw new Error('stale-admin-read');

  const { getDocs } = await import('firebase/firestore');
  const partial: Partial<LocalV5Snapshot> = {
    signals: [],
    tasks: [],
    curation: [],
    deliveries: [],
    contents: [],
    opportunities: [],
    results: [],
    theses: [],
    campaigns: [],
    evidenceVault: [],
    advices: [],
    feedbackEvents: [],
    signalOutcomes: [],
    campaignMilestones: [],
    proofWallItems: [],
    sources: [],
    notifications: [],
    recommendations: [],
    aiRuns: [],
    profiles: {},
    dossiers: {},
  };
  const confirmed: Array<{ path: string; docs: ReadonlyArray<ServerDocLike> }> = [];

  const readCollection = async (sub: string) => {
    if (!isClientSubcollectionReadable(sub, scope)) return null;
    const collectionPath = `${clientDocPath(clientId)}/${sub}`;
    const snap = await getDocs(await scopedClientSubcollectionQuery(db, clientId, sub, scope));
    if (!adminReadStillCurrent(readGeneration)) throw new Error('stale-admin-read');
    if (isFromCache(snap)) throw new Error('snapshot-from-cache');
    return { path: collectionPath, snap };
  };

  for (const sub of CLIENT_SUBCOLLECTIONS) {
    const read = await readCollection(sub);
    if (!read) continue;
    confirmed.push({ path: read.path, docs: read.snap.docs });
    const targetKey = Object.entries(COLLECTION_MAP).find(([, value]) => value === sub)?.[0] as
      | CollectionKey
      | undefined;
    if (!targetKey || !Array.isArray(partial[targetKey])) continue;
    for (const row of read.snap.docs) {
      (partial[targetKey] as unknown[]).push(
        normalizeFirestorePulledData({ id: row.id, ...row.data() })
      );
    }
  }

  const profile = await readCollection('profile');
  const dossier = await readCollection('dossier');
  if (!adminReadStillCurrent(readGeneration)) throw new Error('stale-admin-read');

  for (const entry of confirmed) {
    markRemoteDocsKnown(entry.path, confirmedDocIds(entry.docs));
    recordRemoteBaseline(entry.path, entry.docs, { prune: true });
    const sub = entry.path.slice(entry.path.lastIndexOf('/') + 1);
    const targetKey = Object.entries(COLLECTION_MAP).find(([, value]) => value === sub)?.[0] as
      | CollectionKey
      | undefined;
    if (targetKey && Array.isArray(partial[targetKey])) {
      partial[targetKey] = overlayPendingMutations(
        entry.path,
        clientId,
        scope.organizationId,
        partial[targetKey] as Array<Record<string, unknown>>
      ) as never;
    }
  }
  if (profile) {
    markRemoteDocsKnown(profile.path, confirmedDocIds(profile.snap.docs));
    recordRemoteBaseline(profile.path, profile.snap.docs, { prune: true });
    const profileDoc = profile.snap.docs.find((row) => row.id === 'data');
    if (profileDoc) {
      const data = normalizeFirestorePulledData(profileDoc.data()) as Record<string, unknown>;
      const pending = pendingAdminMutations.get(`${profile.path}/data`);
      if (pending) {
        for (const [key, field] of pending.fields) data[key] = structuredClone(field.value);
      }
      partial.profiles![clientId] = data as unknown as LocalV5Snapshot['profiles'][string];
    }
  }
  if (dossier) {
    markRemoteDocsKnown(dossier.path, confirmedDocIds(dossier.snap.docs));
    recordRemoteBaseline(dossier.path, dossier.snap.docs, { prune: true });
    const dossierDoc = dossier.snap.docs.find((row) => row.id === 'data');
    if (dossierDoc) {
      const data = normalizeFirestorePulledData(dossierDoc.data()) as Record<string, unknown>;
      const pending = pendingAdminMutations.get(`${dossier.path}/data`);
      if (pending) {
        for (const [key, field] of pending.fields) data[key] = structuredClone(field.value);
      }
      partial.dossiers![clientId] = data as unknown as LocalV5Snapshot['dossiers'][string];
    }
  }
  return partial;
}

/**
 * Complete server listing of one client's deliveries. Other collections are not read,
 * their baselines are not pruned, and a cache or stale generation records nothing.
 */
export async function pullAuthoritativeClientDeliveries(
  clientId: string,
  readGeneration: number
): Promise<LocalV5Snapshot['deliveries']> {
  if (!adminReadStillCurrent(readGeneration)) throw new Error('stale-admin-read');
  const db = await getFirebaseFirestore();
  if (!db) throw new Error('firestore-unavailable');
  const scope = await readTenantReadScope();
  if (!scope?.isAdmin) throw new Error('not-admin');
  if (!adminReadStillCurrent(readGeneration)) throw new Error('stale-admin-read');

  const { getDocs } = await import('firebase/firestore');
  const collectionPath = `${clientDocPath(clientId)}/deliveries`;
  const snap = await getDocs(await scopedClientSubcollectionQuery(db, clientId, 'deliveries', scope));
  if (!adminReadStillCurrent(readGeneration)) throw new Error('stale-admin-read');
  if (isFromCache(snap)) throw new Error('snapshot-from-cache');

  for (const path of knownRemoteDocPaths) {
    if (parentCollectionPath(path) === collectionPath) knownRemoteDocPaths.delete(path);
  }
  for (const id of confirmedDocIds(snap.docs)) knownRemoteDocPaths.add(`${collectionPath}/${id}`);
  recordRemoteBaseline(collectionPath, snap.docs, { prune: true });
  return snap.docs.map(
    (row) => normalizeFirestorePulledData({ id: row.id, ...row.data() }) as LocalV5Snapshot['deliveries'][number]
  );
}

export type ActiveDraftEnsureOutcome = {
  package: LocalV5Snapshot['deliveries'][number];
  created: boolean;
  source: 'pointer' | 'historical' | 'created';
};

export type ActiveDraftEnsureInput = {
  clientId: string;
  organizationId: string;
  readGeneration: number;
  /** Generated once per command so every transaction retry targets the same document. */
  newId: string;
  /** Pure builder: it must not touch memory, React or storage (it can run on each retry). */
  build: (id: string) => LocalV5Snapshot['deliveries'][number];
};

class DraftPointerUnconfirmedError extends Error {
  constructor(readonly pointer: string) {
    super('draft-pointer-unconfirmed');
  }
}

type DraftRow = Record<string, unknown>;

function isOpenDraftOf(row: DraftRow | null | undefined, organizationId: string, clientId: string): boolean {
  return (
    !!row &&
    row.status === 'DRAFT' &&
    row.organizationId === organizationId &&
    row.clientId === clientId
  );
}

function byCreatedAtThenId(a: DraftRow, b: DraftRow): number {
  const left = typeof a.createdAt === 'string' ? a.createdAt : '';
  const right = typeof b.createdAt === 'string' ? b.createdAt : '';
  if (left !== right) return left < right ? -1 : 1;
  return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
}

function isPermissionDenied(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'permission-denied';
}

/**
 * R-B01 — one open draft delivery per client across concurrent ADMIN sessions.
 *
 * The shared root document `clients/{clientId}` is the coordination resource. The preliminary
 * listing only supplies candidates and is NOT a uniqueness guarantee. Inside the transaction all
 * reads precede all writes and nothing outside the transaction is touched, so retries are safe.
 * A pointer to a deleted draft cannot be read under the current rules (reading a missing
 * document is denied); it is healed only after two consecutive fresh listings both lack it.
 * Memory is the caller's concern and is updated only after this promise resolves.
 */
export async function ensureActiveDraftDeliveryTransactional(
  input: ActiveDraftEnsureInput
): Promise<ActiveDraftEnsureOutcome> {
  const { clientId, organizationId } = input;
  if (!adminReadStillCurrent(input.readGeneration)) throw new Error('stale-admin-read');
  const db = await getFirebaseFirestore();
  if (!db) throw new Error('firestore-unavailable');
  const scope = await readTenantReadScope();
  if (!scope?.isAdmin) throw new Error('not-admin');
  if (scope.organizationId !== organizationId) throw new Error('tenant-mismatch');

  const { doc, getDocs, runTransaction, serverTimestamp } = await import('firebase/firestore');
  const rootRef = doc(db, clientDocPath(clientId));
  const collectionPath = `${clientDocPath(clientId)}/deliveries`;
  const fromServer = (id: string, data: unknown): DraftRow =>
    normalizeFirestorePulledData({ id, ...(data as Record<string, unknown>) }) as DraftRow;

  let unconfirmedPointer: string | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!adminReadStillCurrent(input.readGeneration)) throw new Error('stale-admin-read');
    const listing = await getDocs(await scopedClientSubcollectionQuery(db, clientId, 'deliveries', scope));
    if (isFromCache(listing)) throw new Error('snapshot-from-cache');
    const listed = new Map<string, DraftRow>();
    for (const row of listing.docs) listed.set(row.id, fromServer(row.id, row.data()));
    const candidates = [...listed.values()]
      .filter((row) => isOpenDraftOf(row, organizationId, clientId))
      .sort(byCreatedAtThenId);
    const healPointer = unconfirmedPointer;
    let readListedDoc = false;

    try {
      const outcome = await runTransaction(db, async (tx): Promise<ActiveDraftEnsureOutcome> => {
        readListedDoc = false;
        if (!adminReadStillCurrent(input.readGeneration)) throw new Error('stale-admin-read');
        const rootSnap = await tx.get(rootRef);
        if (!rootSnap.exists()) throw new Error('client-root-missing');
        const root = rootSnap.data() as DraftRow;
        if (root.organizationId !== organizationId) throw new Error('tenant-mismatch');

        const rawPointer = root[ACTIVE_DRAFT_DELIVERY_FIELD];
        const pointer = typeof rawPointer === 'string' && rawPointer.trim() ? rawPointer.trim() : null;
        let pointed: DraftRow | null = null;
        if (pointer) {
          if (listed.has(pointer)) {
            readListedDoc = true;
            const pointedSnap = await tx.get(doc(db, `${collectionPath}/${pointer}`));
            pointed = pointedSnap.exists() ? fromServer(pointer, pointedSnap.data()) : null;
          } else if (healPointer !== pointer) {
            throw new DraftPointerUnconfirmedError(pointer);
          }
        }

        const pointedValid = isOpenDraftOf(pointed, organizationId, clientId);
        let historical: DraftRow | null = null;
        if (!pointedValid) {
          for (const candidate of candidates) {
            if (candidate.id === pointer) continue;
            readListedDoc = true;
            const candidateSnap = await tx.get(doc(db, `${collectionPath}/${String(candidate.id)}`));
            const row = candidateSnap.exists() ? fromServer(String(candidate.id), candidateSnap.data()) : null;
            if (isOpenDraftOf(row, organizationId, clientId)) {
              historical = row;
              break;
            }
          }
        }

        // Every read is done; only writes follow.
        if (pointedValid && pointed) {
          return {
            package: pointed as unknown as ActiveDraftEnsureOutcome['package'],
            created: false,
            source: 'pointer',
          };
        }
        if (historical) {
          tx.set(rootRef, { [ACTIVE_DRAFT_DELIVERY_FIELD]: String(historical.id) }, { merge: true });
          return {
            package: historical as unknown as ActiveDraftEnsureOutcome['package'],
            created: false,
            source: 'historical',
          };
        }

        const built = input.build(input.newId);
        if (
          built.id !== input.newId ||
          built.status !== 'DRAFT' ||
          built.clientId !== clientId ||
          built.organizationId !== organizationId
        ) {
          throw new Error('draft-build-mismatch');
        }
        const data = prepareDocForWrite(built as unknown as Record<string, unknown>, serverTimestamp, false, {
          client: { id: clientId, organizationId },
        });
        tx.set(doc(db, `${collectionPath}/${input.newId}`), data);
        tx.set(rootRef, { [ACTIVE_DRAFT_DELIVERY_FIELD]: input.newId }, { merge: true });
        return { package: built, created: true, source: 'created' };
      });

      const path = `${collectionPath}/${outcome.package.id}`;
      markRemoteDocsKnown(collectionPath, [outcome.package.id]);
      if (outcome.created || !remoteBaseline.has(path)) {
        remoteBaseline.set(
          path,
          normalizeFirestorePulledData(
            stripUndefinedForFirestore(outcome.package) as unknown as Record<string, unknown>
          )
        );
      }
      return outcome;
    } catch (err) {
      if (attempt < 2 && err instanceof DraftPointerUnconfirmedError) {
        unconfirmedPointer = err.pointer;
        continue;
      }
      if (attempt < 2 && readListedDoc && isPermissionDenied(err)) {
        // A listed draft vanished between the listing and the read: list again.
        continue;
      }
      throw err;
    }
  }
  throw new Error('draft-transaction-exhausted');
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let authoritative = false;
type FirestorePushErrorHandler = (message: string) => void;
let pushErrorHandler: FirestorePushErrorHandler | null = null;

export function onFirestorePushError(handler: FirestorePushErrorHandler | null) {
  pushErrorHandler = handler;
}

export function reportFirestorePushError(message: string) {
  pushErrorHandler?.(message);
}

export function setFirestoreAuthoritative(active: boolean) {
  authoritative = active;
}

export function isFirestoreAuthoritative(): boolean {
  return authoritative && Boolean(readFirebaseConfig());
}

/**
 * Status fields whose rules reject skipped edges (ASSIGNED→COMPLETED, SENT_TO_CLIENT→COMPLETED).
 * Other CLIENT state fields accept the direct edge, so their changes may coalesce.
 */
const EDGE_SENSITIVE_STATE_FIELDS: ReadonlyArray<readonly [CollectionKey, string]> = [
  ['tasks', 'status'],
  ['opportunities', 'status'],
];

/**
 * Server outcome of a push.
 * - `confirmed`: remote ACK applied to the current session.
 * - `pending`: no acknowledgement within the wait.
 * - `rejected`: server refused the writes (rules / permission-denied).
 * - `failed`: not persisted for a transient or conflict reason.
 * - `remote_confirmed_unapplied`: Firestore committed, but the capturing session is gone —
 *   must not mutate the active session; reconciliation is recorded for the origin identity.
 * - `remote_uncertain`: in-flight result unknown after session invalidation — neither confirm
 *   nor definitive reject without evidence.
 */
export type RemotePersistenceOutcome =
  | { status: 'confirmed' }
  | { status: 'pending' }
  | { status: 'rejected'; message: string }
  | { status: 'failed'; message: string }
  | {
      status: 'remote_confirmed_unapplied';
      message: string;
      originUid: string;
      originGeneration: number;
      paths: string[];
    }
  | {
      status: 'remote_uncertain';
      message: string;
      originUid: string;
      originGeneration: number;
      paths: string[];
    };

/** The root client doc has no listener; its server-derived counter is handed back after each push. */
export type ClientRootReconcileHandler = (clientId: string, fields: { completedTasksCount: number }) => void;

/**
 * Server truth plus still-pending ADMIN fields for one local row an ADMIN push settled
 * (conflict, failure, derived counter); `row: null` drops a row the server does not hold.
 */
export type AdminRowReconcile = {
  target: CollectionKey;
  clientId: string;
  id: string;
  row: Record<string, unknown> | null;
};
export type AdminRowsReconcileHandler = (rows: ReadonlyArray<AdminRowReconcile>) => void;

type ClientCapture = {
  snapshot: LocalV5Snapshot;
  epoch: number;
  version: number;
  clientId: string;
  organizationId: string | null;
  outcome: Promise<RemotePersistenceOutcome>;
  resolveOutcome: (outcome: RemotePersistenceOutcome) => void;
  onRootReconciled?: ClientRootReconcileHandler;
};

let pendingClientCapture: ClientCapture | null = null;
/** Bumped when a CLIENT push fails: captures taken before then may carry edges that depend on it. */
let clientPushEpoch = 0;
let clientCaptureVersion = 0;
/** Outcome per capture version; a coalesced capture resolves with the capture that replaced it. */
const captureOutcomes = new Map<number, Promise<RemotePersistenceOutcome>>();
const TRACKED_CAPTURE_OUTCOMES = 500;
let adminPushInFlight: Promise<RemotePersistenceOutcome> | null = null;
let adminRowsHandler: AdminRowsReconcileHandler | null = null;

const DISCARDED_CAPTURE_MESSAGE = 'Cambios descartados tras un error de sincronización.';

function pushFailureOutcome(message: string): RemotePersistenceOutcome {
  return /permission|denied|insufficient/i.test(message)
    ? { status: 'rejected', message }
    : { status: 'failed', message };
}

const OUTCOME_SEVERITY: Record<RemotePersistenceOutcome['status'], number> = {
  confirmed: 0,
  remote_confirmed_unapplied: 1,
  pending: 2,
  failed: 3,
  remote_uncertain: 3,
  rejected: 4,
};

function mostSevereOutcome(outcomes: ReadonlyArray<RemotePersistenceOutcome>): RemotePersistenceOutcome {
  if (outcomes.length === 0) return { status: 'confirmed' };
  return outcomes.reduce<RemotePersistenceOutcome>(
    (worst, next) => (OUTCOME_SEVERITY[next.status] > OUTCOME_SEVERITY[worst.status] ? next : worst),
    { status: 'confirmed' }
  );
}

/**
 * Flush barrier for the *active* session (e.g. `openAdminClientWorkspace`).
 * Stale-origin remote notes and push aborts caused by session invalidation must not block
 * the new actor and must never read as authorization to continue an unsafe transition.
 */
function flushBarrierOutcome(outcomes: ReadonlyArray<RemotePersistenceOutcome>): RemotePersistenceOutcome {
  const currentGen = persistenceGeneration;
  const actionable = outcomes.map((outcome) => {
    if (
      (outcome.status === 'remote_confirmed_unapplied' || outcome.status === 'remote_uncertain') &&
      outcome.originGeneration !== currentGen
    ) {
      return { status: 'confirmed' as const };
    }
    if (
      (outcome.status === 'rejected' || outcome.status === 'failed') &&
      /Session invalidated/i.test(outcome.message)
    ) {
      return { status: 'confirmed' as const };
    }
    return outcome;
  });
  return mostSevereOutcome(actionable);
}

function createClientCapture(
  snapshot: LocalV5Snapshot,
  actor: PersistenceActor,
  clientId: string,
  onRootReconciled: ClientRootReconcileHandler | undefined
): ClientCapture {
  let resolveOutcome: (outcome: RemotePersistenceOutcome) => void = () => undefined;
  const outcome = new Promise<RemotePersistenceOutcome>((resolve) => {
    resolveOutcome = resolve;
  });
  const version = ++clientCaptureVersion;
  captureOutcomes.set(version, outcome);
  captureOutcomes.delete(version - TRACKED_CAPTURE_OUTCOMES);
  return {
    snapshot: captureClientSnapshot(snapshot, actor),
    epoch: clientPushEpoch,
    version,
    clientId,
    organizationId: actor.organizationId?.trim() || null,
    outcome,
    resolveOutcome,
    onRootReconciled,
  };
}

function clientRowDiffersFromServer(path: string, row: Record<string, unknown>, policy: ClientWritePolicy): boolean {
  const baseline = remoteBaseline.get(path);
  if (!baseline) return true;
  return policy.update.some(
    (key) => !TRUSTED_SCALAR_TIME_FIELDS.has(key) && key in row && !sameFieldValue(row[key], baseline[key])
  );
}

/** Every CLIENT-writable row of the capture that the server does not hold yet becomes pending. */
function recordPendingClientMutations(capture: ClientCapture) {
  const record = (path: string, collection: string, row: Record<string, unknown>) => {
    const policy = CLIENT_WRITE_POLICIES[collection];
    if (!policy || !clientRowDiffersFromServer(path, row, policy)) return;
    pendingClientMutations.set(path, {
      collectionPath: parentCollectionPath(path),
      clientId: capture.clientId,
      organizationId: capture.organizationId,
      version: capture.version,
      epoch: capture.epoch,
      row,
    });
  };
  const root = clientDocPath(capture.clientId);
  for (const client of capture.snapshot.clients) {
    if (client.id === capture.clientId) record(root, 'root', client as unknown as Record<string, unknown>);
  }
  for (const key of CLIENT_PERSIST_COLLECTION_KEYS) {
    const sub = COLLECTION_MAP[key];
    const rows = capture.snapshot[key];
    if (!sub || sub === 'profile' || !Array.isArray(rows)) continue;
    for (const row of itemsForClient(rows as Array<{ clientId?: string | null; id?: string }>, capture.clientId)) {
      if (row.id) record(`${root}/${sub}/${row.id}`, sub, row as Record<string, unknown>);
    }
  }
}

/**
 * Pending rows win over a snapshot of the same tenant, client and collection: whole CLIENT
 * rows, ADMIN creates, and ADMIN changed fields on top of the server row.
 */
function overlayPendingMutations(
  collectionPath: string,
  clientId: string,
  organizationId: string,
  rows: ReadonlyArray<Record<string, unknown>>
): Array<Record<string, unknown>> {
  const out = [...rows];
  for (const [path, intent] of pendingDocDeletes) {
    if (parentCollectionPath(path) !== collectionPath || intent.clientId !== clientId) continue;
    const id = docIdOf(path);
    const index = out.findIndex((candidate) => candidate.id === id);
    if (index >= 0) out.splice(index, 1);
  }
  for (const [path, entry] of pendingClientMutations) {
    if (entry.collectionPath !== collectionPath || entry.clientId !== clientId) continue;
    if (entry.organizationId !== organizationId) continue;
    const id = docIdOf(path);
    const row = { ...structuredClone(entry.row), id, clientId };
    const index = out.findIndex((candidate) => candidate.id === id);
    if (index >= 0) out[index] = row;
    else out.push(row);
  }
  const now = Date.now();
  for (const [path, guard] of adminEchoGuards) {
    if (parentCollectionPath(path) !== collectionPath || guard.clientId !== clientId) continue;
    if (guard.organizationId !== null && guard.organizationId !== organizationId) continue;
    const id = docIdOf(path);
    const index = out.findIndex((candidate) => candidate.id === id);
    if (now > guard.expiresAt || (guard.create ? index >= 0 : index < 0)) {
      adminEchoGuards.delete(path);
      continue;
    }
    if (guard.create) {
      out.push({ ...structuredClone(guard.create), id, clientId });
      continue;
    }
    const current = out[index];
    const stale = [...guard.fields.entries()].every(([key, field]) => sameFieldValue(current[key], field.before));
    if (!stale) {
      adminEchoGuards.delete(path);
      continue;
    }
    const row = { ...current };
    for (const [key, field] of guard.fields) row[key] = structuredClone(field.value);
    out[index] = row;
  }
  for (const [path, entry] of pendingAdminMutations) {
    if (parentCollectionPath(path) !== collectionPath || entry.clientId !== clientId) continue;
    if (entry.organizationId !== null && entry.organizationId !== organizationId) continue;
    const id = docIdOf(path);
    const index = out.findIndex((candidate) => candidate.id === id);
    if (entry.create) {
      const row = { ...structuredClone(entry.create.row), id, clientId };
      if (index >= 0) out[index] = row;
      else out.push(row);
      continue;
    }
    if (index < 0) continue;
    const row = { ...out[index] };
    for (const [key, field] of entry.fields) row[key] = structuredClone(field.value);
    out[index] = row;
  }
  return out;
}

/**
 * Server-confirmed rows of a live collection: the last listing plus docs committed since,
 * read from the baseline so acknowledged writes and server state win over stale listings.
 */
function confirmedCollectionRows(collectionPath: string, state: RealtimeCollectionState): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  for (const id of new Set([...state.docs.keys(), ...state.committedSince])) {
    const baseline = remoteBaseline.get(`${collectionPath}/${id}`);
    const listed = state.docs.get(id);
    const source = baseline ?? (listed && !listed.pending ? listed.row : null);
    if (source) rows.push({ ...structuredClone(source), id, clientId: state.clientId });
  }
  return rows;
}

/**
 * Re-applies server truth (plus still-pending rows) to collections whose pending rows settled.
 * One import per client: an import may save, and that capture must not see half-reconciled state.
 */
function reconcileClientCollections(collectionPaths: ReadonlySet<string>) {
  if (!realtimeHandler) return;
  const partials = new Map<string, Record<string, Array<Record<string, unknown>>>>();
  for (const collectionPath of collectionPaths) {
    const state = realtimeCollections.get(collectionPath);
    if (!state?.received) continue;
    const partial = partials.get(state.clientId) ?? {};
    partial[state.snapshotKey] = overlayPendingMutations(
      collectionPath,
      state.clientId,
      state.organizationId,
      confirmedCollectionRows(collectionPath, state)
    );
    partials.set(state.clientId, partial);
  }
  for (const [clientId, partial] of partials) {
    realtimeHandler(partial as Partial<LocalV5Snapshot>, { clientId });
  }
}

function settleClientCapture(capture: ClientCapture, persisted: boolean) {
  const touched = new Set<string>();
  for (const [path, entry] of pendingClientMutations) {
    if (entry.clientId !== capture.clientId) continue;
    if (persisted ? entry.version > capture.version : entry.epoch !== capture.epoch) continue;
    pendingClientMutations.delete(path);
    touched.add(entry.collectionPath);
  }
  try {
    reconcileClientCollections(touched);
    const root = clientDocPath(capture.clientId);
    const count = remoteBaseline.get(root)?.completedTasksCount;
    if (!pendingClientMutations.has(root) && typeof count === 'number') {
      capture.onRootReconciled?.(capture.clientId, { completedTasksCount: count });
    }
  } catch (err) {
    pushErrorHandler?.(err instanceof Error ? err.message : 'Error al reconciliar con Firestore.');
  }
}

/** Values as of scheduling time; `exportSnapshot()` shares live rows that later commands mutate. */
function captureClientSnapshot(snapshot: LocalV5Snapshot, actor: PersistenceActor): LocalV5Snapshot {
  const scoped = filterSnapshotForPersistenceActor(snapshot, actor);
  return structuredClone({ ...scoped, subscription: null, invitations: [], files: [], topicPins: [] });
}

function changesEdgeSensitiveState(pending: LocalV5Snapshot, next: LocalV5Snapshot): boolean {
  for (const [key, field] of EDGE_SENSITIVE_STATE_FIELDS) {
    const before = new Map(
      (pending[key] as unknown as Array<Record<string, unknown>>).map((row) => [row.id, row[field]])
    );
    for (const row of next[key] as unknown as Array<Record<string, unknown>>) {
      if (before.has(row.id) && before.get(row.id) !== row[field]) return true;
    }
  }
  return false;
}

function dispatchClientCapture(capture: ClientCapture) {
  void enqueueSnapshotImport(async () => {
    if (capture.epoch !== clientPushEpoch) {
      return { ok: true, message: DISCARDED_CAPTURE_MESSAGE, written: 0, discarded: true };
    }
    try {
      const result = await runSnapshotImport(capture.snapshot);
      if (!result.ok) clientPushEpoch += 1;
      return result;
    } catch (err) {
      clientPushEpoch += 1;
      throw err;
    }
  }).then((result) => {
    const persisted = result.ok && !result.discarded;
    settleClientCapture(capture, persisted);
    if (!result.ok) pushErrorHandler?.(result.message);
    capture.resolveOutcome(
      persisted
        ? { status: 'confirmed' }
        : result.discarded
          ? { status: 'failed', message: result.message }
          : pushFailureOutcome(result.message)
    );
  }).catch((err) => {
    const message = err instanceof Error ? err.message : 'Error al sincronizar con Firestore.';
    settleClientCapture(capture, false);
    pushErrorHandler?.(message);
    capture.resolveOutcome(pushFailureOutcome(message));
  });
}

/**
 * CLIENT pushes keep every edge-sensitive transition: a pending capture is persisted, never
 * dropped, before a capture that moves one of its edge-sensitive states again.
 * The capture is recorded as pending before this returns, so no realtime snapshot can replace it.
 */
function scheduleClientPush(
  snapshot: LocalV5Snapshot,
  actor: PersistenceActor,
  clientId: string,
  onRootReconciled: ClientRootReconcileHandler | undefined
) {
  const capture = createClientCapture(snapshot, actor, clientId, onRootReconciled);
  recordPendingClientMutations(capture);
  const previous = pendingClientCapture;
  if (previous && changesEdgeSensitiveState(previous.snapshot, capture.snapshot)) {
    dispatchClientCapture(previous);
  } else if (previous) {
    void capture.outcome.then(previous.resolveOutcome);
  }
  pendingClientCapture = capture;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    const due = pendingClientCapture;
    pendingClientCapture = null;
    if (due) dispatchClientCapture(due);
  }, 800);
}

/** Never ADMIN field updates: document identity, write-once creation time, server-derived counter. */
const ADMIN_NON_UPDATABLE_KEYS: ReadonlySet<string> = new Set([
  'id',
  'createdAt',
  'completedTasksCount',
  ACTIVE_DRAFT_DELIVERY_FIELD,
]);
/** Documents per ADMIN transaction; each adds at most one read and one write. */
const ADMIN_TRANSACTION_DOCS = 100;
const TASK_DOC_PATH = /^clients\/[^/]+\/tasks\/[^/]+$/;

type AdminDocIdentity = Pick<
  PendingAdminDoc,
  | 'target'
  | 'clientId'
  | 'id'
  | 'organizationId'
  | 'originUid'
  | 'originRole'
  | 'originOrganizationId'
  | 'originGeneration'
>;

/** Path/row coordinates used when rebuilding a reconciled local row after settle. */
type AdminDocRef = Pick<PendingAdminDoc, 'target' | 'clientId' | 'id' | 'organizationId'>;

function abandonedEchoBelongsToActor(
  abandoned: AbandonedAdminValues,
  actor: PersistenceActor | null
): boolean {
  if (!actor) return false;
  if (abandoned.originUid !== (actor.uid ?? '')) return false;
  const org = actor.organizationId?.trim() || null;
  if (org && abandoned.originOrganizationId && abandoned.originOrganizationId !== org) return false;
  return true;
}

function sealAbandonedFromIdentity(
  path: string,
  identity: {
    originUid: string;
    originOrganizationId: string | null;
    originGeneration: number;
  },
  create: Record<string, unknown> | null,
  fields: Map<string, unknown>
): void {
  const existing = abandonedAdminValues.get(path);
  const quarantined: AbandonedAdminValues =
    existing &&
    existing.originUid === identity.originUid &&
    existing.originGeneration === identity.originGeneration
      ? existing
      : {
          create: null,
          fields: new Map<string, unknown>(),
          originUid: identity.originUid,
          originOrganizationId: identity.originOrganizationId,
          originGeneration: identity.originGeneration,
        };
  if (create) quarantined.create = create;
  for (const [key, value] of fields) quarantined.fields.set(key, value);
  abandonedAdminValues.set(path, quarantined);
}

function recordOriginReconciliation(entry: OriginRemoteReconciliation): void {
  originRemoteReconciliations = [
    ...originRemoteReconciliations.filter(
      (prior) =>
        !(
          prior.originUid === entry.originUid &&
          prior.originGeneration === entry.originGeneration &&
          prior.status === entry.status
        )
    ),
    entry,
  ].slice(-50);
}

/** Records the fields of one local row that differ from the server baseline or its pending value. */
function recordAdminRow(
  path: string,
  identity: AdminDocIdentity,
  source: Record<string, unknown>,
  version: number
) {
  if (pendingDocDeletes.has(path)) {
    pendingAdminMutations.delete(path);
    return;
  }
  const row = structuredClone(stripUndefinedForFirestore(source));
  const pending = pendingAdminMutations.get(path);
  const baseline = remoteBaseline.get(path);
  const abandoned = abandonedAdminValues.get(path);
  const echoOwned =
    abandoned && abandonedEchoBelongsToActor(abandoned, sessionPersistenceActor) ? abandoned : null;
  if (pending?.create || (!pending && !baseline && !knownRemoteDocPaths.has(path))) {
    if (!pending && echoOwned?.create && sameFieldValue(echoOwned.create, row)) return;
    if (!pending?.create || !sameFieldValue(pending.create.row, row)) {
      pendingAdminMutations.set(path, { ...identity, create: { row, version }, fields: new Map() });
    }
    return;
  }
  const clearing = pendingFieldClears.get(path)?.fields;
  const echoed = adminEchoGuards.get(path)?.fields;
  const entry: PendingAdminDoc = pending ?? { ...identity, create: null, fields: new Map() };
  for (const [key, value] of Object.entries(row)) {
    if (ADMIN_NON_UPDATABLE_KEYS.has(key)) continue;
    const field = entry.fields.get(key);
    if (field) {
      if (!sameFieldValue(field.value, value)) entry.fields.set(key, { value, base: field.base, version });
      continue;
    }
    const confirmed = echoed?.get(key);
    const base = confirmed ? confirmed.value : baseline ? baseline[key] : NO_BASE;
    if (base !== NO_BASE && sameFieldValue(base, value) && !clearing?.has(key)) continue;
    if (echoOwned?.fields.has(key) && sameFieldValue(echoOwned.fields.get(key), value)) continue;
    entry.fields.set(key, { value, base, version });
  }
  if (!pending && entry.fields.size > 0) pendingAdminMutations.set(path, entry);
}

/**
 * ADMIN capture at scheduling time: values are copied now, so later in-place edits and realtime
 * replacements of the live rows can neither change nor erase what this mutation persists.
 * Requires a bound ADMIN actor with uid — unsigned captures are refused.
 */
function captureAdminMutations(snapshot: LocalV5Snapshot, actor: PersistenceActor | null) {
  if (!actor || actor.role !== 'ADMIN') return;
  const version = ++adminCaptureVersion;
  const organizationId = actor.organizationId?.trim() || null;
  // Empty uid is allowed only when the auth token mock omits it; real sessions always bind uid.
  const originUid = typeof actor.uid === 'string' ? actor.uid : '';
  const originRole = actor.role;
  const originOrganizationId = organizationId;
  const originGeneration = persistenceGeneration;
  const clients = snapshot.clients.filter(
    (client) => !organizationId || client.organizationId === organizationId
  );
  adminScopedClientIds = new Set(clients.map((client) => client.id));
  for (const client of clients) {
    const root = clientDocPath(client.id);
    const envelope = { id: client.id, organizationId: client.organizationId };
    const identity = (target: CollectionKey, id: string): AdminDocIdentity => ({
      target,
      clientId: client.id,
      id,
      organizationId: organizationId ?? (client.organizationId?.trim() || null),
      originUid,
      originRole,
      originOrganizationId,
      originGeneration,
    });
    recordAdminRow(root, identity('clients', client.id), client as unknown as Record<string, unknown>, version);
    const subcollectionsOpen =
      !adminSubcollectionPushScope || adminSubcollectionPushScope.has(client.id);
    const confirmed = adminConfirmedSubcollections.get(client.id);
    if (subcollectionsOpen || confirmed?.size) {
      for (const [key, sub] of Object.entries(COLLECTION_MAP)) {
        if (!sub || (!subcollectionsOpen && !confirmed?.has(sub))) continue;
        const rows = snapshot[key as CollectionKey];
        if (!Array.isArray(rows)) continue;
        const scoped = itemsForClient(
          rows as Array<{ clientId?: string | null; id?: string; organizationId?: unknown }>,
          client.id
        );
        for (const row of scoped) {
          if (!row.id) continue;
          if (organizationId && typeof row.organizationId === 'string' && row.organizationId !== organizationId) {
            continue;
          }
          recordAdminRow(
            `${root}/${sub}/${row.id}`,
            identity(key as CollectionKey, row.id),
            ensureSubcollectionEnvelope(row as Record<string, unknown>, envelope),
            version
          );
        }
      }
    }
    if (subcollectionsOpen) {
      const profile = snapshot.profiles[client.id];
      if (profile) {
        recordAdminRow(
          `${root}/profile/data`,
          identity('profiles', 'data'),
          ensureSubcollectionEnvelope(profile as unknown as Record<string, unknown>, envelope),
          version
        );
      }
      const dossier = snapshot.dossiers[client.id];
      if (dossier) {
        recordAdminRow(
          `${root}/dossier/data`,
          identity('dossiers', 'data'),
          ensureSubcollectionEnvelope(dossier as unknown as Record<string, unknown>, envelope),
          version
        );
      }
    }
  }
}

/** Frozen copy of the ADMIN work due for one document at dispatch time. */
type AdminWorkItem = {
  path: string;
  identity: AdminDocIdentity | null;
  create: { row: Record<string, unknown>; version: number } | null;
  fields: Map<string, PendingAdminField>;
  remove: boolean;
  clears: Map<string, number>;
};

function dueAdminWork(path: string, upTo: number): AdminWorkItem {
  const entry = pendingAdminMutations.get(path);
  const fields = new Map<string, PendingAdminField>();
  for (const [key, field] of entry?.fields ?? []) {
    if (field.version <= upTo) fields.set(key, { ...field, value: structuredClone(field.value) });
  }
  const create =
    entry?.create && entry.create.version <= upTo
      ? { row: structuredClone(entry.create.row), version: entry.create.version }
      : null;
  return {
    path,
    identity: entry
      ? {
          target: entry.target,
          clientId: entry.clientId,
          id: entry.id,
          organizationId: entry.organizationId,
          originUid: entry.originUid,
          originRole: entry.originRole,
          originOrganizationId: entry.originOrganizationId,
          originGeneration: entry.originGeneration,
        }
      : null,
    create,
    fields,
    remove: pendingDocDeletes.has(path),
    clears: new Map(pendingFieldClears.get(path)?.fields ?? []),
  };
}

type AdminWrite = {
  path: string;
  remove?: boolean;
  create?: Record<string, unknown>;
  patch?: Record<string, unknown>;
  clears?: string[];
};

type AdminPlan = {
  writes: AdminWrite[];
  server: Map<string, Record<string, unknown> | null>;
  conflicts: string[];
  conflictPaths: Set<string>;
  missing: Set<string>;
  rootCount: number | null;
};

/**
 * Compare-and-set against the server state read in the transaction: a field is written only
 * when the server still holds the value the change was based on. Task completions derive the
 * root counter from the server count read in the same transaction.
 */
function planAdminChunk(
  work: ReadonlyArray<AdminWorkItem>,
  server: ReadonlyMap<string, Record<string, unknown> | null>,
  existing: ReadonlySet<string>,
  root: string
): AdminPlan {
  const plan: AdminPlan = {
    writes: [],
    server: new Map(server),
    conflicts: [],
    conflictPaths: new Set(),
    missing: new Set(),
    rootCount: null,
  };
  let completions = 0;
  let rootWrite: AdminWrite | null = null;
  for (const item of work) {
    if (item.remove) {
      if (existing.has(item.path)) plan.writes.push({ path: item.path, remove: true });
      continue;
    }
    let fields = item.fields;
    if (item.create) {
      if (!existing.has(item.path)) {
        plan.writes.push({ path: item.path, create: item.create.row });
        continue;
      }
      const createVersion = item.create.version;
      fields = new Map(
        Object.entries(item.create.row)
          .filter(([key]) => !ADMIN_NON_UPDATABLE_KEYS.has(key))
          .map(([key, value]): [string, PendingAdminField] => [key, { value, base: NO_BASE, version: createVersion }])
      );
    }
    const current = server.get(item.path);
    if (!current) {
      if (fields.size > 0) plan.missing.add(item.path);
      continue;
    }
    const patch: Record<string, unknown> = {};
    const times: Record<string, unknown> = {};
    const conflicted: string[] = [];
    for (const [key, field] of fields) {
      if (TRUSTED_SCALAR_TIME_FIELDS.has(key)) {
        times[key] = field.value;
        continue;
      }
      if (sameFieldValue(current[key], field.value)) continue;
      if (field.base !== NO_BASE && !sameFieldValue(current[key], field.base)) {
        conflicted.push(key);
        continue;
      }
      patch[key] = field.value;
    }
    if (Object.keys(patch).length > 0) {
      if (conflicted.length === 0) Object.assign(patch, times);
      else if ('updatedAt' in times) patch.updatedAt = times.updatedAt;
    }
    if (conflicted.length > 0) {
      plan.conflictPaths.add(item.path);
      for (const key of conflicted) plan.conflicts.push(`${item.path}.${key}`);
    }
    if (TASK_DOC_PATH.test(item.path) && patch.status === 'COMPLETED' && current.status !== 'COMPLETED') {
      completions += 1;
    }
    const clears = [...item.clears.keys()].filter((field) => !fields.has(field) && field in current);
    if (Object.keys(patch).length === 0 && clears.length === 0) continue;
    const write: AdminWrite = { path: item.path, patch, clears };
    if (item.path === root) rootWrite = write;
    plan.writes.push(write);
  }
  if (completions > 0) {
    const rootServer = server.get(root);
    const base = typeof rootServer?.completedTasksCount === 'number' ? rootServer.completedTasksCount : 0;
    plan.rootCount = base + completions;
    if (!rootWrite) {
      rootWrite = { path: root, patch: {}, clears: [] };
      plan.writes.push(rootWrite);
    }
    rootWrite.patch = { ...rootWrite.patch, completedTasksCount: plan.rootCount };
  }
  return plan;
}

function prepareAdminWrite(
  write: AdminWrite,
  serverTimestamp: () => unknown,
  deleteField: () => unknown
): Record<string, unknown> {
  if (write.create) return prepareDocForWrite(write.create, serverTimestamp, false);
  const data = applyTrustedServerTimestamps(stripUndefinedForFirestore(write.patch ?? {}), serverTimestamp);
  for (const field of write.clears ?? []) data[field] = deleteField();
  return data;
}

/** Releases the due values; a newer capture of the same field stays pending. */
function settleAdminWork(work: ReadonlyArray<AdminWorkItem>) {
  for (const item of work) {
    const entry = pendingAdminMutations.get(item.path);
    if (!entry) continue;
    if (item.create && entry.create?.version === item.create.version) entry.create = null;
    for (const [key, field] of item.fields) {
      if (entry.fields.get(key)?.version === field.version) entry.fields.delete(key);
    }
    if (!entry.create && entry.fields.size === 0) pendingAdminMutations.delete(item.path);
  }
}

function markAdminDocCommitted(path: string) {
  knownRemoteDocPaths.add(path);
  realtimeCollections.get(parentCollectionPath(path))?.committedSince.add(docIdOf(path));
}

function guardAdminEcho(path: string, guard: Omit<AdminEchoGuard, 'expiresAt' | 'clientId' | 'organizationId'>, work: ReadonlyArray<AdminWorkItem>) {
  const identity = work.find((item) => item.path === path)?.identity;
  if (!identity || (!guard.create && guard.fields.size === 0)) return;
  adminEchoGuards.set(path, {
    ...guard,
    clientId: identity.clientId,
    organizationId: identity.organizationId,
    expiresAt: Date.now() + ADMIN_ECHO_GUARD_MS,
  });
}

function applyAdminCommit(work: ReadonlyArray<AdminWorkItem>, plan: AdminPlan) {
  const conflicted = new Set(plan.conflicts);
  for (const item of work) {
    const entry = pendingAdminMutations.get(item.path);
    if (!entry || plan.missing.has(item.path)) continue;
    for (const [key, field] of item.fields) {
      const newer = entry.fields.get(key);
      if (newer && newer.version !== field.version && !conflicted.has(`${item.path}.${key}`)) {
        entry.fields.set(key, { ...newer, base: structuredClone(field.value) });
      }
    }
  }
  settleAdminWork(work);
  for (const write of plan.writes) {
    if (write.remove) {
      knownRemoteDocPaths.delete(write.path);
      remoteBaseline.delete(write.path);
      adminEchoGuards.delete(write.path);
      continue;
    }
    markAdminDocCommitted(write.path);
    if (write.create) {
      remoteBaseline.set(write.path, structuredClone(write.create));
      guardAdminEcho(write.path, { create: structuredClone(write.create), fields: new Map() }, work);
      continue;
    }
    const before = plan.server.get(write.path) ?? {};
    const next: Record<string, unknown> = { ...before, ...structuredClone(write.patch ?? {}) };
    for (const field of write.clears ?? []) delete next[field];
    remoteBaseline.set(write.path, next);
    const fields = new Map<string, { value: unknown; before: unknown }>();
    for (const [key, value] of Object.entries(write.patch ?? {})) {
      if (TRUSTED_SCALAR_TIME_FIELDS.has(key) || ADMIN_NON_UPDATABLE_KEYS.has(key)) continue;
      fields.set(key, { value: structuredClone(value), before: before[key] });
    }
    guardAdminEcho(write.path, { create: null, fields }, work);
  }
  const written = new Set(plan.writes.map((write) => write.path));
  for (const item of work) {
    if (item.remove) {
      pendingDocDeletes.delete(item.path);
      continue;
    }
    if (plan.missing.has(item.path)) {
      knownRemoteDocPaths.delete(item.path);
      remoteBaseline.delete(item.path);
      continue;
    }
    const current = plan.server.get(item.path);
    if (current && !written.has(item.path)) remoteBaseline.set(item.path, structuredClone(current));
    if (item.clears.size > 0) releaseFieldClears(item.path, item.clears);
  }
}

/** Server baseline plus the ADMIN fields still pending; null when the server holds no such doc. */
function reconciledAdminRow(path: string, identity: AdminDocRef): AdminRowReconcile {
  const reference = { target: identity.target, clientId: identity.clientId, id: identity.id };
  const entry = pendingAdminMutations.get(path);
  if (entry?.create) return { ...reference, row: structuredClone(entry.create.row) };
  const baseline = remoteBaseline.get(path);
  if (!baseline) return { ...reference, row: null };
  const row: Record<string, unknown> = structuredClone(baseline);
  for (const [key, field] of entry?.fields ?? []) row[key] = structuredClone(field.value);
  if (identity.target === 'clients') {
    row.id = identity.clientId;
  } else if (identity.target !== 'profiles' && identity.target !== 'dossiers') {
    row.id = identity.id;
    row.clientId = identity.clientId;
  }
  return { ...reference, row };
}

function conflictMessage(plan: AdminPlan): string {
  const docs = plan.conflicts.length + plan.missing.size;
  return `Conflicto de sincronización: ${docs} cambio(s) ADMIN no se guardaron porque otra sesión modificó o eliminó el documento; se muestra la versión del servidor.`;
}

async function commitAdminChunk(
  db: NonNullable<Awaited<ReturnType<typeof getFirebaseFirestore>>>,
  clientId: string,
  paths: ReadonlyArray<string>,
  upTo: number,
  organizationId: string | null,
  pushGen: number
): Promise<RemotePersistenceOutcome> {
  const firestore = await import('firebase/firestore');
  const root = clientDocPath(clientId);
  const work = paths.map((path) => dueAdminWork(path, upTo));
  const completing = work.some(
    (item) => TASK_DOC_PATH.test(item.path) && item.fields.get('status')?.value === 'COMPLETED'
  );
  const probe = completing && !paths.includes(root) ? [...paths, root] : [...paths];
  try {
    const existing = await resolveExistingDocPaths(
      db,
      probe.map((path) => ({ path, envelopeClientId: path === root ? null : clientId })),
      { organizationId, rootAlwaysExists: false }
    );
    const removing = new Set(work.filter((item) => item.remove).map((item) => item.path));
    const readPaths = probe.filter((path) => existing.has(path) && !removing.has(path));
    const plan = await firestore.runTransaction(db, async (tx) => {
      const server = new Map<string, Record<string, unknown> | null>();
      for (const path of readPaths) {
        const snap = await tx.get(firestore.doc(db, path));
        server.set(path, snap.exists() ? normalizeFirestorePulledData(snap.data() ?? {}) : null);
      }
      const planned = planAdminChunk(work, server, existing, root);
      for (const write of planned.writes) {
        const ref = firestore.doc(db, write.path);
        if (write.remove) tx.delete(ref);
        else tx.set(ref, prepareAdminWrite(write, firestore.serverTimestamp, () => firestore.deleteField()), { merge: true });
      }
      return planned;
    });
    // Remote TX has committed. Test gate may pause here before generation check / local ACK.
    if (ADMIN_COMMIT_ACK_GATE_ENABLED) {
      await pauseAfterRemoteAdminCommitAck(work.map((item) => item.path));
    }
    if (persistenceGeneration !== pushGen) {
      // B: remote TX confirmed; local session moved on — do not applyAdminCommit / handlers.
      const origin = work.find((item) => item.identity)?.identity;
      const originUid = origin?.originUid ?? '';
      const originOrganizationId = origin?.originOrganizationId ?? organizationId;
      const paths = work.map((item) => item.path);
      const message =
        'Confirmación remota recibida tras invalidación de sesión; no aplicada al estado local vigente.';
      recordOriginReconciliation({
        originUid,
        originOrganizationId,
        originGeneration: pushGen,
        status: 'remote_confirmed_unapplied',
        paths,
        message,
      });
      for (const item of work) {
        const entry = pendingAdminMutations.get(item.path);
        if (entry && entry.originGeneration === pushGen) pendingAdminMutations.delete(item.path);
      }
      return {
        status: 'remote_confirmed_unapplied',
        message,
        originUid,
        originGeneration: pushGen,
        paths,
      };
    }
    applyAdminCommit(work, plan);
    const rootServer = plan.server.get(root);
    if (completing && rootServer && !plan.writes.some((write) => write.path === root)) {
      remoteBaseline.set(root, structuredClone(rootServer));
    }
    const settled = new Set<string>([...plan.conflictPaths, ...plan.missing]);
    const rows: AdminRowReconcile[] = work.flatMap((item) =>
      item.identity && settled.has(item.path) ? [reconciledAdminRow(item.path, item.identity)] : []
    );
    if (completing && !settled.has(root) && remoteBaseline.has(root)) {
      rows.push(reconciledAdminRow(root, { target: 'clients', clientId, id: clientId, organizationId }));
    }
    if (rows.length > 0) adminRowsHandler?.(rows);
    if (plan.conflicts.length > 0 || plan.missing.size > 0) {
      const message = conflictMessage(plan);
      pushErrorHandler?.(message);
      return { status: 'failed', message };
    }
    return { status: 'confirmed' };
  } catch (err) {
    if (persistenceGeneration !== pushGen) {
      // D: TX threw after session moved on — remote result uncertain; do not claim reject or confirm.
      const origin = work.find((item) => item.identity)?.identity;
      const originUid = origin?.originUid ?? '';
      const originOrganizationId = origin?.originOrganizationId ?? organizationId;
      const paths = work.map((item) => item.path);
      const message =
        'Resultado remoto incierto tras invalidación de sesión; no se aplica al estado local vigente.';
      recordOriginReconciliation({
        originUid,
        originOrganizationId,
        originGeneration: pushGen,
        status: 'remote_uncertain',
        paths,
        message,
      });
      return {
        status: 'remote_uncertain',
        message,
        originUid,
        originGeneration: pushGen,
        paths,
      };
    }
    const message = err instanceof Error ? err.message : 'Error al sincronizar con Firestore.';
    const outcome = pushFailureOutcome(message);
    if (outcome.status === 'rejected') {
      for (const item of work) {
        const fields = new Map<string, unknown>();
        for (const [key, field] of item.fields) fields.set(key, field.value);
        sealAbandonedFromIdentity(
          item.path,
          {
            originUid: item.identity?.originUid ?? '',
            originOrganizationId: item.identity?.originOrganizationId ?? organizationId,
            originGeneration: item.identity?.originGeneration ?? pushGen,
          },
          item.create?.row ?? null,
          fields
        );
      }
      settleAdminWork(work);
      const rows = work.flatMap((item) =>
        item.identity && (item.create || (item.fields.size > 0 && remoteBaseline.has(item.path)))
          ? [reconciledAdminRow(item.path, item.identity)]
          : []
      );
      if (completing && !rows.some((row) => row.target === 'clients') && remoteBaseline.has(root)) {
        rows.push(reconciledAdminRow(root, { target: 'clients', clientId, id: clientId, organizationId }));
      }
      if (rows.length > 0) adminRowsHandler?.(rows);
    }
    // Transient failure: pending mutations remain in pendingAdminMutations for automatic retry
    pushErrorHandler?.(message);
    return outcome;
  }
}

function orphanActiveAdminMutations(message: string): number {
  if (pendingAdminMutations.size === 0) return 0;
  const actor = sessionPersistenceActor;
  for (const [path, entry] of pendingAdminMutations) {
    const fields = new Map<string, unknown>();
    for (const [key, field] of entry.fields) fields.set(key, field.value);
    sealAbandonedFromIdentity(
      path,
      {
        originUid: entry.originUid,
        originOrganizationId: entry.originOrganizationId,
        originGeneration: entry.originGeneration,
      },
      entry.create?.row ?? null,
      fields
    );
  }
  const bundle: OrphanedAdminBundle = {
    uid: actor?.uid ?? 'unknown',
    organizationId: actor?.organizationId?.trim() || null,
    role: actor?.role ?? 'ADMIN',
    generation: persistenceGeneration,
    mutations: new Map(pendingAdminMutations),
    message,
  };
  orphanedAdminMutations = bundle;
  // RR-01: durable snapshot partitioned by identity (survives F5; not re-injected into foreign actors).
  if (actor?.uid && actor.organizationId) {
    const entries = [...pendingAdminMutations.entries()].map(([path, entry]) => ({
      path,
      payload: {
        create: entry.create ?? null,
        fields: Object.fromEntries([...entry.fields.entries()].map(([k, f]) => [k, f.value])),
        originUid: entry.originUid,
        originOrganizationId: entry.originOrganizationId,
        originGeneration: entry.originGeneration,
      },
      updatedAt: new Date().toISOString(),
    }));
    saveOutboxBundle(
      {
        uid: actor.uid,
        role: actor.role,
        organizationId: actor.organizationId,
        clientId: actor.clientId,
      },
      entries
    );
  }
  pendingAdminMutations.clear();
  pushErrorHandler?.(message);
  return bundle.mutations.size;
}

function mutationMatchesDispatchActor(entry: PendingAdminDoc, actor: PersistenceActor, pushGen: number): boolean {
  if (entry.originGeneration !== pushGen) return false;
  if (entry.originUid !== (actor.uid ?? '')) return false;
  if (entry.originRole !== actor.role) return false;
  const org = actor.organizationId?.trim() || null;
  if (org && entry.originOrganizationId && entry.originOrganizationId !== org) return false;
  return true;
}

async function runAdminPush(upTo: number, pushGen: number): Promise<RemotePersistenceOutcome> {
  if (persistenceGeneration !== pushGen) {
    return { status: 'rejected', message: 'Session invalidated before push execution.' };
  }
  if (!readFirebaseConfig()) {
    return { status: 'failed', message: 'Configura VITE_FIREBASE_* para sincronizar.' };
  }
  const db = await getFirebaseFirestore();
  if (!db) return { status: 'failed', message: 'Firestore no inicializado.' };
  const auth = await getFirebaseAuth();
  if (!auth?.currentUser) {
    const dropped = orphanActiveAdminMutations(
      `Sin sesión activa: ${pendingAdminMutations.size} cambio(s) ADMIN no se sincronizaron con el servidor.`
    );
    adminEchoGuards.clear();
    if (dropped === 0) return { status: 'confirmed' };
    return {
      status: 'failed',
      message: `Sin sesión activa: ${dropped} cambio(s) ADMIN no se sincronizaron con el servidor.`,
    };
  }
  const actor = await readPersistenceActor();
  if (persistenceGeneration !== pushGen) {
    return { status: 'rejected', message: 'Session invalidated while resolving persistence actor.' };
  }
  if (actor.role === 'CLIENT') {
    orphanActiveAdminMutations(
      'La sesión ya no tiene permisos ADMIN; cambios no enviados y aislados de la nueva sesión.'
    );
    return { status: 'rejected', message: 'La sesión no tiene permisos ADMIN; cambios no enviados.' };
  }
  const organizationId = actor.organizationId?.trim() || null;
  const byClient = new Map<string, Set<string>>();
  const add = (clientId: string, path: string) => {
    const paths = byClient.get(clientId) ?? new Set<string>();
    paths.add(path);
    byClient.set(clientId, paths);
  };
  for (const [path, entry] of [...pendingAdminMutations]) {
    if (!mutationMatchesDispatchActor(entry, actor, pushGen)) {
      // Foreign or stale-origin work stays out of this dispatch; isolation on clear handles it.
      continue;
    }
    if (organizationId && entry.organizationId && entry.organizationId !== organizationId) {
      continue;
    }
    const due =
      (entry.create !== null && entry.create.version <= upTo) ||
      [...entry.fields.values()].some((field) => field.version <= upTo);
    if (due) add(entry.clientId, path);
  }
  for (const [path, intent] of pendingDocDeletes) {
    if (adminScopedClientIds.has(intent.clientId)) add(intent.clientId, path);
  }
  for (const [path, clear] of pendingFieldClears) {
    if (adminScopedClientIds.has(clear.clientId)) add(clear.clientId, path);
  }
  const outcomes: RemotePersistenceOutcome[] = [];
  for (const [clientId, paths] of byClient) {
    const list = [...paths];
    for (let start = 0; start < list.length; start += ADMIN_TRANSACTION_DOCS) {
      if (persistenceGeneration !== pushGen) {
        return { status: 'rejected', message: 'Session invalidated during push execution.' };
      }
      outcomes.push(
        await commitAdminChunk(
          db,
          clientId,
          list.slice(start, start + ADMIN_TRANSACTION_DOCS),
          upTo,
          organizationId,
          pushGen
        )
      );
    }
  }
  return mostSevereOutcome(outcomes);
}

function hasAdminWork(): boolean {
  if (pendingAdminMutations.size > 0) return true;
  for (const intent of pendingDocDeletes.values()) {
    if (adminScopedClientIds.has(intent.clientId)) return true;
  }
  for (const clear of pendingFieldClears.values()) {
    if (adminScopedClientIds.has(clear.clientId)) return true;
  }
  return false;
}

function dispatchAdminPush() {
  if (sessionPersistenceActor && sessionPersistenceActor.role !== 'ADMIN') {
    return;
  }
  const upTo = adminCaptureVersion;
  const pushGen = persistenceGeneration;
  const run = enqueueSnapshotImport(() => runAdminPush(upTo, pushGen)).then(
    (outcome) => outcome,
    (err: unknown): RemotePersistenceOutcome => {
      const message = err instanceof Error ? err.message : 'Error al sincronizar con Firestore.';
      pushErrorHandler?.(message);
      return pushFailureOutcome(message);
    }
  );
  adminPushInFlight = run;
  void run.then(() => {
    if (adminPushInFlight === run) adminPushInFlight = null;
  });
}

export function scheduleFirestorePush(
  snapshot: LocalV5Snapshot,
  onRootReconciled?: ClientRootReconcileHandler,
  onAdminRowsReconciled?: AdminRowsReconcileHandler
) {
  if (!isFirestoreAuthoritative()) return;
  const actor = sessionPersistenceActor;
  if (actor?.role === 'CLIENT' && actor.clientId) {
    scheduleClientPush(snapshot, actor, actor.clientId, onRootReconciled);
    return;
  }
  if (onAdminRowsReconciled) adminRowsHandler = onAdminRowsReconciled;
  captureAdminMutations(snapshot, actor);
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    if (sessionPersistenceActor && sessionPersistenceActor.role !== 'ADMIN') return;
    if (hasAdminWork()) dispatchAdminPush();
  }, 800);
}

function flushScheduledPushes() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  const client = pendingClientCapture;
  pendingClientCapture = null;
  if (client) dispatchClientCapture(client);
  if (sessionPersistenceActor?.role !== 'CLIENT' && hasAdminWork()) dispatchAdminPush();
}

/** Capture version before a command runs; the captures it produces are the ones after it. */
export function beginRemotePersistenceScope(): number {
  return clientCaptureVersion;
}

/**
 * Sends scheduled pushes now and resolves once every capture taken after `since` settled:
 * `confirmed` only when the server acknowledged all of them.
 */
export async function awaitRemotePersistence(since: number, timeoutMs = 10_000): Promise<RemotePersistenceOutcome> {
  if (!isFirestoreAuthoritative()) return { status: 'pending' };
  flushScheduledPushes();
  const awaited = [...captureOutcomes.entries()]
    .filter(([version]) => version > since)
    .sort(([a], [b]) => a - b)
    .map(([, outcome]) => outcome);
  if (adminPushInFlight) awaited.push(adminPushInFlight);
  if (awaited.length === 0) return { status: 'confirmed' };
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<RemotePersistenceOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ status: 'pending' }), timeoutMs);
  });
  try {
    return await Promise.race([Promise.all(awaited).then(mostSevereOutcome), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Sends scheduled pushes now and resolves once every in-flight/scheduled admin push settles.
 * Used as a barrier before switching client workspaces.
 */
export async function flushPendingAdminPushes(timeoutMs = 10_000): Promise<RemotePersistenceOutcome> {
  if (!isFirestoreAuthoritative()) return { status: 'confirmed' };
  flushScheduledPushes();
  if (!adminPushInFlight && !hasAdminWork()) return { status: 'confirmed' };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<RemotePersistenceOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ status: 'pending' }), timeoutMs);
  });

  const drainWork = async (): Promise<RemotePersistenceOutcome> => {
    const outcomes: RemotePersistenceOutcome[] = [];
    while (adminPushInFlight || hasAdminWork()) {
      if (adminPushInFlight) {
        const outcome = await adminPushInFlight;
        outcomes.push(outcome);
        // Stale-origin remote notes are recorded for the origin; they must not abort the
        // active session's drain. Hard failures still stop the barrier.
        if (
          outcome.status !== 'confirmed' &&
          outcome.status !== 'remote_confirmed_unapplied' &&
          outcome.status !== 'remote_uncertain'
        ) {
          break;
        }
      }
      if (hasAdminWork()) {
        flushScheduledPushes();
      } else {
        break;
      }
    }
    return outcomes.length ? flushBarrierOutcome(outcomes) : { status: 'confirmed' };
  };

  try {
    return await Promise.race([drainWork(), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function hydrateFromFirestore(clientIds: string[]): Promise<Partial<LocalV5Snapshot>> {
  if (!readFirebaseConfig()) return {};
  setFirestoreAuthoritative(true);
  return pullClientDataFromFirestore(clientIds);
}

type RealtimePartialHandler = (
  partial: Partial<LocalV5Snapshot>,
  meta: { clientId: string }
) => void;

let realtimeUnsubs: Array<() => void> = [];

/** Last listing of a live collection (ids, pending flag; rows only when no baseline holds them). */
type RealtimeCollectionState = {
  clientId: string;
  organizationId: string;
  snapshotKey: CollectionKey;
  received: boolean;
  docs: Map<string, { pending: boolean; row: Record<string, unknown> | null }>;
  /** Docs this session committed after that listing. */
  committedSince: Set<string>;
};
const realtimeCollections = new Map<string, RealtimeCollectionState>();
let realtimeHandler: RealtimePartialHandler | null = null;

/** Releases listener subscriptions without touching pending mutations or baselines. */
function detachFirestoreRealtimeListeners(): void {
  for (const unsub of realtimeUnsubs) unsub();
  realtimeUnsubs = [];
  liveCollections.clear();
  realtimeCollections.clear();
  realtimeHandler = null;
}

/** Detiene listeners en tiempo real (cambio de cliente o logout). Pending ADMIN and CLIENT mutations stay queued. */
export function stopFirestoreRealtimeSync() {
  detachFirestoreRealtimeListeners();
}

/**
 * Invalidates the persistence session (logout or identity/authorization change).
 * Active pending ADMIN mutations are orphaned with an explicit error — never confirmed and
 * never left on the dispatch queue for the next actor. Their values remain in
 * abandonedAdminValues so an identical local echo is not re-captured under a new session.
 */
export function clearFirestorePersistenceSession() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  const pendingCount = pendingAdminMutations.size;
  if (pendingCount > 0) {
    orphanActiveAdminMutations(
      `${pendingCount} cambio(s) ADMIN pendientes no se enviaron: la sesión de persistencia terminó antes del ACK.`
    );
  }
  persistenceGeneration++;
  sessionPersistenceActor = null;
  pendingDocDeletes.clear();
  pendingFieldClears.clear();
  pendingClientCapture = null;
  adminEchoGuards.clear();
}

/**
 * Binds the in-memory persistence actor without bumping generation on first bind after clear.
 * Bumps only when replacing a different uid/role/organization. Purges orphaned bundles and
 * abandoned echo-suppress entries from other uids so the new identity cannot observe or be
 * blocked by them. Same-uid abandoned entries are kept for legitimate echo suppression.
 *
 * Loss on foreign bind: orphaned mutation payloads of the prior uid are discarded (the user
 * already received an explicit push-error at orphan time). No durable recovery — RR-01 N/A.
 */
export function bindSessionPersistenceActor(actor: PersistenceActor | null): void {
  if (!actor) {
    if (sessionPersistenceActor) persistenceGeneration++;
    sessionPersistenceActor = null;
    return;
  }
  const next: PersistenceActor = {
    role: actor.role,
    clientId: actor.clientId ?? null,
    organizationId: actor.organizationId ?? null,
    uid: actor.uid ?? null,
  };
  if (sessionPersistenceActor && actorIdentityKey(sessionPersistenceActor) !== actorIdentityKey(next)) {
    persistenceGeneration++;
  }
  const nextUid = next.uid ?? '';
  if (orphanedAdminMutations && orphanedAdminMutations.uid !== nextUid) {
    orphanedAdminMutations = null;
  }
  for (const [path, entry] of [...abandonedAdminValues]) {
    if (entry.originUid !== nextUid) abandonedAdminValues.delete(path);
  }
  sessionPersistenceActor = next;
}

export function getPersistenceGenerationForTesting(): number {
  return persistenceGeneration;
}

export function setPersistenceGenerationForTesting(gen: number): void {
  persistenceGeneration = gen;
}

export function hasPendingAdminMutationsForDoc(path: string): boolean {
  return pendingAdminMutations.has(path);
}

/** Test/diagnostic: orphaned (non-dispatchable) bundle from a prior session, if any. */
export function getOrphanedAdminMutationCountForTesting(): number {
  return orphanedAdminMutations?.mutations.size ?? 0;
}

/** Test/diagnostic: abandoned echo entries visible only when tagged for this uid. */
export function getAbandonedAdminOriginUidForTesting(path: string): string | null {
  return abandonedAdminValues.get(path)?.originUid ?? null;
}

/**
 * Test/diagnostic: reconciliations for one origin uid. Never returns another identity's notes.
 */
export function getOriginRemoteReconciliationsForTesting(uid: string): OriginRemoteReconciliation[] {
  return originRemoteReconciliations
    .filter((entry) => entry.originUid === uid)
    .map((entry) => ({ ...entry, paths: [...entry.paths] }));
}

/**
 * When the origin identity returns in the same JS heap, paths already confirmed remotely
 * must not be re-dispatched. Hydration from Firestore remains the authoritative reconcile
 * after F5 (no durable local ledger — RR-01).
 */
export function getRemoteConfirmedUnappliedPathsForOrigin(uid: string): string[] {
  const paths = new Set<string>();
  for (const entry of originRemoteReconciliations) {
    if (entry.originUid === uid && entry.status === 'remote_confirmed_unapplied') {
      for (const path of entry.paths) paths.add(path);
    }
  }
  return [...paths];
}

/**
 * Arm the post-`runTransaction` ACK pause. No-op outside Vite test/E2E builds.
 * Optional `matchPath` limits the pause to chunks that include that document.
 */
export function armAdminCommitAckGateForTesting(matchPath?: string): void {
  if (!ADMIN_COMMIT_ACK_GATE_ENABLED) return;
  adminCommitAckGate = {
    armed: true,
    matchPath: matchPath?.trim() || null,
    paused: false,
    paths: [],
    release: null,
    wait: null,
  };
}

export function isAdminCommitAckGatePausedForTesting(): boolean {
  return ADMIN_COMMIT_ACK_GATE_ENABLED && adminCommitAckGate?.paused === true;
}

export function getAdminCommitAckGatePathsForTesting(): string[] {
  if (!ADMIN_COMMIT_ACK_GATE_ENABLED || !adminCommitAckGate) return [];
  return [...adminCommitAckGate.paths];
}

export function releaseAdminCommitAckGateForTesting(): void {
  if (!ADMIN_COMMIT_ACK_GATE_ENABLED) return;
  adminCommitAckGate?.release?.();
}

/** Release any waiter and clear gate state (also safe on failure paths). */
export function disarmAdminCommitAckGateForTesting(): void {
  if (!ADMIN_COMMIT_ACK_GATE_ENABLED) return;
  adminCommitAckGate?.release?.();
  adminCommitAckGate = null;
}

export function getPendingAdminMutationField(path: string, field: string): unknown {
  const entry = pendingAdminMutations.get(path);
  if (entry?.create) return entry.create.row[field];
  return entry?.fields.get(field)?.value;
}

const REALTIME_SUBS = [
  'sources',
  'signals',
  'notifications',
  'deliveries',
  'tasks',
  'contents',
  'theses',
  'recommendations',
  'opportunities',
  'campaigns',
  'results',
  'feedbackEvents',
  'proofWallItems',
  'aiRuns',
] as const;

/** Subcolecciones cuyo nombre en Firestore no coincide con la clave del snapshot. */
const REALTIME_KEY_MAP: Partial<Record<(typeof REALTIME_SUBS)[number] | 'evidence', CollectionKey>> = {
  evidence: 'evidenceVault',
};

/**
 * Escucha colecciones operativas por cliente.
 * Cada snapshot reemplaza solo el alcance de ese clientId (delete-aware).
 */
export async function startFirestoreRealtimeSync(
  clientIds: string[],
  onPartial: RealtimePartialHandler,
  options?: { stillCurrent?: () => boolean }
): Promise<void> {
  stopFirestoreRealtimeSync();
  if (!readFirebaseConfig() || !clientIds.length) return;
  if (options?.stillCurrent && !options.stillCurrent()) return;

  const db = await getFirebaseFirestore();
  if (!db) return;

  const { onSnapshot } = await import('firebase/firestore');
  const scope = await readTenantReadScope();
  if (!scope) return;
  if (options?.stillCurrent && !options.stillCurrent()) return;
  realtimeHandler = onPartial;

  const listen = async (clientId: string, sub: string, snapshotKey: CollectionKey) => {
    if (!isClientSubcollectionReadable(sub, scope)) return;
    const collectionPath = `${clientDocPath(clientId)}/${sub}`;
    const state: RealtimeCollectionState = {
      clientId,
      organizationId: scope.organizationId,
      snapshotKey,
      received: false,
      docs: new Map(),
      committedSince: new Set(),
    };
    realtimeCollections.set(collectionPath, state);
    const scopedQuery = await scopedClientSubcollectionQuery(db, clientId, sub, scope);
    const unsub = onSnapshot(scopedQuery, (snap: import('firebase/firestore').QuerySnapshot) => {
      if (isFromCache(snap) || snap.docs.some(hasPendingWrites)) {
        liveCollections.delete(collectionPath);
        markRemoteDocsKnown(collectionPath, confirmedDocIds(snap.docs));
        if (!isFromCache(snap)) recordRemoteBaseline(collectionPath, snap.docs, { prune: false });
      } else {
        applyLiveCollectionSnapshot(collectionPath, snap.docs.map((docSnap) => docSnap.id));
        recordRemoteBaseline(collectionPath, snap.docs, { prune: true });
      }
      if (isFromCache(snap)) return;
      const rows = snap.docs.map((docSnap) =>
        normalizeFirestorePulledData({
          ...docSnap.data(),
          id: docSnap.id,
          clientId,
        })
      );
      state.received = true;
      state.committedSince.clear();
      state.docs = new Map(
        snap.docs.map((docSnap, index) => [
          docSnap.id,
          {
            pending: hasPendingWrites(docSnap),
            row: remoteBaseline.has(`${collectionPath}/${docSnap.id}`) ? null : structuredClone(rows[index]),
          },
        ])
      );
      const partial: Partial<LocalV5Snapshot> = {
        [snapshotKey]: overlayPendingMutations(collectionPath, clientId, scope.organizationId, rows),
      } as Partial<LocalV5Snapshot>;
      onPartial(partial, { clientId });
    });
    realtimeUnsubs.push(unsub);
  };

  for (const clientId of clientIds) {
    for (const sub of REALTIME_SUBS) {
      await listen(clientId, sub, (REALTIME_KEY_MAP[sub] || sub) as CollectionKey);
    }
    await listen(clientId, 'evidence', 'evidenceVault');
  }
}
