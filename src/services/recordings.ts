const DB_NAME = 'postura_recordings_v1';
const STORE = 'blobs';

export const RECORDING_REF_PREFIX = 'indexeddb:';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function parseRecordingTaskId(evidenceUrl?: string | null): string | null {
  if (!evidenceUrl?.startsWith(RECORDING_REF_PREFIX)) return null;
  const taskId = evidenceUrl.slice(RECORDING_REF_PREFIX.length).trim();
  return taskId || null;
}

export function isRecordingRef(evidenceUrl?: string | null): boolean {
  return Boolean(parseRecordingTaskId(evidenceUrl));
}

/** True si la evidencia apunta a IndexedDB o Firebase Storage. */
export function isPlayableRecordingRef(evidenceUrl?: string | null): boolean {
  if (!evidenceUrl) return false;
  if (evidenceUrl.startsWith(RECORDING_REF_PREFIX)) return isRecordingRef(evidenceUrl);
  return evidenceUrl.startsWith('storage:');
}

export async function saveRecording(taskId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, taskId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getRecordingBlob(taskId: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(taskId);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
  return blob ?? null;
}

export async function hasRecording(taskId: string): Promise<boolean> {
  const blob = await getRecordingBlob(taskId);
  return blob !== null;
}

export async function getRecordingUrl(taskId: string): Promise<string | null> {
  const blob = await getRecordingBlob(taskId);
  return blob ? URL.createObjectURL(blob) : null;
}

export async function deleteRecording(taskId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(taskId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function downloadRecording(taskId: string, filename?: string): Promise<boolean> {
  return downloadRecordingFromEvidence(`${RECORDING_REF_PREFIX}${taskId}`, filename || `postura-video-${taskId}.webm`);
}

/** Descarga desde `indexeddb:` o `storage:` (Firebase). */
export async function downloadRecordingFromEvidence(
  evidenceUrl: string | null | undefined,
  filename?: string
): Promise<boolean> {
  if (!evidenceUrl) return false;

  let blob: Blob | null = null;
  const { FIREBASE_ENABLED } = await import('../firebase/config');
  if (FIREBASE_ENABLED && evidenceUrl.startsWith('storage:')) {
    const { getRecordingBlobFromEvidence } = await import('../firebase/storageMedia');
    blob = await getRecordingBlobFromEvidence(evidenceUrl);
  } else {
    const taskId = parseRecordingTaskId(evidenceUrl);
    blob = taskId ? await getRecordingBlob(taskId) : null;
  }
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'postura-video.webm';
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

/** IndexedDB por defecto; Firebase Storage solo si VITE_FIREBASE_* está configurado. */
export async function persistRecording(
  orgId: string,
  clientId: string,
  taskId: string,
  blob: Blob
): Promise<string> {
  const { FIREBASE_ENABLED } = await import('../firebase/config');
  if (FIREBASE_ENABLED) {
    const { persistRecording: cloudPersist } = await import('../firebase/storageMedia');
    return cloudPersist(orgId, clientId, taskId, blob);
  }
  await saveRecording(taskId, blob);
  return `${RECORDING_REF_PREFIX}${taskId}`;
}

export async function resolveRecordingUrl(evidenceUrl?: string | null): Promise<string | null> {
  const { FIREBASE_ENABLED } = await import('../firebase/config');
  if (FIREBASE_ENABLED) {
    const { resolveRecordingUrl: cloudResolve } = await import('../firebase/storageMedia');
    return cloudResolve(evidenceUrl);
  }
  const taskId = parseRecordingTaskId(evidenceUrl);
  return taskId ? getRecordingUrl(taskId) : null;
}
