import type { UserRole } from '../../types';
import { ExecutionDeliveryError } from './errors';

export interface TrustedExecutionDeliveryContext {
  actorId: string;
  actorRole: UserRole;
  organizationId: string;
  clientId: string;
  now: string;
}

export function assertTrustedExecutionContext(trusted: TrustedExecutionDeliveryContext): void {
  if (!trusted.actorId?.trim()) {
    throw new ExecutionDeliveryError('ACTOR_NOT_AUTHORIZED', 'Trusted actorId is required.');
  }
  if (!trusted.organizationId?.trim() || !trusted.clientId?.trim()) {
    throw new ExecutionDeliveryError(
      'TENANT_CONTEXT_INVALID',
      'Trusted organizationId and clientId are required.'
    );
  }
  if (!trusted.now?.trim()) {
    throw new ExecutionDeliveryError('TENANT_CONTEXT_INVALID', 'Trusted clock (now) is required.');
  }
}

export function assertNoExecutionSpoof(params: {
  trusted: TrustedExecutionDeliveryContext;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedPipelineStatus?: string;
  claimedPublicationState?: string;
  claimedClaimSafetyVerdict?: string;
}): void {
  const { trusted } = params;
  if (
    params.claimedOrganizationId?.trim() &&
    params.claimedOrganizationId.trim() !== trusted.organizationId
  ) {
    throw new ExecutionDeliveryError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied organizationId does not match trusted session organization.'
    );
  }
  if (params.claimedClientId?.trim() && params.claimedClientId.trim() !== trusted.clientId) {
    throw new ExecutionDeliveryError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied clientId does not match trusted client entitlement.'
    );
  }
  if (
    params.claimedStatus !== undefined ||
    params.claimedPipelineStatus !== undefined ||
    params.claimedPublicationState !== undefined
  ) {
    throw new ExecutionDeliveryError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied lifecycle/publication state is not accepted as authority.'
    );
  }
  if (params.claimedClaimSafetyVerdict !== undefined) {
    throw new ExecutionDeliveryError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied claim-safety verdict is not accepted as authority.'
    );
  }
}

export function requireAdminRole(trusted: TrustedExecutionDeliveryContext): void {
  if (trusted.actorRole !== 'ADMIN') {
    throw new ExecutionDeliveryError(
      'ACTOR_NOT_AUTHORIZED',
      'This Execution Delivery write requires ADMIN role from the trusted session.'
    );
  }
}

export function requireClientRole(trusted: TrustedExecutionDeliveryContext): void {
  if (trusted.actorRole !== 'CLIENT') {
    throw new ExecutionDeliveryError(
      'ACTOR_NOT_AUTHORIZED',
      'This Execution Delivery write requires CLIENT role from the trusted session.'
    );
  }
}

/** Task transitions may be CLIENT (portal) or ADMIN (manager assist). */
export function requireTaskActorRole(trusted: TrustedExecutionDeliveryContext): void {
  if (trusted.actorRole !== 'CLIENT' && trusted.actorRole !== 'ADMIN') {
    throw new ExecutionDeliveryError(
      'ACTOR_NOT_AUTHORIZED',
      'Task transition requires CLIENT or ADMIN role from the trusted session.'
    );
  }
}
