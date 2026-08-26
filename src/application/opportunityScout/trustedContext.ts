/**
 * SPEC-007 Phase 2 — Trusted actor / tenant context.
 * Caller payloads never establish organizationId, clientId, actorId, role, or actorType.
 */

import type { UserRole } from '../../types';
import type { OpportunityActorKind } from '../../domain/opportunityLifecycleCore';
import { OpportunityApplicationError } from './errors';

/**
 * Trusted context injected by composition / auth boundary.
 * `softwareAuthority` must NEVER be set from browser/HTTP payload mapping.
 */
export interface TrustedOpportunityActorContext {
  actorId: string;
  actorRole: UserRole;
  organizationId: string;
  clientId: string;
  /** Injected clock — Application does not call Date.now. */
  now: string;
  /** Internal-only. Browser mapping must leave undefined/false. */
  softwareAuthority?: boolean;
}

export function assertTrustedOpportunityActor(
  trusted: TrustedOpportunityActorContext
): void {
  if (!trusted?.actorId?.trim()) {
    throw new OpportunityApplicationError(
      'TRUSTED_CONTEXT_REQUIRED',
      'Trusted actorId is required.'
    );
  }
  if (!trusted.organizationId?.trim() || !trusted.clientId?.trim()) {
    throw new OpportunityApplicationError(
      'TENANT_MISMATCH',
      'Trusted organizationId and clientId are required.'
    );
  }
  if (!trusted.now?.trim()) {
    throw new OpportunityApplicationError(
      'TRUSTED_CONTEXT_REQUIRED',
      'Trusted clock (now) is required.'
    );
  }
}

export function assertNoTenantSpoof(params: {
  trusted: TrustedOpportunityActorContext;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): void {
  const { trusted, claimedOrganizationId, claimedClientId } = params;
  if (claimedOrganizationId && claimedOrganizationId !== trusted.organizationId) {
    throw new OpportunityApplicationError(
      'TENANT_ACCESS_DENIED',
      'Caller-supplied organizationId does not match trusted tenant context.'
    );
  }
  if (claimedClientId && claimedClientId !== trusted.clientId) {
    throw new OpportunityApplicationError(
      'TENANT_ACCESS_DENIED',
      'Caller-supplied clientId does not match trusted tenant context.'
    );
  }
}

export function trustedTenant(trusted: TrustedOpportunityActorContext): {
  organizationId: string;
  clientId: string;
} {
  return {
    organizationId: trusted.organizationId,
    clientId: trusted.clientId,
  };
}

/**
 * Resolve Domain actor kind from trusted context only — never from caller actorType.
 * AI / UI / UNKNOWN cannot be established by caller metadata.
 */
export function resolveTrustedOpportunityActorKind(
  trusted: TrustedOpportunityActorContext,
  mode: 'humanLifecycle' | 'softwareLifecycle' | 'materialize' | 'intelligence'
): OpportunityActorKind {
  if (trusted.softwareAuthority) {
    if (mode === 'humanLifecycle') {
      throw new OpportunityApplicationError(
        'UNAUTHORIZED_ACTOR',
        'SOFTWARE cannot perform human-required opportunity lifecycle transitions.'
      );
    }
    return 'SOFTWARE';
  }
  if (mode === 'materialize' || mode === 'softwareLifecycle') {
    throw new OpportunityApplicationError(
      'UNAUTHORIZED_ACTOR',
      'SOFTWARE authority requires trusted softwareAuthority (not caller-spoofable).'
    );
  }
  if (trusted.actorRole === 'ADMIN' || trusted.actorRole === 'CLIENT') {
    return 'HUMAN';
  }
  throw new OpportunityApplicationError(
    'UNAUTHORIZED_ACTOR',
    'Trusted actor cannot perform this opportunity operation.'
  );
}

/** Explicit deny: caller claiming HUMAN/AI/UI never upgrades trusted kind. */
export function ignoreCallerActorClaims(input: {
  actorType?: string;
  actorKind?: string;
  role?: string;
  softwareAuthority?: boolean;
  humanAuthority?: boolean;
}): void {
  void input.actorType;
  void input.actorKind;
  void input.role;
  void input.softwareAuthority;
  void input.humanAuthority;
}
