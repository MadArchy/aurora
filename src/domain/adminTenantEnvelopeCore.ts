/**
 * SPEC-009 Phase 4 / A24 — Admin SDK writers must not invent tenants.
 * Pure helpers (mirrored in functions/src/lib/tenantEnvelope.ts).
 */
export function requireTenantOrganizationId(
  source: { organizationId?: string | null },
  label = 'source'
): string {
  const org =
    typeof source.organizationId === 'string' ? source.organizationId.trim() : '';
  if (!org) {
    throw new Error(`${label}: organizationId is required (Admin SDK bypasses Rules)`);
  }
  return org;
}

export function requireMatchingClientId(
  pathClientId: string,
  source: { clientId?: string | null }
): string {
  const pathId = pathClientId.trim();
  if (!pathId) {
    throw new Error('clientId path segment is required');
  }
  if (typeof source.clientId === 'string' && source.clientId.trim()) {
    if (source.clientId.trim() !== pathId) {
      throw new Error('source.clientId does not match path clientId');
    }
  }
  return pathId;
}
