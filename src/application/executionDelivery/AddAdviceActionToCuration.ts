import type { CurationEntry } from '../../types';
import { ExecutionDeliveryError } from './errors';
import type { AdviceReadPort } from './ports/AdviceReadPort';
import type { CurationRepositoryPort } from './ports/CurationRepositoryPort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface AddAdviceActionToCurationInput {
  trusted: TrustedExecutionDeliveryContext;
  /** Caller identifies intent only — Application reloads authoritative AdviceAction. */
  adviceActionId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface AddAdviceActionToCurationResult {
  entry: CurationEntry;
  adviceActionId: string;
}

export interface AddAdviceActionToCurationDeps {
  advice: AdviceReadPort;
  curation: CurationRepositoryPort;
}

/**
 * CR-1 #21a — AddAdviceActionToCuration (advisor-backed path).
 * Authoritative PositioningAdvice reload; synchronous read-to-write; no Signal/#21b/AI/dedup.
 */
export function createAddAdviceActionToCuration(deps: AddAdviceActionToCurationDeps) {
  return function addAdviceActionToCuration(
    input: AddAdviceActionToCurationInput
  ): AddAdviceActionToCurationResult {
    const adviceActionId = input.adviceActionId?.trim();
    if (!adviceActionId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Advice action id is required.');
    }

    assertTrustedExecutionContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
    });

    const resolved = deps.advice.findAdviceAction(input.trusted.clientId, adviceActionId);
    if (!resolved) {
      throw new ExecutionDeliveryError(
        'ADVICE_ACTION_NOT_FOUND',
        `Advice action not found: ${adviceActionId}`
      );
    }

    const { advice, action } = resolved;
    if (advice.clientId !== input.trusted.clientId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Advice does not belong to the trusted client entitlement.'
      );
    }
    if (advice.organizationId !== input.trusted.organizationId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Advice does not belong to the trusted organization.'
      );
    }

    try {
      const entry = deps.curation.addToCuration({
        organizationId: advice.organizationId,
        clientId: advice.clientId,
        title: action.title,
        snippet: `${action.why} ${action.how}`,
        score: action.impact,
        aiAngle: action.how,
        createdBy: input.trusted.actorId,
      });
      return { entry, adviceActionId: action.id };
    } catch (err) {
      if (err instanceof ExecutionDeliveryError) throw err;
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to add advice action to curation.'
      );
    }
  };
}
