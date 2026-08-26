/**
 * SPEC-008 Phase 1 — Explainability projections + reason codes (pure).
 * No chain-of-thought / private reasoning.
 */

import type { LearningAssessment, LearningEvidence } from './learningEvidenceCore';
import type { LearningObservation } from './learningObservationCore';
import type { LearningDomainErrorCode } from './learningLoopErrors';
import type { StrategicRecommendation } from './strategicRecommendationCore';
import { thesisScopeFingerprint } from './learningThesisScopeCore';

export type LearningReasonCode =
  | LearningDomainErrorCode
  | 'OBSERVATION_REGISTERED'
  | 'EVIDENCE_BUILT'
  | 'ASSESSMENT_PROJECTED'
  | 'RECOMMENDATION_PROPOSED'
  | 'HUMAN_APPROVAL_RECORDED'
  | 'APPLY_DISPATCHED'
  | 'TARGET_SPEC_AUTHORITY_PRESERVED';

export interface LearningObservationExplainability {
  observationId: string;
  sourceKind: string;
  sourceRef: { sourceSpec: string; sourceId: string; sourceVersion?: string };
  observationKind: string;
  thesisScope: string;
  status: string;
  reasonCodes: LearningReasonCode[];
}

export function projectLearningObservationExplainability(
  observation: LearningObservation
): LearningObservationExplainability {
  return {
    observationId: observation.observationId,
    sourceKind: observation.sourceKind,
    sourceRef: { ...observation.sourceRef },
    observationKind: observation.observationKind,
    thesisScope: thesisScopeFingerprint(observation.thesisScope),
    status: observation.status,
    reasonCodes: ['OBSERVATION_REGISTERED'],
  };
}

export interface LearningEvidenceExplainability {
  evidenceId: string;
  observationIds: string[];
  metrics: Array<{ key: string; label: string; value: number }>;
  patterns: Array<{ reasonCode: string; description: string }>;
  thesisScope: string;
  summary: string;
  reasonCodes: LearningReasonCode[];
}

export function projectLearningEvidenceExplainability(
  evidence: LearningEvidence
): LearningEvidenceExplainability {
  return {
    evidenceId: evidence.evidenceId,
    observationIds: [...evidence.observationIds],
    metrics: evidence.metrics.map((m) => ({
      key: m.key,
      label: m.label,
      value: m.value,
    })),
    patterns: (evidence.patterns ?? []).map((p) => ({
      reasonCode: p.reasonCode,
      description: p.description,
    })),
    thesisScope: thesisScopeFingerprint(evidence.thesisScope),
    summary: evidence.summary,
    reasonCodes: ['EVIDENCE_BUILT'],
  };
}

export interface LearningAssessmentExplainability {
  assessmentId: string;
  evidenceId: string;
  thesisScope: string;
  signalsUseful: number;
  signalsNotUseful: number;
  summary: string;
  reasonCodes: LearningReasonCode[];
}

export function projectLearningAssessmentExplainability(
  assessment: LearningAssessment
): LearningAssessmentExplainability {
  return {
    assessmentId: assessment.assessmentId,
    evidenceId: assessment.evidenceId,
    thesisScope: thesisScopeFingerprint(assessment.thesisScope),
    signalsUseful: assessment.signalsUseful,
    signalsNotUseful: assessment.signalsNotUseful,
    summary: assessment.summary,
    reasonCodes: ['ASSESSMENT_PROJECTED'],
  };
}

export interface StrategicRecommendationExplainability {
  recommendationId: string;
  version: number;
  status: string;
  recommendationType: string;
  targetAuthority: { specId: string; domain: string };
  thesisScope: string;
  sourceObservationIds: string[];
  learningEvidenceId: string;
  confidence: string;
  risks: string[];
  rationale: string;
  expectedImpactSummary: string;
  proposedChangeKind: string;
  reasonCodes: LearningReasonCode[];
}

export function projectStrategicRecommendationExplainability(
  recommendation: StrategicRecommendation
): StrategicRecommendationExplainability {
  return {
    recommendationId: recommendation.recommendationId,
    version: recommendation.version,
    status: recommendation.status,
    recommendationType: recommendation.recommendationType,
    targetAuthority: { ...recommendation.targetAuthority },
    thesisScope: thesisScopeFingerprint(recommendation.thesisScope),
    sourceObservationIds: [...recommendation.sourceObservationIds],
    learningEvidenceId: recommendation.learningEvidenceId,
    confidence: recommendation.confidence,
    risks: [...recommendation.risks],
    rationale: recommendation.rationale,
    expectedImpactSummary: recommendation.expectedImpact.summary,
    proposedChangeKind: recommendation.proposedChange.changeKind,
    reasonCodes: ['RECOMMENDATION_PROPOSED', 'TARGET_SPEC_AUTHORITY_PRESERVED'],
  };
}
