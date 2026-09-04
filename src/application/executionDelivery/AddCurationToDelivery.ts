import type { CurationEntry, DeliveryItem, DeliveryPackage } from '../../types';
import {
  canAddCurationToDelivery,
  DESTINATION_TO_DELIVERY_ITEM_KIND,
} from '../../domain/deliveryAssemblyCore';
import { ExecutionDeliveryError } from './errors';
import type { CurationRepositoryPort } from './ports/CurationRepositoryPort';
import type { DeliveryAssemblyRepositoryPort } from './ports/DeliveryAssemblyRepositoryPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface AddCurationToDeliveryInput {
  trusted: TrustedExecutionDeliveryContext;
  curationEntryId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export type AddCurationToDeliveryResult =
  | { ok: true; package: DeliveryPackage; item: DeliveryItem; entry: CurationEntry }
  | { ok: false; compat: 'INELIGIBLE' };

export interface AddCurationToDeliveryDeps {
  assembly: DeliveryAssemblyRepositoryPort;
  curation: CurationRepositoryPort;
}

function buildDeliveryItemFromCuration(entry: CurationEntry): Omit<DeliveryItem, 'id'> {
  if (!entry.destination || entry.destination === 'DISCARD') {
    throw new ExecutionDeliveryError('INVALID_INPUT', 'Curation destination is invalid for delivery.');
  }
  return {
    kind: DESTINATION_TO_DELIVERY_ITEM_KIND[entry.destination],
    refId: entry.id,
    title: entry.aiAngle || entry.title,
    note: entry.snippet,
    url: entry.sourceUrl,
    rationale: entry.managerRationale,
    strategicBriefId: entry.strategicBriefId,
  };
}

/**
 * CR-1 #17 — AddCurationToDelivery.
 * A2 policy: attach only after confirmed DeliveryItem creation.
 */
export function createAddCurationToDelivery(deps: AddCurationToDeliveryDeps) {
  return function addCurationToDelivery(
    input: AddCurationToDeliveryInput
  ): AddCurationToDeliveryResult {
    const curationEntryId = input.curationEntryId?.trim();
    if (!curationEntryId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Curation entry id is required.');
    }

    assertTrustedExecutionContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
    });

    const entry = deps.curation.getById(curationEntryId);
    if (!entry || !canAddCurationToDelivery(entry)) {
      return { ok: false, compat: 'INELIGIBLE' };
    }
    if (entry.clientId !== input.trusted.clientId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Curation entry does not belong to the trusted client entitlement.'
      );
    }
    if (entry.organizationId !== input.trusted.organizationId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Curation entry does not belong to the trusted organization.'
      );
    }

    try {
      const existingDraft = deps.assembly.getDraftByClientId(entry.clientId);
      const pkg =
        existingDraft ??
        deps.assembly.ensureDraft(entry.clientId, input.trusted.actorId);

      if (pkg.status !== 'DRAFT') {
        throw new ExecutionDeliveryError(
          'PERSISTENCE_ERROR',
          'Delivery package is not in draft status.'
        );
      }
      if (pkg.clientId !== input.trusted.clientId) {
        throw new ExecutionDeliveryError(
          'TENANT_CONTEXT_INVALID',
          'Delivery package does not belong to the trusted client entitlement.'
        );
      }

      const itemPayload = buildDeliveryItemFromCuration(entry);
      const updated = deps.assembly.addDeliveryItem(pkg.id, itemPayload);
      if (!updated) {
        throw new ExecutionDeliveryError(
          'PERSISTENCE_ERROR',
          'Failed to add delivery item to draft package.'
        );
      }

      const createdItem = updated.items[updated.items.length - 1];
      if (!createdItem) {
        throw new ExecutionDeliveryError(
          'PERSISTENCE_ERROR',
          'Failed to confirm delivery item creation.'
        );
      }

      deps.assembly.attachCurationToDelivery(curationEntryId, pkg.id);

      const attached = deps.curation.getById(curationEntryId);
      if (!attached || attached.deliveryPackageId !== pkg.id) {
        throw new ExecutionDeliveryError(
          'PERSISTENCE_ERROR',
          'Failed to attach curation entry to delivery package.'
        );
      }

      return { ok: true, package: updated, item: createdItem, entry: attached };
    } catch (err) {
      if (err instanceof ExecutionDeliveryError) throw err;
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to add curation to delivery.'
      );
    }
  };
}
