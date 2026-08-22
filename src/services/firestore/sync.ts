import type { LocalV5Snapshot } from './types';
import { getFirebaseFirestore } from '../../firebase/app';
import { readFirebaseConfig } from '../../firebase/config';
import { CLIENT_SUBCOLLECTIONS, clientDocPath } from './paths';

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

function itemsForClient<T extends { clientId?: string | null; id?: string }>(
  rows: T[],
  clientId: string
): T[] {
  return rows.filter((row) => row.clientId === clientId);
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

/** Importa snapshot v5 a Firestore (Emulator o producción). */
export async function importSnapshotToFirestore(
  snapshot: LocalV5Snapshot
): Promise<{ ok: boolean; message: string; written: number }> {
  if (!readFirebaseConfig()) {
    return { ok: false, message: 'Configura VITE_FIREBASE_* para importar.', written: 0 };
  }

  const db = await getFirebaseFirestore();
  if (!db) return { ok: false, message: 'Firestore no inicializado.', written: 0 };

  const { doc, writeBatch } = await import('firebase/firestore');
  let written = 0;
  let batch = writeBatch(db);
  let ops = 0;

  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = writeBatch(db!);
    ops = 0;
  };

  for (const client of snapshot.clients) {
    batch.set(doc(db, clientDocPath(client.id)), stripUndefinedForFirestore(client), { merge: true });
    ops += 1;
    written += 1;

    for (const [key, subName] of Object.entries(COLLECTION_MAP)) {
      const rows = snapshot[key as CollectionKey];
      if (!Array.isArray(rows)) continue;
      for (const row of itemsForClient(rows as Array<{ clientId?: string | null; id?: string }>, client.id)) {
        if (!row.id) continue;
        batch.set(
          doc(db, `${clientDocPath(client.id)}/${subName}/${row.id}`),
          stripUndefinedForFirestore(row),
          { merge: true }
        );
        ops += 1;
        written += 1;
        if (ops >= 400) await flush();
      }
    }

    const profile = snapshot.profiles[client.id];
    if (profile) {
      batch.set(
        doc(db, `${clientDocPath(client.id)}/profile/data`),
        stripUndefinedForFirestore(profile),
        { merge: true }
      );
      ops += 1;
      written += 1;
    }

    const dossier = snapshot.dossiers[client.id];
    if (dossier) {
      batch.set(
        doc(db, `${clientDocPath(client.id)}/dossier/data`),
        stripUndefinedForFirestore(dossier),
        { merge: true }
      );
      ops += 1;
      written += 1;
    }
  }

  await flush();
  return { ok: true, message: `Importados ${written} documentos a Firestore.`, written };
}

export async function listFirestoreClientIds(): Promise<string[]> {
  const db = await getFirebaseFirestore();
  if (!db) return [];
  const { collection, getDocs } = await import('firebase/firestore');
  const snap = await getDocs(collection(db, 'clients'));
  return snap.docs.map((docSnap) => docSnap.id);
}

/** Descarga datos de Firestore para un cliente (o todos si admin). */
export async function pullClientDataFromFirestore(
  clientIds: string[]
): Promise<Partial<LocalV5Snapshot>> {
  const db = await getFirebaseFirestore();
  if (!db) return {};

  const { doc, getDoc, collection, getDocs } = await import('firebase/firestore');
  const partial: Partial<LocalV5Snapshot> = {
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

  for (const clientId of clientIds) {
    const clientSnap = await getDoc(doc(db, clientDocPath(clientId)));
    if (clientSnap.exists()) {
      partial.clients!.push(clientSnap.data() as unknown as LocalV5Snapshot['clients'][number]);
    }

    for (const sub of CLIENT_SUBCOLLECTIONS) {
      const snap = await getDocs(collection(db, `${clientDocPath(clientId)}/${sub}`));
      const targetKey = Object.entries(COLLECTION_MAP).find(([, v]) => v === sub)?.[0] as CollectionKey | undefined;
      if (!targetKey || !Array.isArray(partial[targetKey])) continue;
      for (const row of snap.docs) {
        (partial[targetKey] as unknown[]).push({ id: row.id, ...row.data() });
      }
    }

    const profileSnap = await getDoc(doc(db, `${clientDocPath(clientId)}/profile/data`));
    if (profileSnap.exists()) partial.profiles![clientId] = profileSnap.data() as unknown as LocalV5Snapshot['profiles'][string];

    const dossierSnap = await getDoc(doc(db, `${clientDocPath(clientId)}/dossier/data`));
    if (dossierSnap.exists()) partial.dossiers![clientId] = dossierSnap.data() as unknown as LocalV5Snapshot['dossiers'][string];
  }

  return partial;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let authoritative = false;
type FirestorePushErrorHandler = (message: string) => void;
let pushErrorHandler: FirestorePushErrorHandler | null = null;

export function onFirestorePushError(handler: FirestorePushErrorHandler | null) {
  pushErrorHandler = handler;
}

export function setFirestoreAuthoritative(active: boolean) {
  authoritative = active;
}

export function isFirestoreAuthoritative(): boolean {
  return authoritative && Boolean(readFirebaseConfig());
}

export function scheduleFirestorePush(snapshot: LocalV5Snapshot) {
  if (!isFirestoreAuthoritative()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void importSnapshotToFirestore(snapshot).then((result) => {
      if (!result.ok) pushErrorHandler?.(result.message);
    }).catch((err) => {
      const message = err instanceof Error ? err.message : 'Error al sincronizar con Firestore.';
      pushErrorHandler?.(message);
    });
  }, 800);
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

/** Detiene listeners en tiempo real (logout). */
export function stopFirestoreRealtimeSync() {
  for (const unsub of realtimeUnsubs) unsub();
  realtimeUnsubs = [];
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
  onPartial: RealtimePartialHandler
): Promise<void> {
  stopFirestoreRealtimeSync();
  if (!readFirebaseConfig() || !clientIds.length) return;

  const db = await getFirebaseFirestore();
  if (!db) return;

  const { collection, onSnapshot } = await import('firebase/firestore');

  const listen = (clientId: string, sub: string, snapshotKey: CollectionKey) => {
    const colRef = collection(db, `${clientDocPath(clientId)}/${sub}`);
    const unsub = onSnapshot(colRef, (snap: import('firebase/firestore').QuerySnapshot) => {
      const rows = snap.docs.map((docSnap) => ({
        ...docSnap.data(),
        id: docSnap.id,
        clientId,
      }));
      const partial: Partial<LocalV5Snapshot> = {
        [snapshotKey]: rows,
      } as Partial<LocalV5Snapshot>;
      onPartial(partial, { clientId });
    });
    realtimeUnsubs.push(unsub);
  };

  for (const clientId of clientIds) {
    for (const sub of REALTIME_SUBS) {
      listen(clientId, sub, (REALTIME_KEY_MAP[sub] || sub) as CollectionKey);
    }
    // Evidence usa nombre distinto en el snapshot local.
    listen(clientId, 'evidence', 'evidenceVault');
  }
}
