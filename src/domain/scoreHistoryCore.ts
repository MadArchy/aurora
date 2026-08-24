import type {
  OutputFormatRecommendation,
  PriorityBand,
  StrategicDisposition,
  StrategicScoreFactors,
  StrategicScorePenalties,
  StrategicScoreResult,
  Signal,
} from '../types';
import { toLegacyRecommendedAction } from './dispositionCore';

/** Neutral actor for governed SYSTEM score persistence. */
export const SCORE_SYSTEM_ACTOR_ID = 'SYSTEM' as const;

/** Routing context identity preserved with each score snapshot. */
export interface ScoreRoutingContextRef {
  routingState: 'CLEAR';
  routedThesisId: string;
  routingAlgorithmVersion?: string;
}

/**
 * Material snapshot for score history comparison.
 * scoredAt / calculatedAt are intentionally excluded from materiality.
 */
export interface ScoreHistoryMaterialSnapshot {
  totalScore: number;
  priorityBand: PriorityBand;
  recommendedDisposition: StrategicDisposition;
  recommendedOutputFormat: OutputFormatRecommendation;
  scoringVersion: string;
  factors: StrategicScoreFactors;
  penalties: StrategicScorePenalties;
  routingContext: ScoreRoutingContextRef;
}

/**
 * Bounded score history entry — storage-neutral Domain contract.
 * Forbidden: raw AI output, API keys, Authorization headers, full Signal copies.
 */
export interface SignalScoreHistoryEntry {
  id: string;
  organizationId: string;
  clientId: string;
  signalId: string;
  previous: ScoreHistoryMaterialSnapshot;
  next: ScoreHistoryMaterialSnapshot;
  actorId: string;
  changedAt: string;
  rationale?: string;
}

function dispositionFromSignal(signal: Signal): StrategicDisposition {
  if (signal.recommendedDisposition) return signal.recommendedDisposition;
  const action = signal.recommendedAction;
  if (action === 'CREATE_OPPORTUNITY') return 'OPPORTUNITY_CANDIDATE';
  if (action === 'RESEARCH_REQUIRED') return 'RESEARCH_REQUIRED';
  if (action === 'MONITOR') return 'MONITOR';
  if (action === 'NO_ACTION') return 'NO_ACTION';
  if (action === 'VIDEO' || action === 'SHORT_POST' || action === 'ARTICLE') return 'SAVE';
  return 'SAVE';
}

function formatFromSignal(signal: Signal): OutputFormatRecommendation {
  if (signal.recommendedOutputFormat) return signal.recommendedOutputFormat;
  const action = signal.recommendedAction;
  if (action === 'VIDEO') return 'VIDEO';
  if (action === 'SHORT_POST') return 'SHORT_POST';
  if (action === 'ARTICLE') return 'ARTICLE';
  return 'NONE';
}

const ZERO_FACTORS: StrategicScoreFactors = {
  thesisMatch: 0,
  audienceMatch: 0,
  timeliness: 0,
  authorityFit: 0,
  differentiation: 0,
  strategicPotential: 0,
  commercialPotential: 0,
  sourceQuality: 0,
};

const ZERO_PENALTIES: StrategicScorePenalties = {
  evidenceGap: 0,
  risk: 0,
  staleness: 0,
  conflict: 0,
};

function factorsEqual(a: StrategicScoreFactors, b: StrategicScoreFactors): boolean {
  const keys = Object.keys(a) as Array<keyof StrategicScoreFactors>;
  return keys.every((k) => Math.abs(a[k] - b[k]) < 0.0001);
}

function penaltiesEqual(a: StrategicScorePenalties, b: StrategicScorePenalties): boolean {
  const keys = Object.keys(a) as Array<keyof StrategicScorePenalties>;
  return keys.every((k) => a[k] === b[k]);
}

export function toScoreHistorySnapshotFromResult(
  score: StrategicScoreResult,
  routingContext: ScoreRoutingContextRef
): ScoreHistoryMaterialSnapshot {
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
    totalScore: score.totalScore,
    priorityBand: score.priorityBand,
    recommendedDisposition: disposition,
    recommendedOutputFormat: format,
    scoringVersion: score.scoringVersion ?? 'scoring-v1',
    factors: { ...score.factors },
    penalties: { ...score.penalties },
    routingContext,
  };
}

/** Read prior canonical score state from Signal projection (null = first assignment). */
export function toScoreHistorySnapshotFromSignal(
  signal: Signal,
  routedThesisId: string
): ScoreHistoryMaterialSnapshot | null {
  if (signal.relevanceScore === undefined && signal.scoringVersion === undefined) {
    return null;
  }

  const routingContext: ScoreRoutingContextRef = {
    routingState: 'CLEAR',
    routedThesisId: signal.scoreRoutedThesisId ?? routedThesisId,
    routingAlgorithmVersion: signal.routingDecision?.algorithmVersion,
  };

  return {
    totalScore: signal.relevanceScore ?? 0,
    priorityBand: signal.priorityBand ?? 'LOW',
    recommendedDisposition: dispositionFromSignal(signal),
    recommendedOutputFormat: formatFromSignal(signal),
    scoringVersion: signal.scoringVersion ?? 'scoring-v1',
    factors: signal.scoreFactors ? { ...signal.scoreFactors } : { ...ZERO_FACTORS },
    penalties: signal.scorePenalties ? { ...signal.scorePenalties } : { ...ZERO_PENALTIES },
    routingContext,
  };
}

/**
 * Material change policy (SPEC-002 Phase 3):
 * totalScore, priorityBand, disposition, output format, scoringVersion,
 * factor/penalty composition.
 * Timestamp-only changes are NOT material.
 * First assignment (no previous): false — history begins at first transition.
 */
export function isMaterialScoreChange(
  previous: ScoreHistoryMaterialSnapshot | null | undefined,
  next: ScoreHistoryMaterialSnapshot
): boolean {
  if (!previous) return false;
  if (previous.totalScore !== next.totalScore) return true;
  if (previous.priorityBand !== next.priorityBand) return true;
  if (previous.recommendedDisposition !== next.recommendedDisposition) return true;
  if (previous.recommendedOutputFormat !== next.recommendedOutputFormat) return true;
  if (previous.scoringVersion !== next.scoringVersion) return true;
  if (!factorsEqual(previous.factors, next.factors)) return true;
  if (!penaltiesEqual(previous.penalties, next.penalties)) return true;
  return false;
}

export function createScoreHistoryEntry(params: {
  organizationId: string;
  clientId: string;
  signalId: string;
  previous: ScoreHistoryMaterialSnapshot;
  next: ScoreHistoryMaterialSnapshot;
  actorId: string;
  changedAt: string;
  rationale?: string;
}): SignalScoreHistoryEntry {
  const id = `sh_${params.signalId}_${params.changedAt.replace(/[:.]/g, '')}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  return {
    id,
    organizationId: params.organizationId,
    clientId: params.clientId,
    signalId: params.signalId,
    previous: params.previous,
    next: params.next,
    actorId: params.actorId,
    changedAt: params.changedAt,
    rationale: params.rationale,
  };
}

/** Compatibility projection for legacy consumers — not canonical authority. */
export function compatibilityRecommendedAction(
  disposition: StrategicDisposition,
  format: OutputFormatRecommendation
): StrategicScoreResult['recommendedAction'] {
  return toLegacyRecommendedAction(disposition, format);
}
