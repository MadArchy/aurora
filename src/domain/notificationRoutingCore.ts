import type { Client } from '../types';

/** IDs legacy del seed local (pre-Firebase Auth). */
export const LEGACY_MANAGER_UID = 'user_admin_01';
export const LEGACY_JUAN_CLIENT_UID = 'user_client_juan_01';

export function resolveManagerUserId(
  client: Pick<Client, 'primaryManagerId'> | null | undefined,
  fallbackUid?: string | null
): string | null {
  const id = client?.primaryManagerId?.trim() || fallbackUid?.trim() || null;
  return id || null;
}

export function resolveClientUserId(
  client: Pick<Client, 'userId'> | null | undefined
): string | null {
  const id = client?.userId?.trim();
  return id || null;
}

/** Expande un UID con sus alias legacy para filtrar la bandeja. */
export function expandUidAliases(
  uid: string,
  aliases: Record<string, string>
): Set<string> {
  const set = new Set<string>([uid]);
  for (const [legacy, current] of Object.entries(aliases)) {
    if (current === uid) set.add(legacy);
    if (legacy === uid) set.add(current);
  }
  return set;
}

export function remapNotificationUserId(
  userId: string,
  fromUid: string,
  toUid: string
): string {
  return userId === fromUid ? toUid : userId;
}
