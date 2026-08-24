import type { StrategicScoreResult } from '../../../types';
import type { SignalScoreHistoryEntry } from '../../../domain/scoreHistoryCore';
import type { ScoreRoutingContextRef } from '../../../domain/scoreHistoryCore';

/**
 * Neutral governed score persistence.
 * Physical storage is infrastructure-owned.
 *
 * MUST NOT perform terminal DISCARD or routing mutation.
 */
export interface PersistGovernedScoreParams {
  signalId: string;
  clientId: string;
  organizationId: string;
  scoreResult: StrategicScoreResult;
  routingContext: ScoreRoutingContextRef;
  changedAt: string;
  historyEntry?: SignalScoreHistoryEntry;
}

export interface StrategicScoreWritePort {
  persistGovernedScore(params: PersistGovernedScoreParams): void;
}
