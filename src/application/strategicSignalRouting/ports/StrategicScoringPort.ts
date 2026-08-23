import type { PositioningThesis, Signal, StrategicScoreResult } from '../../../types';
import type { ThesisScoreFn } from '../../../domain/thesisRoutingCore';

export interface WhyNowSnapshot {
  score: number;
  band: 'NOW' | 'SOON' | 'STALE';
  reason: string;
}

/**
 * Builds the injected score function with client-scoped context.
 * Must not encode strategic primary-thesis selection.
 */
export interface StrategicScoringPort {
  createScoreFn(clientId: string, signal: Signal): ThesisScoreFn;
  computeWhyNow(clientId: string, signal: Signal): WhyNowSnapshot;
  /** Full score for a known thesis (manual override / display snapshot). */
  scoreThesis(
    signal: Signal,
    thesis: PositioningThesis,
    clientId: string
  ): StrategicScoreResult;
}
