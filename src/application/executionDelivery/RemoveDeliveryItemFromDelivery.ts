import { ExecutionDeliveryError } from './errors';
import type { DeliveryAssemblyRepositoryPort } from './ports/DeliveryAssemblyRepositoryPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface RemoveDeliveryItemFromDeliveryInput {
  trusted: TrustedExecutionDeliveryContext;
  packageId: string;
  itemId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface RemoveDeliveryItemFromDeliveryResult {
  /** Legacy compat: false when package missing or not DRAFT (no-op). */
  removed: boolean;
}

export interface RemoveDeliveryItemFromDeliveryDeps {
  assembly: DeliveryAssemblyRepositoryPort;
}

/**
 * CR-1 #17 — RemoveDeliveryItemFromDelivery.
 * R1 policy: detach CurationEntry then remove DeliveryItem.
 */
export function createRemoveDeliveryItemFromDelivery(deps: RemoveDeliveryItemFromDeliveryDeps) {
  return function removeDeliveryItemFromDelivery(
    input: RemoveDeliveryItemFromDeliveryInput
  ): RemoveDeliveryItemFromDeliveryResult {
    const packageId = input.packageId?.trim();
    const itemId = input.itemId?.trim();
    if (!packageId || !itemId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Delivery package and item ids are required.');
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
      return { removed: false };
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

    const item = pkg.items.find((i) => i.id === itemId);

    try {
      if (item?.refId) {
        deps.assembly.attachCurationToDelivery(item.refId, null);
      }
      deps.assembly.removeDeliveryItem(packageId, itemId);
      return { removed: true };
    } catch (err) {
      if (err instanceof ExecutionDeliveryError) throw err;
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to remove delivery item.'
      );
    }
  };
}
