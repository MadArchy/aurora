import type { UserRole } from '../../types';
import { ThesisLifecycleError } from './errors';

export interface TrustedThesisLifecycleContext {
  actorId: string;
  actorRole: UserRole;
  organizationId: string;
  clientId: string;
  now: string;
}

export function assertTrustedThesisContext(trusted: TrustedThesisLifecycleContext): void {
  if (!trusted.actorId?.trim()) {
    throw new ThesisLifecycleError('ACTOR_NOT_AUTHORIZED', 'Trusted actorId is required.');
  }
  if (!trusted.organizationId?.trim() || !trusted.clientId?.trim()) {
    throw new ThesisLifecycleError(
      'TENANT_CONTEXT_INVALID',
      'Trusted organizationId and clientId are required.'
    );
  }
  if (!trusted.now?.trim()) {
    throw new ThesisLifecycleError('TENANT_CONTEXT_INVALID', 'Trusted clock (now) is required.');
  }
}

export function assertNoThesisSpoof(params: {
  trusted: TrustedThesisLifecycleContext;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedClientApprovalStatus?: string;
}): void {
  const { trusted } = params;
  if (
    params.claimedOrganizationId?.trim() &&
    params.claimedOrganizationId.trim() !== trusted.organizationId
  ) {
    throw new ThesisLifecycleError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied organizationId does not match trusted session organization.'
    );
  }
  if (params.claimedClientId?.trim() && params.claimedClientId.trim() !== trusted.clientId) {
    throw new ThesisLifecycleError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied clientId does not match trusted client entitlement.'
    );
  }
  if (params.claimedStatus !== undefined || params.claimedClientApprovalStatus !== undefined) {
    throw new ThesisLifecycleError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied thesis lifecycle/approval state is not accepted as authority.'
    );
  }
}

export function requireAdminRole(trusted: TrustedThesisLifecycleContext): void {
  if (trusted.actorRole !== 'ADMIN') {
    throw new ThesisLifecycleError(
      'ACTOR_NOT_AUTHORIZED',
      'Thesis lifecycle write requires ADMIN role from the trusted session.'
    );
  }
}

export function requireClientRole(trusted: TrustedThesisLifecycleContext): void {
  if (trusted.actorRole !== 'CLIENT') {
    throw new ThesisLifecycleError(
      'ACTOR_NOT_AUTHORIZED',
      'Thesis client review requires CLIENT role from the trusted session.'
    );
  }
}
