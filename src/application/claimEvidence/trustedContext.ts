/**
 * SPEC-006 Phase 2 — Trusted actor context.
 * Caller payloads are never authority for tenant/role/software verification.
 */

import type { UserRole } from '../../types';
import { ClaimEvidenceError } from './errors';

/**
 * Trusted context injected by composition / auth boundary.
 * `softwareAuthority` must NEVER be set from browser/HTTP payload mapping.
 * Only internal jobs / composition roots may set it for SOFTWARE verification.
 */
export interface TrustedClaimActorContext {
  actorId: string;
  actorRole: UserRole;
  organizationId: string;
  clientId: string;
  now: string;
  /** Internal-only. Browser mapping must leave undefined/false. */
  softwareAuthority?: boolean;
}

export function assertTrustedClaimActor(
  trusted: TrustedClaimActorContext,
  options?: { adminOnly?: boolean }
): void {
  if (!trusted.actorId?.trim()) {
    throw new ClaimEvidenceError('ACTOR_NOT_AUTHORIZED', 'Trusted actorId is required.');
  }
  if (!trusted.organizationId?.trim() || !trusted.clientId?.trim()) {
    throw new ClaimEvidenceError(
      'TENANT_CONTEXT_INVALID',
      'Trusted organizationId and clientId are required.'
    );
  }
  if (!trusted.now?.trim()) {
    throw new ClaimEvidenceError('TENANT_CONTEXT_INVALID', 'Trusted clock (now) is required.');
  }
  if (options?.adminOnly !== false && trusted.actorRole !== 'ADMIN') {
    throw new ClaimEvidenceError(
      'UNAUTHORIZED_ACTOR',
      'Claim governance requires ADMIN role.'
    );
  }
}

export function assertNoTenantSpoof(params: {
  trusted: TrustedClaimActorContext;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): void {
  const { trusted, claimedOrganizationId, claimedClientId } = params;
  if (claimedOrganizationId && claimedOrganizationId !== trusted.organizationId) {
    throw new ClaimEvidenceError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied organizationId does not match trusted tenant context.'
    );
  }
  if (claimedClientId && claimedClientId !== trusted.clientId) {
    throw new ClaimEvidenceError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied clientId does not match trusted tenant context.'
    );
  }
}

export function assertSoftwareAuthority(trusted: TrustedClaimActorContext): void {
  if (!trusted.softwareAuthority) {
    throw new ClaimEvidenceError(
      'VERIFICATION_FORBIDDEN',
      'SOFTWARE verification requires trusted softwareAuthority (not caller-spoofable).'
    );
  }
}
