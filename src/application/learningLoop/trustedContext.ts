/**
 * SPEC-008 Phase 2 — Trusted actor / tenant context.
 * Caller payloads never establish organizationId, clientId, actorId, role, or actorType.
 */

import type { UserRole } from '../../types';
import type { RecommendationActorKind } from '../../domain/recommendationLifecycleCore';
import { LearningApplicationError } from './errors';

/**
 * Trusted context injected by composition / auth boundary.
 * `softwareAuthority` must NEVER be set from browser/HTTP payload mapping.
 */
export interface TrustedLearningActorContext {
  actorId: string;
  actorRole: UserRole;
  organizationId: string;
  clientId: string;
  /** Injected clock — Application does not call Date.now. */
  now: string;
  /** Internal-only. Browser mapping must leave undefined/false. */
  softwareAuthority?: boolean;
}

export function assertTrustedLearningActor(
  trusted: TrustedLearningActorContext
): void {
  if (!trusted?.actorId?.trim()) {
    throw new LearningApplicationError(
      'TRUSTED_CONTEXT_REQUIRED',
      'Trusted actorId is required.'
    );
  }
  if (!trusted.organizationId?.trim() || !trusted.clientId?.trim()) {
    throw new LearningApplicationError(
      'TENANT_MISMATCH',
      'Trusted organizationId and clientId are required.'
    );
  }
  if (!trusted.now?.trim()) {
    throw new LearningApplicationError(
      'TRUSTED_CONTEXT_REQUIRED',
      'Trusted clock (now) is required.'
    );
  }
}

export function assertNoTenantSpoof(params: {
  trusted: TrustedLearningActorContext;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): void {
  const { trusted, claimedOrganizationId, claimedClientId } = params;
  if (claimedOrganizationId && claimedOrganizationId !== trusted.organizationId) {
    throw new LearningApplicationError(
      'TENANT_ACCESS_DENIED',
      'Caller-supplied organizationId does not match trusted tenant context.'
    );
  }
  if (claimedClientId && claimedClientId !== trusted.clientId) {
    throw new LearningApplicationError(
      'TENANT_ACCESS_DENIED',
      'Caller-supplied clientId does not match trusted tenant context.'
    );
  }
}

export function trustedTenant(trusted: TrustedLearningActorContext): {
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
 */
export function resolveTrustedLearningActorKind(
  trusted: TrustedLearningActorContext,
  mode:
    | 'humanLifecycle'
    | 'softwareLifecycle'
    | 'generate'
    | 'apply'
    | 'observation'
    | 'review'
): RecommendationActorKind {
  if (trusted.softwareAuthority) {
    if (mode === 'humanLifecycle') {
      throw new LearningApplicationError(
        'UNAUTHORIZED_ACTOR',
        'SOFTWARE cannot perform human-required recommendation lifecycle transitions.'
      );
    }
    return 'SOFTWARE';
  }
  if (mode === 'apply' || mode === 'softwareLifecycle' || mode === 'generate') {
    throw new LearningApplicationError(
      'UNAUTHORIZED_ACTOR',
      'SOFTWARE authority requires trusted softwareAuthority (not caller-spoofable).'
    );
  }
  if (mode === 'observation' || mode === 'review' || mode === 'humanLifecycle') {
    if (trusted.actorRole === 'ADMIN' || trusted.actorRole === 'CLIENT') {
      return 'HUMAN';
    }
    throw new LearningApplicationError(
      'UNAUTHORIZED_ACTOR',
      'Trusted actor cannot perform this learning operation.'
    );
  }
  throw new LearningApplicationError(
    'UNAUTHORIZED_ACTOR',
    'Unknown actor resolution mode.'
  );
}

/** Explicit deny: caller claiming HUMAN/AI/UI never upgrades trusted kind. */
export function ignoreCallerActorClaims(input: {
  actorType?: string;
  actorKind?: string;
  role?: string;
  softwareAuthority?: boolean;
  humanAuthority?: boolean;
  approvedBy?: string;
  reviewedBy?: string;
  actorUid?: string;
  createdBy?: string;
}): void {
  void input.actorType;
  void input.actorKind;
  void input.role;
  void input.softwareAuthority;
  void input.humanAuthority;
  void input.approvedBy;
  void input.reviewedBy;
  void input.actorUid;
  void input.createdBy;
}
