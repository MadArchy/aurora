import type { CurationDestination, CurationEntry } from '../../types';
import { ExecutionDeliveryError } from './errors';
import type { CurationRepositoryPort } from './ports/CurationRepositoryPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

const VALID_DESTINATIONS: CurationDestination[] = [
  'TASK_VIDEO',
  'TASK_ARTICLE',
  'OPPORTUNITY',
  'REFERENCE_READING',
  'EVIDENCE',
  'DISCARD',
];

export interface DecideCurationInput {
  trusted: TrustedExecutionDeliveryContext;
  curationEntryId: string;
  destination: CurationDestination;
  rationale: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface DecideCurationResult {
  entry: CurationEntry;
}

export interface DecideCurationDeps {
  curation: CurationRepositoryPort;
}

/**
 * CR-1 #14 — DecideCuration.
 * Authoritative CurationEntry reload; curation decision fields only; no Signal/#20/AI/downstream materialization.
 */
export function createDecideCuration(deps: DecideCurationDeps) {
  return function decideCuration(input: DecideCurationInput): DecideCurationResult {
    const curationEntryId = input.curationEntryId?.trim();
    if (!curationEntryId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Curation entry id is required.');
    }
    if (!VALID_DESTINATIONS.includes(input.destination)) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Curation destination is invalid.');
    }

    assertTrustedExecutionContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
    });

    const existing = deps.curation.getById(curationEntryId);
    if (!existing) {
      throw new ExecutionDeliveryError(
        'CURATION_NOT_FOUND',
        `Curation entry not found: ${curationEntryId}`
      );
    }
    if (existing.clientId !== input.trusted.clientId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Curation entry does not belong to the trusted client entitlement.'
      );
    }
    if (existing.organizationId !== input.trusted.organizationId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Curation entry does not belong to the trusted organization.'
      );
    }

    try {
      const entry = deps.curation.decideCuration({
        id: curationEntryId,
        destination: input.destination,
        managerRationale: input.rationale.trim(),
        decidedBy: input.trusted.actorId,
        decidedAt: input.trusted.now,
      });
      if (!entry) {
        throw new ExecutionDeliveryError(
          'CURATION_NOT_FOUND',
          `Curation entry not found: ${curationEntryId}`
        );
      }
      return { entry };
    } catch (err) {
      if (err instanceof ExecutionDeliveryError) throw err;
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to decide curation entry.'
      );
    }
  };
}
