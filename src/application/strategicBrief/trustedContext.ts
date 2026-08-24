import type { UserRole } from '../../types';
import { StrategicBriefError } from './errors';

/** Neutral trusted actor — not Firebase Auth. Time is injected; Application does not call Date.now. */
export interface TrustedBriefActorContext {
  actorId: string;
  actorRole: UserRole;
  organizationId: string;
  clientId: string;
  now: string;
}

export function assertTrustedBriefActor(
  trusted: TrustedBriefActorContext,
  options?: { adminOnly?: boolean }
): void {
  if (!trusted.actorId?.trim()) {
    throw new StrategicBriefError('ACTOR_NOT_AUTHORIZED', 'Trusted actorId is required.');
  }
  if (!trusted.organizationId?.trim() || !trusted.clientId?.trim()) {
    throw new StrategicBriefError(
      'TENANT_CONTEXT_INVALID',
      'Trusted organizationId and clientId are required.'
    );
  }
  if (!trusted.now?.trim()) {
    throw new StrategicBriefError('STRATEGIC_CONTEXT_INVALID', 'Trusted clock (now) is required.');
  }
  if (options?.adminOnly !== false && trusted.actorRole !== 'ADMIN') {
    throw new StrategicBriefError(
      'ACTOR_NOT_AUTHORIZED',
      'Strategic Brief governance requires ADMIN role.'
    );
  }
}

export function assertNoTenantSpoof(params: {
  trusted: TrustedBriefActorContext;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): void {
  const { trusted, claimedOrganizationId, claimedClientId } = params;
  if (claimedOrganizationId && claimedOrganizationId !== trusted.organizationId) {
    throw new StrategicBriefError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied organizationId does not match trusted tenant context.'
    );
  }
  if (claimedClientId && claimedClientId !== trusted.clientId) {
    throw new StrategicBriefError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied clientId does not match trusted tenant context.'
    );
  }
}
