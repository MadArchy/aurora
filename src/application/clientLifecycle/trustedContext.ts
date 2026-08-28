import type { UserRole } from '../../types';
import { ClientLifecycleError } from './errors';

/**
 * Trusted admin context for org-scoped client creation.
 * organizationId / actorId / actorRole come only from the security gate
 * (`requireAdminActor`), never from the caller.
 */
export interface TrustedClientLifecycleAdminContext {
  actorId: string;
  actorRole: UserRole;
  organizationId: string;
  now: string;
}

export function assertTrustedAdminActor(trusted: TrustedClientLifecycleAdminContext): void {
  if (!trusted.actorId?.trim()) {
    throw new ClientLifecycleError('ACTOR_NOT_AUTHORIZED', 'Trusted actorId is required.');
  }
  if (!trusted.organizationId?.trim()) {
    throw new ClientLifecycleError(
      'TENANT_CONTEXT_INVALID',
      'Trusted organizationId is required.'
    );
  }
  if (!trusted.now?.trim()) {
    throw new ClientLifecycleError('TENANT_CONTEXT_INVALID', 'Trusted clock (now) is required.');
  }
  if (trusted.actorRole !== 'ADMIN') {
    throw new ClientLifecycleError(
      'ACTOR_NOT_AUTHORIZED',
      'Client creation requires ADMIN role from the trusted session.'
    );
  }
}

/** Caller-supplied organizationId is never authority — mismatch is denied. */
export function assertNoOrganizationSpoof(params: {
  trusted: TrustedClientLifecycleAdminContext;
  claimedOrganizationId?: string;
}): void {
  const claimed = params.claimedOrganizationId?.trim();
  if (claimed && claimed !== params.trusted.organizationId) {
    throw new ClientLifecycleError(
      'TENANT_CONTEXT_INVALID',
      'Caller-supplied organizationId does not match trusted session organization.'
    );
  }
}
