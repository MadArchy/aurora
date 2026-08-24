import type { Signal } from '../../types';
import type { ThesisRoutingResult } from '../../domain/thesisRoutingCore';
import { StrategicRoutingError } from './errors';

/**
 * Persistence projection of a governed routing result.
 * selectedThesisId is written only for CLEAR and is never inferred from
 * thesisScores, signal.thesisId, or first/highest thesis.
 */
export function toPersistedRoutingDecision(
  routing: ThesisRoutingResult,
  extras?: { actorId?: string }
): NonNullable<Signal['routingDecision']> {
  const decision: NonNullable<Signal['routingDecision']> = {
    contested: routing.contested,
    secondaryThesisId: routing.secondaryThesisId,
    source: routing.source,
    routingState: routing.routingState,
    algorithmVersion: routing.algorithmVersion,
    rationale: routing.rationale,
    routedAt: routing.routedAt,
  };
  if (extras?.actorId) {
    decision.actorId = extras.actorId;
  }

  if (routing.routingState === 'CLEAR') {
    const selected = routing.selectedThesisId?.trim();
    if (!selected) {
      throw new StrategicRoutingError(
        'PERSISTENCE_ERROR',
        'CLEAR routing cannot persist without selectedThesisId.'
      );
    }
    decision.selectedThesisId = selected;
  }

  return decision;
}
