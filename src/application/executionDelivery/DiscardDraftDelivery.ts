import { ExecutionDeliveryError } from './errors';
import type { DeliveryAssemblyRepositoryPort } from './ports/DeliveryAssemblyRepositoryPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface DiscardDraftDeliveryInput {
  trusted: TrustedExecutionDeliveryContext;
  packageId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface DiscardDraftDeliveryResult {
  discarded: boolean;
}

export interface DiscardDraftDeliveryDeps {
  assembly: DeliveryAssemblyRepositoryPort;
}

/**
 * CR-1 #17 — DiscardDraftDelivery.
 * Single aggregate mutation: detach linked curations and delete draft package.
 */
export function createDiscardDraftDelivery(deps: DiscardDraftDeliveryDeps) {
  return function discardDraftDelivery(input: DiscardDraftDeliveryInput): DiscardDraftDeliveryResult {
    const packageId = input.packageId?.trim();
    if (!packageId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Delivery package id is required.');
    }

    assertTrustedExecutionContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
    });

    const pkg = deps.assembly.getPackageById(packageId);
    if (!pkg || pkg.status !== 'DRAFT') {
      return { discarded: false };
    }
    if (pkg.clientId !== input.trusted.clientId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Delivery package does not belong to the trusted client entitlement.'
      );
    }
    if (pkg.organizationId !== input.trusted.organizationId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Delivery package does not belong to the trusted organization.'
      );
    }

    try {
      const discarded = deps.assembly.discardDraftDelivery(packageId);
      return { discarded };
    } catch (err) {
      if (err instanceof ExecutionDeliveryError) throw err;
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to discard delivery draft.'
      );
    }
  };
}
