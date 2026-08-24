/**
 * Cloud scoring — thin wrapper over canonical Domain core (SPEC-002 Phase 4).
 * No independent weights, thresholds, or formula duplication.
 */

import type { PositioningThesis, SourceQuality } from '../../../src/types';
import type { SignalSourceType } from '../../../src/types';
import {
  SCORING_VERSION,
  computeStrategicScoreMaterial,
  toStrategicScoreResult,
} from '../../../src/domain/scoringCore';
import type {
  OutputFormatRecommendation,
  PriorityBand,
  RecommendedAction,
  StrategicDisposition,
  StrategicScoreFactors,
  StrategicScorePenalties,
} from '../../../src/types';

export interface CloudScoreInput {
  title: string;
  snippet: string;
  sourceType: string;
  sourceQuality?: string;
  detectedAt?: string;
  domain?: string;
  thesisTitle?: string;
  targetAudience?: string;
  proofPointCount?: number;
  bilingualTerms?: string[];
  /** Explicit clock for parity tests — defaults to Date.now() at call site. */
  nowMs?: number;
}

export interface CloudScoreResult {
  totalScore: number;
  priorityBand: PriorityBand;
  recommendedAction: RecommendedAction;
  strategicRationale: string;
  scoringVersion: typeof SCORING_VERSION;
  recommendedDisposition: StrategicDisposition;
  recommendedOutputFormat: OutputFormatRecommendation;
  factors: StrategicScoreFactors;
  penalties: StrategicScorePenalties;
}

function minimalThesisFromCloud(input: CloudScoreInput): PositioningThesis {
  const proofCount = input.proofPointCount ?? 0;
  const proofPoints = Array.from({ length: proofCount }, (_, i) => `proof_${i + 1}`);
  const stamp = '1970-01-01T00:00:00.000Z';
  return {
    id: 'cloud-scoring-thesis',
    organizationId: 'cloud',
    clientId: 'cloud',
    title: input.thesisTitle ?? '',
    expertIdentity: input.thesisTitle ?? '',
    targetAudience: input.targetAudience ?? '',
    domain: input.domain ?? '',
    objective: '',
    proofPoints,
    voiceAndTone: '',
    complianceRules: '',
    status: 'ACTIVE',
    clientApprovalStatus: 'APPROVED',
    createdAt: stamp,
    createdBy: 'cloud',
    updatedAt: stamp,
    updatedBy: 'cloud',
  };
}

function mapSourceType(sourceType: string): SignalSourceType {
  switch (sourceType) {
    case 'REGULATORY':
      return 'REGULATORY';
    case 'ACADEMIC':
      return 'ACADEMIC';
    case 'VIDEO':
      return 'VIDEO';
    case 'SOCIAL':
      return 'SOCIAL';
    case 'NEWS_API':
      return 'NEWS_API';
    default:
      return 'RSS';
  }
}

function mapSourceQuality(quality?: string): SourceQuality | undefined {
  if (quality === 'HIGH' || quality === 'MEDIUM' || quality === 'LOW' || quality === 'UNASSESSED') {
    return quality;
  }
  return undefined;
}

/** Canonical cloud scorer — delegates to `computeStrategicScoreMaterial`. */
export function scoreSignalCloud(input: CloudScoreInput, explicitNowMs?: number): CloudScoreResult {
  const nowMs = explicitNowMs ?? input.nowMs ?? Date.now();
  const material = computeStrategicScoreMaterial({
    signal: {
      title: input.title,
      contentSnippet: input.snippet,
      targetDomain: undefined,
      sourceType: mapSourceType(input.sourceType),
      sourceQuality: mapSourceQuality(input.sourceQuality),
      detectedAt: input.detectedAt ?? new Date(nowMs).toISOString(),
    },
    thesis: minimalThesisFromCloud(input),
    context: { bilingualTerms: input.bilingualTerms },
    nowMs,
  });
  const result = toStrategicScoreResult(material, new Date(nowMs).toISOString());
  return {
    totalScore: result.totalScore,
    priorityBand: result.priorityBand,
    recommendedAction: result.recommendedAction,
    strategicRationale: result.strategicRationale,
    scoringVersion: SCORING_VERSION,
    recommendedDisposition: result.recommendedDisposition ?? 'NO_ACTION',
    recommendedOutputFormat: result.recommendedOutputFormat ?? 'NONE',
    factors: result.factors,
    penalties: result.penalties,
  };
}
