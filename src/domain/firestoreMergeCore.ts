/**
 * Merge seguro de colecciones por cliente (Firestore realtime).
 * Evita que el snapshot de un cliente pise filas de otros.
 */

export type RowWithClient = { id?: string; clientId?: string | null };

/** Upsert por id, sin borrar filas ausentes. */
export function mergeRowsById<T extends RowWithClient>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of existing) {
    if (row.id) map.set(row.id, row);
  }
  for (const row of incoming) {
    if (row.id) map.set(row.id, row);
  }
  return Array.from(map.values());
}

/**
 * Reemplaza solo las filas del clientId dado; conserva el resto.
 * Si incoming está vacío, elimina todas las locales de ese cliente.
 */
export function replaceClientScopedRows<T extends RowWithClient>(
  existing: T[],
  incoming: T[],
  clientId: string
): T[] {
  const others = existing.filter((row) => row.clientId !== clientId);
  const scoped = incoming.filter((row) => !row.clientId || row.clientId === clientId);
  // Asegura clientId en filas remotas sin campo (doc path = cliente).
  const normalized = scoped.map((row) =>
    row.clientId ? row : ({ ...row, clientId } as T)
  );
  return [...others, ...normalized];
}

export function applyScopedCollectionMerge<T extends RowWithClient>(
  existing: T[],
  incoming: T[] | undefined,
  options: { merge: boolean; scopeClientId?: string }
): T[] | undefined {
  if (incoming === undefined) return undefined;
  if (!options.merge) return incoming;
  if (options.scopeClientId) {
    return replaceClientScopedRows(existing, incoming, options.scopeClientId);
  }
  return mergeRowsById(existing, incoming);
}
