import type { DeliveryPackage } from '../../types';
import { ExecutionDeliveryError } from './errors';
import type { DeliveryAssemblyRepositoryPort } from './ports/DeliveryAssemblyRepositoryPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface UpdateDeliveryPackageMetadataInput {
  trusted: TrustedExecutionDeliveryContext;
  packageId: string;
  title: string;
  strategicNote: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface UpdateDeliveryPackageMetadataResult {
  /** Legacy compat: false when package missing or not DRAFT (no-op). */
  updated: boolean;
  package?: DeliveryPackage;
}

export interface UpdateDeliveryPackageMetadataDeps {
  assembly: DeliveryAssemblyRepositoryPort;
}

/**
 * CR-1 #17 — UpdateDeliveryPackageMetadata.
 * Metadata fields only; missing/non-DRAFT is a silent no-op for legacy UX.
 */
export function createUpdateDeliveryPackageMetadata(deps: UpdateDeliveryPackageMetadataDeps) {
  return function updateDeliveryPackageMetadata(
    input: UpdateDeliveryPackageMetadataInput
  ): UpdateDeliveryPackageMetadataResult {
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
      return { updated: false };
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
      deps.assembly.updateDraftMetadata(packageId, {
        title: input.title,
        strategicNote: input.strategicNote,
      });
      const reloaded = deps.assembly.getPackageById(packageId);
      return { updated: true, package: reloaded };
    } catch (err) {
      if (err instanceof ExecutionDeliveryError) throw err;
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to update delivery metadata.'
      );
    }
  };
}
