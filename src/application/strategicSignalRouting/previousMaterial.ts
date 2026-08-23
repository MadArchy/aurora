import type { Signal } from '../../types';
import {
  ROUTING_ALGORITHM_VERSION,
  type MaterialRoutingDecision,
} from '../../domain/thesisRoutingCore';

/** Reconstruct prior material decision from current Signal fields (if any). */
export function previousMaterialFromSignal(
  signal: Signal
): MaterialRoutingDecision | undefined {
  const rd = signal.routingDecision;
  if (!rd?.routingState && !rd?.source && !signal.thesisId) return undefined;
  return {
    routingState: rd?.routingState ?? (signal.thesisId ? 'CLEAR' : 'UNROUTED'),
    selectedThesisId: signal.thesisId,
    source: rd?.source ?? 'AUTO',
    algorithmVersion:
      (rd?.algorithmVersion as typeof ROUTING_ALGORITHM_VERSION) ||
      ROUTING_ALGORITHM_VERSION,
    rationale: rd?.rationale ?? signal.scoreRationale ?? '',
  };
}
