/** Rutas Firestore alineadas con firestore.rules (clients/{id}/…). */
export const CLIENT_SUBCOLLECTIONS = [
  'signals',
  'tasks',
  'curation',
  'deliveries',
  'contents',
  'opportunities',
  'results',
  'theses',
  'campaigns',
  'evidence',
  'advices',
  'feedbackEvents',
  'proofWallItems',
  'sources',
] as const;

export type ClientSubcollection = (typeof CLIENT_SUBCOLLECTIONS)[number];

export function clientDocPath(clientId: string): string {
  return `clients/${clientId}`;
}

export function clientSubPath(clientId: string, collection: ClientSubcollection, docId: string): string {
  return `clients/${clientId}/${collection}/${docId}`;
}

export function orgDocPath(orgId: string): string {
  return `organizations/${orgId}`;
}

export function storageRecordingPath(orgId: string, clientId: string, taskId: string): string {
  return `organizations/${orgId}/clients/${clientId}/recordings/${taskId}.webm`;
}

export const STORAGE_REF_PREFIX = 'storage:';

export function parseStorageRecordingRef(evidenceUrl?: string | null): string | null {
  if (!evidenceUrl?.startsWith(STORAGE_REF_PREFIX)) return null;
  const path = evidenceUrl.slice(STORAGE_REF_PREFIX.length).trim();
  return path || null;
}

export function isStorageRecordingRef(evidenceUrl?: string | null): boolean {
  return Boolean(parseStorageRecordingRef(evidenceUrl));
}
