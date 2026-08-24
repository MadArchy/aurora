export { StrategicRoutingError } from './errors';
export type { StrategicRoutingErrorCode } from './errors';

export {
  createScoreAndRouteSignal,
} from './ScoreAndRouteSignal';
export type {
  ScoreAndRouteSignalDeps,
  ScoreAndRouteSignalInput,
  ScoreAndRouteSignalResult,
} from './ScoreAndRouteSignal';

export { createOverrideSignalThesis } from './OverrideSignalThesis';
export type {
  OverrideSignalThesisDeps,
  OverrideSignalThesisInput,
  OverrideSignalThesisResult,
} from './OverrideSignalThesis';

export type { ThesisQueryPort } from './ports/ThesisQueryPort';
export type { SignalReadPort } from './ports/SignalReadPort';
export type { SignalWritePort, PersistStrategicRoutingParams } from './ports/SignalWritePort';
export type { RoutingHistoryPort } from './ports/RoutingHistoryPort';
export type { StrategicScoringPort, WhyNowSnapshot } from './ports/StrategicScoringPort';
export { previousMaterialFromSignal } from './previousMaterial';
export { toPersistedRoutingDecision } from './persistedRoutingDecision';
