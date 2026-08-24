import {
  createRecomputeSignalScore,
  createScoreSignalAgainstRoutedContext,
} from '../../application/strategicScoring';
import { createDbStrategicSignalRoutingPorts } from '../../infrastructure/strategicSignalRouting/DbStrategicSignalRoutingAdapter';
import { dbService } from '../../services/db';

/** Wire SPEC-002 Application use cases — reuses SPEC-001 read/scoring ports. */
export function createStrategicScoringUseCases(db: typeof dbService = dbService) {
  const { signals, theses, scoring } = createDbStrategicSignalRoutingPorts(db);
  const deps = { signals, theses, scoring };
  return {
    scoreSignalAgainstRoutedContext: createScoreSignalAgainstRoutedContext(deps),
    recomputeSignalScore: createRecomputeSignalScore(deps),
  };
}
