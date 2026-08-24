export { StrategicScoringError } from './errors';
export type { StrategicScoringErrorCode } from './errors';

export { createScoreSignalAgainstRoutedContext } from './ScoreSignalAgainstRoutedContext';
export type {
  ScoreSignalAgainstRoutedContextDeps,
  ScoreSignalAgainstRoutedContextInput,
} from './ScoreSignalAgainstRoutedContext';

export { createRecomputeSignalScore } from './RecomputeSignalScore';
export type { RecomputeSignalScoreDeps, RecomputeSignalScoreInput } from './RecomputeSignalScore';

export type { GovernedScoreResult } from './governedScoreResult';
export { resolveGovernedThesisForScoring } from './routingGovernance';
export type { GovernedThesisContext } from './routingGovernance';

export type { StrategicScoreWritePort, PersistGovernedScoreParams } from './ports/StrategicScoreWritePort';
export type {
  SignalReadPort,
  ThesisQueryPort,
  StrategicScoringPort,
} from './ports/GovernedScoringPorts';
