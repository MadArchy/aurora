/** Reglas de aislamiento por clientId (DoD piloto §7.6). */

export interface ClientScopedActor {
  role: 'ADMIN' | 'CLIENT';
  clientId?: string | null;
}

export function filterByClientId<T extends { clientId?: string | null }>(
  rows: T[],
  clientId: string
): T[] {
  return rows.filter((row) => row.clientId === clientId);
}

/** CLIENT solo accede a recursos de su clientId; ADMIN a todos. */
export function canAccessClientResource(actor: ClientScopedActor, resourceClientId: string): boolean {
  if (actor.role === 'ADMIN') return true;
  return Boolean(actor.clientId && actor.clientId === resourceClientId);
}

/** Rechaza elevación de rol desde metadatos de sesión si no coincide con la cuenta. */
export function resolveTrustedRole(
  accountRole: 'ADMIN' | 'CLIENT',
  sessionRole?: string | null
): 'ADMIN' | 'CLIENT' {
  return sessionRole === accountRole ? accountRole : accountRole;
}
