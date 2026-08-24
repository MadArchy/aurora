import type { PositioningThesis, Signal } from '../../types';
import {
  findThesisById,
  resolveRoutedThesisFromSignal,
} from '../../domain/routedThesisContext';
import { StrategicScoringError } from './errors';

export interface GovernedThesisContext {
  routingState: 'CLEAR';
  thesisId: string;
  thesis: PositioningThesis;
}

/**
 * Resolve the single thesis context for governed post-routing scoring.
 * Fail-closed on CONTESTED / UNROUTED — ignores stale compatibility thesisId.
 */
export function resolveGovernedThesisForScoring(
  signal: Signal,
  theses: PositioningThesis[]
): GovernedThesisContext {
  const decisionState = signal.routingDecision?.routingState;
  if (decisionState === 'CLEAR' && !signal.thesisId) {
    throw new StrategicScoringError(
      'ROUTING_CONTEXT_INVALID',
      'CLEAR routing requires selectedThesisId / thesisId.'
    );
  }

  const routed = resolveRoutedThesisFromSignal(signal);

  if (routed.status === 'CONTESTED') {
    throw new StrategicScoringError(
      'ROUTING_CONTEXT_CONTESTED',
      'Signal routing is CONTESTED — single-thesis scoring is not allowed.'
    );
  }

  if (routed.status === 'UNROUTED' || routed.status === 'NO_SIGNAL') {
    throw new StrategicScoringError(
      'ROUTING_CONTEXT_REQUIRED',
      'Signal has no CLEAR routed thesis context.'
    );
  }

  const thesis = findThesisById(theses, routed.thesisId);
  if (!thesis) {
    throw new StrategicScoringError(
      'THESIS_NOT_FOUND',
      `Routed thesis not found for client: ${routed.thesisId}`
    );
  }

  if (thesis.clientId !== signal.clientId) {
    throw new StrategicScoringError(
      'TENANT_CONTEXT_INVALID',
      'Routed thesis clientId does not match signal clientId.'
    );
  }

  if (
    signal.organizationId &&
    thesis.organizationId &&
    signal.organizationId !== thesis.organizationId
  ) {
    throw new StrategicScoringError(
      'TENANT_CONTEXT_INVALID',
      'Routed thesis organizationId does not match signal organizationId.'
    );
  }

  return {
    routingState: 'CLEAR',
    thesisId: routed.thesisId,
    thesis,
  };
}
