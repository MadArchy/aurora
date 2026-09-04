import type { DeliveryPackage } from '../../types';
import { ExecutionDeliveryError } from './errors';
import type { DeliveryAssemblyRepositoryPort } from './ports/DeliveryAssemblyRepositoryPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface EnsureDraftDeliveryInput {
  trusted: TrustedExecutionDeliveryContext;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface EnsureDraftDeliveryResult {
  package: DeliveryPackage;
  created: boolean;
}

export interface EnsureDraftDeliveryDeps {
  assembly: DeliveryAssemblyRepositoryPort;
}

/**
 * CR-1 #17 — EnsureDraftDelivery.
 * Singleton draft per client; trusted actorId only for createdBy.
 */
export function createEnsureDraftDelivery(deps: EnsureDraftDeliveryDeps) {
  return function ensureDraftDelivery(input: EnsureDraftDeliveryInput): EnsureDraftDeliveryResult {
    assertTrustedExecutionContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
    });

    const client = deps.assembly.getClientById(input.trusted.clientId);
    if (!client) {
      throw new ExecutionDeliveryError('TENANT_CONTEXT_INVALID', 'Client not found for trusted scope.');
    }
    const organizationId = client.organizationId?.trim();
    if (!organizationId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Client missing organizationId for delivery draft'
      );
    }
    if (organizationId !== input.trusted.organizationId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Client does not belong to the trusted organization.'
      );
    }

    const existing = deps.assembly.getDraftByClientId(input.trusted.clientId);
    if (existing) {
      if (existing.organizationId !== input.trusted.organizationId) {
        throw new ExecutionDeliveryError(
          'TENANT_CONTEXT_INVALID',
          'Delivery package does not belong to the trusted organization.'
        );
      }
      return { package: existing, created: false };
    }

    try {
      const pkg = deps.assembly.ensureDraft(input.trusted.clientId, input.trusted.actorId);
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
      return { package: pkg, created: true };
    } catch (err) {
      if (err instanceof ExecutionDeliveryError) throw err;
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to ensure delivery draft.'
      );
    }
  };
}
