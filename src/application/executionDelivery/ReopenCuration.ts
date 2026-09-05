import { ExecutionDeliveryError } from './errors';
import type { CurationReopenPersistencePort } from './ports/CurationReopenPersistencePort';
import type { CurationRepositoryPort } from './ports/CurationRepositoryPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface ReopenCurationInput {
  trusted: TrustedExecutionDeliveryContext;
  curationEntryId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export type ReopenCurationCompat = 'CURATION_NOT_FOUND';

export type ReopenCurationResult = { ok: true } | { ok: false; compat: ReopenCurationCompat };

export interface ReopenCurationDeps {
  curation: CurationRepositoryPort;
  reopen: CurationReopenPersistencePort;
}

/**
 * CR-1 #16-O — ReopenCuration.
 * Authoritative reload; ADMIN-only; partial decision reset only; no audit.
 */
export function createReopenCuration(deps: ReopenCurationDeps) {
  return function reopenCuration(input: ReopenCurationInput): ReopenCurationResult {
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
      deps.reopen.reopenById(curationEntryId);
    } catch (err) {
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to reopen curation entry.'
      );
    }

    return { ok: true };
  };
}
