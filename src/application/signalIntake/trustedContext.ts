import type { UserRole } from '../../types';
import { SignalIntakeError } from './errors';

export interface TrustedSignalIntakeContext {
  actorId: string;
  actorRole: UserRole;
  organizationId: string;
  clientId: string;
  now: string;
}

export function assertTrustedSignalIntakeContext(trusted: TrustedSignalIntakeContext): void {
  if (!trusted.actorId?.trim()) {
    throw new SignalIntakeError('ACTOR_NOT_AUTHORIZED', 'Trusted actorId is required.');
  }
  if (!trusted.organizationId?.trim() || !trusted.clientId?.trim()) {
    throw new SignalIntakeError(
      'TENANT_CONTEXT_INVALID',
      'Trusted organizationId and clientId are required.'
    );
  }
  if (!trusted.now?.trim()) {
    throw new SignalIntakeError('TENANT_CONTEXT_INVALID', 'Trusted clock (now) is required.');
  }
}

export function assertNoSignalIntakeSpoof(params: {
  trusted: TrustedSignalIntakeContext;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedMatchedThesisId?: string;
  claimedScore?: number;
  claimedRoutingDecision?: string;
  claimedStrategicDecision?: string;
}): void {
  const { trusted } = params;
  if (
    params.claimedOrganizationId?.trim() &&
    params.claimedOrganizationId.trim() !== trusted.organizationId
  ) {
    throw new SignalIntakeError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied organizationId does not match trusted session organization.'
    );
  }
  if (params.claimedClientId?.trim() && params.claimedClientId.trim() !== trusted.clientId) {
    throw new SignalIntakeError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied clientId does not match trusted client entitlement.'
    );
  }
  if (
    params.claimedMatchedThesisId !== undefined ||
    params.claimedScore !== undefined ||
    params.claimedRoutingDecision !== undefined ||
    params.claimedStrategicDecision !== undefined
  ) {
    throw new SignalIntakeError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied routing/scoring/thesis authority is not accepted on Signal Intake.'
    );
  }
}

/** Source registration and manual signal intake are manager/admin actions. */
export function requireAdminRole(trusted: TrustedSignalIntakeContext): void {
  if (trusted.actorRole !== 'ADMIN') {
    throw new SignalIntakeError(
      'ACTOR_NOT_AUTHORIZED',
      'Signal Intake write requires ADMIN role from the trusted session.'
    );
  }
}
