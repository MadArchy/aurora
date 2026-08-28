import type { UserRole } from '../../types';
import { MasterProfileError } from './errors';

/**
 * Trusted tenant+actor for Master Profile writes.
 * Always produced by `requireTenantScope` — never from the caller.
 */
export interface TrustedMasterProfileContext {
  actorId: string;
  actorRole: UserRole;
  organizationId: string;
  clientId: string;
  now: string;
}

export function assertTrustedMasterProfileContext(trusted: TrustedMasterProfileContext): void {
  if (!trusted.actorId?.trim()) {
    throw new MasterProfileError('ACTOR_NOT_AUTHORIZED', 'Trusted actorId is required.');
  }
  if (!trusted.organizationId?.trim() || !trusted.clientId?.trim()) {
    throw new MasterProfileError(
      'TENANT_CONTEXT_INVALID',
      'Trusted organizationId and clientId are required.'
    );
  }
  if (!trusted.now?.trim()) {
    throw new MasterProfileError('TENANT_CONTEXT_INVALID', 'Trusted clock (now) is required.');
  }
}

export function assertNoMasterProfileSpoof(params: {
  trusted: TrustedMasterProfileContext;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedProfileCompleteness?: number;
  claimedOnboardingStatus?: string;
  claimedClientStatus?: string;
}): void {
  const { trusted } = params;
  if (
    params.claimedOrganizationId?.trim() &&
    params.claimedOrganizationId.trim() !== trusted.organizationId
  ) {
    throw new MasterProfileError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied organizationId does not match trusted session organization.'
    );
  }
  if (params.claimedClientId?.trim() && params.claimedClientId.trim() !== trusted.clientId) {
    throw new MasterProfileError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied clientId does not match trusted client entitlement.'
    );
  }
  if (params.claimedProfileCompleteness !== undefined) {
    throw new MasterProfileError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied profileCompleteness is not accepted as authority.'
    );
  }
  if (params.claimedOnboardingStatus !== undefined || params.claimedClientStatus !== undefined) {
    throw new MasterProfileError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied lifecycle/onboarding state is not accepted as authority.'
    );
  }
}
