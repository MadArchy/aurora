import type { StrategicScoreResult } from '../../../types';

/**
 * Neutral governed score persistence — Phase 2 contract only.
 * Physical storage/history belongs Phase 3; fakes used in tests.
 *
 * MUST NOT perform terminal DISCARD or routing mutation.
 */
export interface PersistGovernedScoreParams {
  signalId: string;
  clientId: string;
  organizationId: string;
  scoreResult: StrategicScoreResult;
}

export interface StrategicScoreWritePort {
  persistGovernedScore(params: PersistGovernedScoreParams): void;
}
