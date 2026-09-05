import { ExecutionDeliveryError } from './errors';
import type { CurationRemovalPersistencePort } from './ports/CurationRemovalPersistencePort';
import type { CurationRepositoryPort } from './ports/CurationRepositoryPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface RemoveCurationInput {
  trusted: TrustedExecutionDeliveryContext;
  curationEntryId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export type RemoveCurationCompat = 'CURATION_NOT_FOUND';

export type RemoveCurationResult = { ok: true } | { ok: false; compat: RemoveCurationCompat };

export interface RemoveCurationDeps {
  curation: CurationRepositoryPort;
  removal: CurationRemovalPersistencePort;
}

/**
 * CR-1 #16-R — RemoveCuration.
 * Authoritative reload; ADMIN-only; physical delete of CurationEntry; no referential cleanup.
 */
export function createRemoveCuration(deps: RemoveCurationDeps) {
  return function removeCuration(input: RemoveCurationInput): RemoveCurationResult {
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
    if (!entry) {
      return { ok: false, compat: 'CURATION_NOT_FOUND' };
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
      deps.removal.removeById(curationEntryId);
    } catch (err) {
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to remove curation entry.'
      );
    }

    return { ok: true };
  };
}
