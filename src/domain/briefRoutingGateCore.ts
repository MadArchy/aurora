import type { BriefUpstreamRoutingState } from './strategicBriefCore';
import { briefFail, briefOk, type BriefDomainResult } from './strategicBriefErrors';

/** Governed upstream routing context supplied by Application — Domain does not read repositories. */
export interface BriefRoutingContextInput {
  routingState: BriefUpstreamRoutingState;
  governedThesisId?: string;
  algorithmVersion?: string;
  routedAt?: string;
  source?: 'AUTO' | 'MANUAL';
}

export interface SignalRoutingContextInput {
  signalId: string;
  routingState: BriefUpstreamRoutingState;
  governedThesisId?: string;
}

export interface BriefRoutingEligibilityInput {
  thesisId: string;
  signalIds: readonly string[];
  routing: BriefRoutingContextInput;
  signalRouting?: readonly SignalRoutingContextInput[];
}

function thesisMismatch(
  thesisId: string,
  governedThesisId: string | undefined
): boolean {
  return !governedThesisId || governedThesisId !== thesisId;
}

/**
 * CLEAR + matching governed thesis is the only eligible path for approval/action.
 * CONTESTED and UNROUTED fail closed. Domain never selects a thesis.
 */
export function evaluateBriefRoutingEligibility(
  input: BriefRoutingEligibilityInput
): BriefDomainResult<void> {
  const { routing, thesisId, signalIds } = input;

  if (routing.routingState === 'CONTESTED') {
    return briefFail(
      'ROUTING_CONTEXT_INVALID',
      'CONTESTED routing cannot produce an APPROVED or actionable StrategicBrief'
    );
  }
  if (routing.routingState === 'UNROUTED') {
    return briefFail(
      'ROUTING_CONTEXT_INVALID',
      'UNROUTED routing cannot produce an APPROVED or actionable StrategicBrief'
    );
  }
  if (routing.routingState !== 'CLEAR') {
    return briefFail('ROUTING_CONTEXT_INVALID', 'routingState must be CLEAR for an actionable Brief');
  }
  if (thesisMismatch(thesisId, routing.governedThesisId)) {
    return briefFail(
      'ROUTING_CONTEXT_INVALID',
      'thesisId must match the governed CLEAR selected thesis'
    );
  }

  if (input.signalRouting && input.signalRouting.length > 0) {
    const byId = new Map(input.signalRouting.map((row) => [row.signalId, row]));
    for (const signalId of signalIds) {
      const row = byId.get(signalId);
      if (!row) {
        return briefFail(
          'ROUTING_CONTEXT_INVALID',
          `missing routing context for signal ${signalId}`
        );
      }
      if (row.routingState === 'CONTESTED' || row.routingState === 'UNROUTED') {
        return briefFail(
          'ROUTING_CONTEXT_INVALID',
          `${row.routingState} signal ${signalId} cannot join an actionable Brief`
        );
      }
      if (row.routingState !== 'CLEAR' || thesisMismatch(thesisId, row.governedThesisId)) {
        return briefFail(
          'ROUTING_CONTEXT_INVALID',
          `signal ${signalId} is not CLEAR to the Brief thesis`
        );
      }
    }
    const mixed = input.signalRouting.find(
      (row) => row.governedThesisId && row.governedThesisId !== thesisId
    );
    if (mixed) {
      return briefFail(
        'ROUTING_CONTEXT_INVALID',
        'mixed-thesis signal clusters cannot form one Brief'
      );
    }
  }

  return briefOk(undefined);
}

export function isClearGovernedThesisMatch(
  thesisId: string,
  routing: BriefRoutingContextInput
): boolean {
  return routing.routingState === 'CLEAR' && routing.governedThesisId === thesisId;
}
