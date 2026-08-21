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
};

function itemsForClient<T extends { clientId?: string | null; id?: string }>(
  rows: T[],
  clientId: string
): T[] {
  return rows.filter((row) => row.clientId === clientId);
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
    batch.set(doc(db, clientDocPath(client.id)), client, { merge: true });
    ops += 1;
    written += 1;

    for (const [key, subName] of Object.entries(COLLECTION_MAP)) {
      const rows = snapshot[key as CollectionKey];
      if (!Array.isArray(rows)) continue;
      for (const row of itemsForClient(rows as Array<{ clientId?: string | null; id?: string }>, client.id)) {
        if (!row.id) continue;
        batch.set(doc(db, `${clientDocPath(client.id)}/${subName}/${row.id}`), row, { merge: true });
        ops += 1;
        written += 1;
        if (ops >= 400) await flush();
      }
    }

    const profile = snapshot.profiles[client.id];
    if (profile) {
      batch.set(doc(db, `${clientDocPath(client.id)}/profile/data`), profile, { merge: true });
      ops += 1;
      written += 1;
    }

    const dossier = snapshot.dossiers[client.id];
    if (dossier) {
      batch.set(doc(db, `${clientDocPath(client.id)}/dossier/data`), dossier, { merge: true });
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
    void importSnapshotToFirestore(snapshot);
  }, 800);
}

export async function hydrateFromFirestore(clientIds: string[]): Promise<Partial<LocalV5Snapshot>> {
  if (!readFirebaseConfig()) return {};
  setFirestoreAuthoritative(true);
  return pullClientDataFromFirestore(clientIds);
}

type RealtimePartialHandler = (partial: Partial<LocalV5Snapshot>) => void;

let realtimeUnsubs: Array<() => void> = [];

/** Detiene listeners en tiempo real (logout). */
export function stopFirestoreRealtimeSync() {
  for (const unsub of realtimeUnsubs) unsub();
  realtimeUnsubs = [];
}

/**
 * Escucha cambios en fuentes y señales (ingesta cloud u otro dispositivo).
 * Usa merge + skipRemote para no re-empujar al servidor.
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

  for (const clientId of clientIds) {
    for (const sub of ['sources', 'signals'] as const) {
      const colRef = collection(db, `${clientDocPath(clientId)}/${sub}`);
      const unsub = onSnapshot(colRef, (snap: import('firebase/firestore').QuerySnapshot) => {
        const rows = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        if (sub === 'sources') {
          onPartial({ sources: rows as LocalV5Snapshot['sources'] });
        } else {
          onPartial({ signals: rows as LocalV5Snapshot['signals'] });
        }
      });
      realtimeUnsubs.push(unsub);
    }
  }
}
