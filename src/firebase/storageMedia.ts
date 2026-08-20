import { readFirebaseConfig } from './config';
import { getFirebaseStorage } from './app';
import { STORAGE_REF_PREFIX, storageRecordingPath } from '../services/firestore/paths';
import {
  RECORDING_REF_PREFIX,
  getRecordingBlob,
  saveRecording,
  deleteRecording,
} from '../services/recordings';

export async function uploadRecordingToStorage(
  orgId: string,
  clientId: string,
  taskId: string,
  blob: Blob
): Promise<string | null> {
  if (!readFirebaseConfig()) return null;
  const storage = await getFirebaseStorage();
  if (!storage) return null;

  const path = storageRecordingPath(orgId, clientId, taskId);
  const { ref, uploadBytes } = await import('firebase/storage');
  await uploadBytes(ref(storage, path), blob);
  return `${STORAGE_REF_PREFIX}${path}`;
}

export async function resolveRecordingUrl(evidenceUrl?: string | null): Promise<string | null> {
  const storagePath = evidenceUrl?.startsWith(STORAGE_REF_PREFIX)
    ? evidenceUrl.slice(STORAGE_REF_PREFIX.length)
    : null;

  if (storagePath && readFirebaseConfig()) {
    const storage = await getFirebaseStorage();
    if (storage) {
      const { ref, getDownloadURL } = await import('firebase/storage');
      return getDownloadURL(ref(storage, storagePath));
    }
  }

  const taskId = evidenceUrl?.startsWith(RECORDING_REF_PREFIX)
    ? evidenceUrl.slice(RECORDING_REF_PREFIX.length)
    : null;
  if (!taskId) return null;
  const blob = await getRecordingBlob(taskId);
  return blob ? URL.createObjectURL(blob) : null;
}

/** Sube a Storage si Firebase está activo; si no, IndexedDB local. */
export async function persistRecording(
  orgId: string,
  clientId: string,
  taskId: string,
  blob: Blob
): Promise<string> {
  const storageRef = await uploadRecordingToStorage(orgId, clientId, taskId, blob);
  if (storageRef) return storageRef;
  await saveRecording(taskId, blob);
  return `${RECORDING_REF_PREFIX}${taskId}`;
}

export async function removeRecording(evidenceUrl?: string | null): Promise<void> {
  const storagePath = evidenceUrl?.startsWith(STORAGE_REF_PREFIX)
    ? evidenceUrl.slice(STORAGE_REF_PREFIX.length)
    : null;
  if (storagePath && readFirebaseConfig()) {
    const storage = await getFirebaseStorage();
    if (storage) {
      const { ref, deleteObject } = await import('firebase/storage');
      await deleteObject(ref(storage, storagePath));
      return;
    }
  }
  const taskId = evidenceUrl?.startsWith(RECORDING_REF_PREFIX)
    ? evidenceUrl.slice(RECORDING_REF_PREFIX.length)
    : null;
  if (taskId) await deleteRecording(taskId);
}
