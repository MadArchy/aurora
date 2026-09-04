import type { CurationEntry } from '../../types';
import { ExecutionDeliveryError } from './errors';
import type { CurationRepositoryPort } from './ports/CurationRepositoryPort';
import type { SignalReadPort } from './ports/SignalReadPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface AddSignalToCurationInput {
  trusted: TrustedExecutionDeliveryContext;
  /** Caller identifies intent only — Application reloads authoritative Signal. */
  signalId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface AddSignalToCurationResult {
  entry: CurationEntry;
}

export interface AddSignalToCurationDeps {
  signals: SignalReadPort;
  curation: CurationRepositoryPort;
}

/**
 * CR-1 #21a — AddSignalToCuration (signal-backed radar path).
 * Authoritative Signal reload; write-time dedup recheck; no scoring/routing authority.
 */
export function createAddSignalToCuration(deps: AddSignalToCurationDeps) {
  return function addSignalToCuration(input: AddSignalToCurationInput): AddSignalToCurationResult {
    const signalId = input.signalId?.trim();
    if (!signalId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Signal id is required.');
    }

    assertTrustedExecutionContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
    });

    const signal = deps.signals.getById(signalId);
    if (!signal) {
      throw new ExecutionDeliveryError('INVALID_INPUT', `Signal not found: ${signalId}`);
    }
    if (signal.clientId !== input.trusted.clientId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Signal does not belong to the trusted client entitlement.'
      );
    }
    if (signal.organizationId !== input.trusted.organizationId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Signal does not belong to the trusted organization.'
      );
    }

    if (deps.curation.isSignalInCuration(input.trusted.clientId, signalId)) {
      throw new ExecutionDeliveryError(
        'CURATION_ALREADY_EXISTS',
        'Esta señal ya está en la mesa de curación.'
      );
    }

    try {
      const entry = deps.curation.addToCuration({
        organizationId: signal.organizationId,
        clientId: signal.clientId,
        signalId: signal.id,
        thesisId: signal.thesisId,
        title: signal.title,
        sourceName: signal.sourceName,
        sourceUrl: signal.sourceUrl,
        snippet: signal.contentSnippet,
        score: signal.relevanceScore,
        priorityBand: signal.priorityBand,
        suggestedAction: signal.recommendedAction,
        createdBy: input.trusted.actorId,
      });
      return { entry };
    } catch (err) {
      if (err instanceof ExecutionDeliveryError) throw err;
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to add signal to curation.'
      );
    }
  };
}
