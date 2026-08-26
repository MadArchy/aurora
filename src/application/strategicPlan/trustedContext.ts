/**
 * SPEC-004 Phase 2 — Trusted actor / tenant context.
 * Caller payloads are never authority for actorId, role, tenant, or approval.
 */

import type { UserRole } from '../../types';
import type { PlanActorKind } from '../../domain/planItemCore';
import { StrategicPlanError } from './errors';

/**
 * Trusted context injected by composition / auth boundary.
 * `softwareAuthority` must NEVER be set from browser/HTTP payload mapping.
 */
export interface TrustedPlanActorContext {
  actorId: string;
  actorRole: UserRole;
  organizationId: string;
  clientId: string;
  /** Injected clock — Application does not call Date.now. */
  now: string;
  /** Internal-only. Browser mapping must leave undefined/false. */
  softwareAuthority?: boolean;
}

export function assertTrustedPlanActor(
  trusted: TrustedPlanActorContext,
  options?: { adminOnly?: boolean }
): void {
  if (!trusted?.actorId?.trim()) {
    throw new StrategicPlanError('TRUSTED_CONTEXT_REQUIRED', 'Trusted actorId is required.');
  }
  if (!trusted.organizationId?.trim() || !trusted.clientId?.trim()) {
    throw new StrategicPlanError(
      'TENANT_CONTEXT_INVALID',
      'Trusted organizationId and clientId are required.'
    );
  }
  if (!trusted.now?.trim()) {
    throw new StrategicPlanError('TRUSTED_CONTEXT_REQUIRED', 'Trusted clock (now) is required.');
  }
  if (options?.adminOnly !== false && trusted.actorRole !== 'ADMIN') {
    throw new StrategicPlanError(
      'ACTOR_NOT_AUTHORIZED',
      'Strategic Plan governance requires ADMIN role.'
    );
  }
}

export function assertNoTenantSpoof(params: {
  trusted: TrustedPlanActorContext;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): void {
  const { trusted, claimedOrganizationId, claimedClientId } = params;
  if (claimedOrganizationId && claimedOrganizationId !== trusted.organizationId) {
    throw new StrategicPlanError(
      'TENANT_ACCESS_DENIED',
      'Caller-supplied organizationId does not match trusted tenant context.'
    );
  }
  if (claimedClientId && claimedClientId !== trusted.clientId) {
    throw new StrategicPlanError(
      'TENANT_ACCESS_DENIED',
      'Caller-supplied clientId does not match trusted tenant context.'
    );
  }
}

/** Resolve Domain actor kind from trusted context only — never from caller actorKind. */
export function resolveTrustedActorKind(
  trusted: TrustedPlanActorContext,
  mode: 'approve' | 'activate' | 'mutate'
): PlanActorKind {
  if (trusted.softwareAuthority) {
    if (mode === 'approve') {
      throw new StrategicPlanError(
        'ACTOR_NOT_AUTHORIZED',
        'SOFTWARE cannot approve or reject StrategicPlan.'
      );
    }
    return 'SOFTWARE';
  }
  if (trusted.actorRole === 'ADMIN') {
    return 'HUMAN';
  }
  throw new StrategicPlanError(
    'ACTOR_NOT_AUTHORIZED',
    'Trusted actor cannot perform this plan operation.'
  );
}

export function assertSoftwareAuthority(trusted: TrustedPlanActorContext): void {
  if (!trusted.softwareAuthority) {
    throw new StrategicPlanError(
      'ACTOR_NOT_AUTHORIZED',
      'SOFTWARE authority requires trusted softwareAuthority (not caller-spoofable).'
    );
  }
}
