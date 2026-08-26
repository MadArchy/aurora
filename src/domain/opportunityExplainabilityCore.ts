/**
 * SPEC-007 Phase 1 — Explainability projections + reason codes (pure).
 * No chain-of-thought / private reasoning.
 */

import type { OpportunityCandidate } from './opportunityCandidateCore';
import type { MaterializedOpportunity } from './opportunityCore';
import type { MaterializeGateDecision } from './opportunityMaterializeGateCore';
import type { OpportunityScore } from './opportunityScoreCore';
import type { OpportunityDomainErrorCode } from './opportunityScoutErrors';

export type OpportunityReasonCode =
  | OpportunityDomainErrorCode
  | 'CREATE_OPPORTUNITY_AUTHORIZATION_ALLOW'
  | 'SCORE_COMPUTED'
  | 'CANDIDATE_RECOMMENDED'
  | 'TRANSITION_APPLIED'
  | 'LEGACY_MAPPING_LOSSLESS';

export interface OpportunityScoreExplainability {
  scoreId: string;
  candidateId: string;
  totalScore: number;
  band: string;
  scoringModelVersion: string;
  dimensions: Array<{
    key: string;
    rawInput: number;
    weight: number;
    contribution: number;
    reasonCode: string;
  }>;
  evidenceRefs: string[];
  riskFlags: string[];
  reasonCodes: OpportunityReasonCode[];
}

export function projectOpportunityScoreExplainability(
  score: OpportunityScore
): OpportunityScoreExplainability {
  return {
    scoreId: score.id,
    candidateId: score.candidateId,
    totalScore: score.totalScore,
    band: score.band,
    scoringModelVersion: score.scoringModelVersion,
    dimensions: score.dimensions.map((d) => ({
      key: d.key,
      rawInput: d.rawInput,
      weight: d.weight,
      contribution: d.contribution,
      reasonCode: d.reasonCode,
    })),
    evidenceRefs: [...score.evidenceRefs],
    riskFlags: [...score.riskFlags],
    reasonCodes: ['SCORE_COMPUTED'],
  };
}

export interface OpportunityCandidateExplainability {
  candidateId: string;
  version: number;
  status: string;
  title: string;
  whyNow: string;
  recommendedNextStep: string;
  riskFlags: string[];
  thesisEvaluations: Array<{
    thesisId: string;
    evaluationStatus: string;
    fitNotes: string;
    strategicScoreRef?: {
      scoringVersion: string;
      totalScore?: number;
      priorityBand?: string;
    };
  }>;
  score: OpportunityScoreExplainability | null;
  reasonCodes: OpportunityReasonCode[];
}

export function projectOpportunityCandidateExplainability(
  candidate: OpportunityCandidate
): OpportunityCandidateExplainability {
  return {
    candidateId: candidate.id,
    version: candidate.version,
    status: candidate.status,
    title: candidate.title,
    whyNow: candidate.whyNow,
    recommendedNextStep: candidate.recommendedNextStep,
    riskFlags: [...candidate.riskFlags],
    thesisEvaluations: candidate.thesisEvaluations.map((ev) => ({
      thesisId: ev.thesisId,
      evaluationStatus: ev.evaluationStatus,
      fitNotes: ev.fitNotes,
      strategicScoreRef: ev.strategicScoreRef
        ? { ...ev.strategicScoreRef }
        : undefined,
    })),
    score: candidate.latestScore
      ? projectOpportunityScoreExplainability(candidate.latestScore)
      : null,
    reasonCodes:
      candidate.status === 'RECOMMENDED' ? ['CANDIDATE_RECOMMENDED'] : [],
  };
}

export interface MaterializedOpportunityExplainability {
  opportunityId: string;
  version: number;
  status: string;
  thesisId: string;
  candidateId: string | null;
  strategicBriefId: string;
  strategicBriefVersion: number;
  strategicPlanId: string;
  strategicPlanVersion: number;
  planItemId: string;
  fitRationale: string;
  reasonCodes: OpportunityReasonCode[];
}

export function projectMaterializedOpportunityExplainability(
  opportunity: MaterializedOpportunity,
  extraReasons: OpportunityReasonCode[] = []
): MaterializedOpportunityExplainability {
  return {
    opportunityId: opportunity.id,
    version: opportunity.version,
    status: opportunity.status,
    thesisId: opportunity.thesisId,
    candidateId: opportunity.candidateId,
    strategicBriefId: opportunity.strategicBriefId,
    strategicBriefVersion: opportunity.strategicBriefVersion,
    strategicPlanId: opportunity.strategicPlanId,
    strategicPlanVersion: opportunity.strategicPlanVersion,
    planItemId: opportunity.planItemId,
    fitRationale: opportunity.fitRationale,
    reasonCodes: [...extraReasons],
  };
}

export function projectMaterializeGateExplainability(
  decision: MaterializeGateDecision
): MaterializeGateDecision {
  return { ...decision, reasons: [...decision.reasons] };
}
