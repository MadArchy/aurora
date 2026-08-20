import { dbService } from '../db';
import type { LocalV5Snapshot } from '../firestore/types';

export interface LocalV5Export {
  version: 5;
  exportedAt: string;
  payload: LocalV5Snapshot;
}

/** Exporta el estado v5 actual (memoria o localStorage). */
export function exportLocalV5(): LocalV5Export | null {
  try {
    return {
      version: 5,
      exportedAt: new Date().toISOString(),
      payload: dbService.exportSnapshot(),
    };
  } catch {
    return null;
  }
}

export async function importLocalV5ToFirestore(exportData: LocalV5Export): Promise<{ ok: boolean; message: string }> {
  const { importSnapshotToFirestore } = await import('../firestore/sync');
  const result = await importSnapshotToFirestore(exportData.payload);
  return { ok: result.ok, message: result.message };
}

export async function pushCurrentLocalToFirestore(): Promise<{ ok: boolean; message: string }> {
  const snapshot = exportLocalV5();
  if (!snapshot) return { ok: false, message: 'No hay datos locales para importar.' };
  return importLocalV5ToFirestore(snapshot);
}
