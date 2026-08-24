import {
  createScoreSignalAgainstRoutedContext,
  type ScoreSignalAgainstRoutedContextDeps,
  type ScoreSignalAgainstRoutedContextInput,
} from './ScoreSignalAgainstRoutedContext';
import type { GovernedScoreResult } from './governedScoreResult';

export type RecomputeSignalScoreInput = ScoreSignalAgainstRoutedContextInput;
export type RecomputeSignalScoreDeps = ScoreSignalAgainstRoutedContextDeps;

/**
 * Re-score using current authoritative routing context.
 * Does not reroute, choose another thesis, or trigger terminal disposition.
 */
export function createRecomputeSignalScore(deps: RecomputeSignalScoreDeps) {
  const scoreAgainstRouted = createScoreSignalAgainstRoutedContext(deps);
  return function recomputeSignalScore(input: RecomputeSignalScoreInput): GovernedScoreResult {
    return scoreAgainstRouted(input);
  };
}
