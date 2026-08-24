import { briefFail, briefOk, type BriefDomainResult } from './strategicBriefErrors';

export interface BriefTenantEnvelope {
  organizationId: string;
  clientId: string;
}

function nonEmptyId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Structural tenant envelope only. Domain cannot prove external entity ownership —
 * cross-client lookups belong to Application via StrategicContextReader (Phase 2).
 */
export function assertBriefTenantStructure(
  envelope: BriefTenantEnvelope
): BriefDomainResult<BriefTenantEnvelope> {
  const organizationId = nonEmptyId(envelope.organizationId);
  const clientId = nonEmptyId(envelope.clientId);
  if (!organizationId || !clientId) {
    return briefFail('INVALID_BRIEF', 'organizationId and clientId are required');
  }
  return briefOk({ organizationId, clientId });
}

export function tenantEnvelopesMatch(
  left: BriefTenantEnvelope,
  right: BriefTenantEnvelope
): boolean {
  return left.organizationId === right.organizationId && left.clientId === right.clientId;
}

/**
 * Caller supplies already-resolved tenant ids. This does not query a repository.
 */
export function assertResolvedRefsMatchBriefTenant(
  envelope: BriefTenantEnvelope,
  refs: readonly BriefTenantEnvelope[]
): BriefDomainResult<void> {
  const self = assertBriefTenantStructure(envelope);
  if (!self.ok) return self;
  for (const ref of refs) {
    if (!tenantEnvelopesMatch(self.value, ref)) {
      return briefFail('INVALID_BRIEF', 'referenced tenant envelope does not match Brief');
    }
  }
  return briefOk(undefined);
}
