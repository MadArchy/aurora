import {
  PositioningThesis,
  Signal,
  StrategicScoreResult,
} from '../types';
import {
  computeStrategicScoreMaterial,
  toStrategicScoreResult,
  type StrategicScoringContextInput,
} from '../domain/scoringCore';

export { buildScoreBreakdown, reconstructBaseScore100, totalPenaltyPoints } from '../domain/scoreExplainCore';
export type { ScoreBreakdownView, ScoreFactorRow, ScorePenaltyRow } from '../domain/scoreExplainCore';
export type { StrategicScoringContextInput as ScoringContext } from '../domain/scoringCore';

/**
 * Compatibility wrapper — delegates to canonical Domain scoring core (SPEC-002).
 * Preserves baseline v1 behavior; injects wall-clock for staleness + calculatedAt.
 */
export function calculateStrategicScore(
  signal: Signal,
  thesis: PositioningThesis,
  context: StrategicScoringContextInput = {}
): StrategicScoreResult {
  const material = computeStrategicScoreMaterial({
    signal,
    thesis,
    context,
    nowMs: Date.now(),
  });
  return toStrategicScoreResult(material, new Date().toISOString());
}
