import type {
  ScoreHistoryPort,
  SignalReadPort,
  StrategicScoringPort,
  StrategicScoreWritePort,
  ThesisQueryPort,
} from '../../application/strategicScoring';
import type { SignalScoreHistoryEntry } from '../../domain/scoreHistoryCore';
import { compatibilityRecommendedAction } from '../../domain/scoreHistoryCore';
import { buildScoreBreakdown } from '../../domain/scoreExplainCore';
import { dbService } from '../../services/db';
import type { StrategicScoreResult } from '../../types';
import { createDbStrategicSignalRoutingPorts } from '../strategicSignalRouting/DbStrategicSignalRoutingAdapter';

type DbFacade = typeof dbService;

/**
 * SPEC-002 Phase 3 — governed score persistence adapter.
 * Score-only writes: no routing mutation, no auto-DISCARD.
 */
export function createDbStrategicScoringPorts(db: DbFacade = dbService): {
  signals: SignalReadPort;
  theses: ThesisQueryPort;
  scoring: StrategicScoringPort;
  writer: StrategicScoreWritePort;
  history: ScoreHistoryPort;
} {
  const routing = createDbStrategicSignalRoutingPorts(db);

  const writer: StrategicScoreWritePort = {
    persistGovernedScore(params) {
      db.applyGovernedScoreToSignal(params.signalId, params.scoreResult, {
        clientId: params.clientId,
        organizationId: params.organizationId,
        routingContext: params.routingContext,
        changedAt: params.changedAt,
        historyEntry: params.historyEntry,
      });
    },
  };

  const history: ScoreHistoryPort = {
    listHistoryForSignal: (signalId) => db.getSignalScoreHistory(signalId),
  };

  return {
    signals: routing.signals,
    theses: routing.theses,
    scoring: routing.scoring,
    writer,
    history,
  };
}

export function projectScoreOntoSignalFields(
  score: StrategicScoreResult,
  routedThesisId: string,
  changedAt: string
): Pick<
  import('../../types').Signal,
  | 'relevanceScore'
  | 'priorityBand'
  | 'recommendedAction'
  | 'scoreRationale'
  | 'scoreBreakdown'
  | 'scoringVersion'
  | 'recommendedDisposition'
  | 'recommendedOutputFormat'
  | 'scoredAt'
  | 'scoreRoutedThesisId'
  | 'scoreFactors'
  | 'scorePenalties'
> {
  const disposition =
    score.recommendedDisposition ??
    (score.recommendedAction === 'CREATE_OPPORTUNITY'
      ? 'OPPORTUNITY_CANDIDATE'
      : score.recommendedAction === 'RESEARCH_REQUIRED'
        ? 'RESEARCH_REQUIRED'
        : score.recommendedAction === 'MONITOR'
          ? 'MONITOR'
          : score.recommendedAction === 'NO_ACTION'
            ? 'NO_ACTION'
            : 'SAVE');
  const format =
    score.recommendedOutputFormat ??
    (score.recommendedAction === 'VIDEO'
      ? 'VIDEO'
      : score.recommendedAction === 'SHORT_POST'
        ? 'SHORT_POST'
        : score.recommendedAction === 'ARTICLE'
          ? 'ARTICLE'
          : 'NONE');

  return {
    relevanceScore: score.totalScore,
    priorityBand: score.priorityBand,
    recommendedAction: compatibilityRecommendedAction(disposition, format),
    scoreRationale: score.strategicRationale,
    scoreBreakdown: buildScoreBreakdown(score),
    scoringVersion: score.scoringVersion ?? 'scoring-v1',
    recommendedDisposition: disposition,
    recommendedOutputFormat: format,
    scoredAt: changedAt,
    scoreRoutedThesisId: routedThesisId,
    scoreFactors: { ...score.factors },
    scorePenalties: { ...score.penalties },
  };
}

export function validateScoreHistoryEntry(
  entry: SignalScoreHistoryEntry,
  signalId: string,
  clientId: string,
  organizationId: string
): void {
  if (entry.signalId !== signalId) {
    throw new Error('Score history signalId mismatch');
  }
  if (entry.clientId !== clientId) {
    throw new Error('Score history clientId mismatch');
  }
  if (entry.organizationId !== organizationId) {
    throw new Error('Score history organizationId mismatch');
  }
}
