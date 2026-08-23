import type { Signal, StrategicScoreResult } from '../../../types';
import type { ThesisRoutingResult } from '../../../domain/thesisRoutingCore';

export interface PersistStrategicRoutingParams {
  signalId: string;
  clientId: string;
  organizationId: string;
  routing: ThesisRoutingResult;
  /** thesisId only when CLEAR; explicit undefined clears false current attribution. */
  thesisId: string | undefined;
  thesisScores: NonNullable<Signal['thesisScores']>;
  routingDecision: NonNullable<Signal['routingDecision']>;
  whyNow?: Signal['whyNow'];
  /**
   * UI score fields. MUST NOT trigger terminal DISCARD.
   * Never derived via first-item strategic selection.
   */
  scoreResult: StrategicScoreResult;
}

/**
 * Governed write for strategic routing.
 * Implementations MUST NOT silent-DISCARD from low score.
 */
export interface SignalWritePort {
  persistStrategicRouting(params: PersistStrategicRoutingParams): void;
}
