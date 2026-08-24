import {
  createRecomputeSignalScore,
  createScoreSignalAgainstRoutedContext,
} from '../../application/strategicScoring';
import { createDbStrategicScoringPorts } from '../../infrastructure/strategicScoring/DbStrategicScoringAdapter';
import { dbService } from '../../services/db';

/** Wire SPEC-002 Application use cases with governed score persistence. */
export function createStrategicScoringUseCases(db: typeof dbService = dbService) {
  const ports = createDbStrategicScoringPorts(db);
  const deps = {
    signals: ports.signals,
    theses: ports.theses,
    scoring: ports.scoring,
    writer: ports.writer,
  };
  return {
    scoreSignalAgainstRoutedContext: createScoreSignalAgainstRoutedContext(deps),
    recomputeSignalScore: createRecomputeSignalScore(deps),
    history: ports.history,
  };
}
