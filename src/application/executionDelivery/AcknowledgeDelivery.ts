import { ExecutionDeliveryError } from './errors';
import type { DeliveryAcknowledgementPersistencePort } from './ports/DeliveryAcknowledgementPersistencePort';
import type { DeliveryAssemblyRepositoryPort } from './ports/DeliveryAssemblyRepositoryPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireClientRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface AcknowledgeDeliveryInput {
  trusted: TrustedExecutionDeliveryContext;
  packageId: string;
  clientAckNote?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export type AcknowledgeDeliveryCompat = 'DELIVERY_NOT_FOUND';

export type AcknowledgeDeliveryResult =
  | { ok: true; packageId: string; clientId: string }
  | { ok: false; compat: AcknowledgeDeliveryCompat };

export interface AcknowledgeDeliveryDeps {
  assembly: Pick<DeliveryAssemblyRepositoryPort, 'getPackageById'>;
  acknowledgement: DeliveryAcknowledgementPersistencePort;
}

/**
 * CR-1 #19 — AcknowledgeDelivery.
 * CLIENT read receipt: SENT → ACKNOWLEDGED on DeliveryPackage; no approval semantics.
 */
export function createAcknowledgeDelivery(deps: AcknowledgeDeliveryDeps) {
  return function acknowledgeDelivery(input: AcknowledgeDeliveryInput): AcknowledgeDeliveryResult {
    const packageId = input.packageId?.trim();
    if (!packageId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Delivery package id is required.');
    }

    assertTrustedExecutionContext(input.trusted);
    requireClientRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
    });

    const pkg = deps.assembly.getPackageById(packageId);
    if (!pkg) {
      return { ok: false, compat: 'DELIVERY_NOT_FOUND' };
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
      const updated = deps.acknowledgement.markAcknowledged(packageId, {
        acknowledgedAt: input.trusted.now,
        clientAckNote: input.clientAckNote,
      });
      if (!updated) {
        return { ok: false, compat: 'DELIVERY_NOT_FOUND' };
      }
      return { ok: true, packageId: updated.id, clientId: updated.clientId };
    } catch (err) {
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to acknowledge delivery.'
      );
    }
  };
}
