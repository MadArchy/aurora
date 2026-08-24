import type {
  OutputFormatRecommendation,
  RecommendedAction,
  StrategicDisposition,
} from '../types';

export type { OutputFormatRecommendation, StrategicDisposition };

export interface StrategicRecommendationSplit {
  recommendedDisposition: StrategicDisposition;
  recommendedOutputFormat: OutputFormatRecommendation;
  /** Compatibility-only mirror of pre-SPEC-002 combined enum. */
  legacyRecommendedAction: RecommendedAction;
}

export interface DeriveRecommendationInput {
  finalScore: number;
  risk: number;
  evidenceGap: number;
  proofPointCount: number;
  blockedByLimit?: string;
}

/**
 * Baseline v1 ladder — preserves legacy `recommendedAction` semantics while
 * separating disposition from output format (SPEC-002 Phase 1).
 */
export function deriveStrategicRecommendation(
  input: DeriveRecommendationInput
): StrategicRecommendationSplit {
  const { finalScore, risk, evidenceGap, proofPointCount, blockedByLimit } = input;

  if (blockedByLimit || (risk >= 15 && finalScore < 70)) {
    return split('NO_ACTION', 'NONE', 'NO_ACTION');
  }
  if (evidenceGap >= 7 || proofPointCount === 0) {
    return split('RESEARCH_REQUIRED', 'NONE', 'RESEARCH_REQUIRED');
  }
  if (finalScore >= 85) {
    return split('OPPORTUNITY_CANDIDATE', 'NONE', 'CREATE_OPPORTUNITY');
  }
  if (finalScore >= 70) {
    return split('SAVE', 'VIDEO', 'VIDEO');
  }
  if (finalScore >= 50) {
    return split('SAVE', 'SHORT_POST', 'SHORT_POST');
  }
  if (finalScore >= 40) {
    return split('MONITOR', 'NONE', 'MONITOR');
  }
  return split('NO_ACTION', 'NONE', 'NO_ACTION');
}

function split(
  disposition: StrategicDisposition,
  format: OutputFormatRecommendation,
  legacy: RecommendedAction
): StrategicRecommendationSplit {
  return {
    recommendedDisposition: disposition,
    recommendedOutputFormat: format,
    legacyRecommendedAction: legacy,
  };
}

/** Map canonical split back to legacy combined action (Phase 1 compatibility). */
export function toLegacyRecommendedAction(
  disposition: StrategicDisposition,
  format: OutputFormatRecommendation
): RecommendedAction {
  if (disposition === 'OPPORTUNITY_CANDIDATE') return 'CREATE_OPPORTUNITY';
  if (format === 'VIDEO') return 'VIDEO';
  if (format === 'SHORT_POST') return 'SHORT_POST';
  if (format === 'ARTICLE') return 'ARTICLE';
  if (format === 'LINKEDIN_POST') return 'SHORT_POST';
  if (disposition === 'RESEARCH_REQUIRED') return 'RESEARCH_REQUIRED';
  if (disposition === 'MONITOR') return 'MONITOR';
  if (disposition === 'NO_ACTION' || disposition === 'LOW_PRIORITY') return 'NO_ACTION';
  return 'SAVE';
}

/** Documented mapping table for migration matrix (T-002-106). */
export const LEGACY_RECOMMENDED_ACTION_MAP: Readonly<
  Record<RecommendedAction, StrategicRecommendationSplit>
> = {
  NO_ACTION: split('NO_ACTION', 'NONE', 'NO_ACTION'),
  MONITOR: split('MONITOR', 'NONE', 'MONITOR'),
  SAVE: split('SAVE', 'NONE', 'SAVE'),
  RESEARCH_REQUIRED: split('RESEARCH_REQUIRED', 'NONE', 'RESEARCH_REQUIRED'),
  CREATE_TOPIC: split('SAVE', 'NONE', 'CREATE_TOPIC'),
  CREATE_OPPORTUNITY: split('OPPORTUNITY_CANDIDATE', 'NONE', 'CREATE_OPPORTUNITY'),
  SHORT_POST: split('SAVE', 'SHORT_POST', 'SHORT_POST'),
  ARTICLE: split('SAVE', 'ARTICLE', 'ARTICLE'),
  VIDEO: split('SAVE', 'VIDEO', 'VIDEO'),
  TASK: split('SAVE', 'NONE', 'TASK'),
};
