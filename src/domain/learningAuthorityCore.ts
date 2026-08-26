/**
 * SPEC-008 Phase 1 — Authority invariants (pure).
 * Learning ≠ mutation. Recommendation ≠ approval. Target-SPEC authority preserved.
 */

import { lrnFail, lrnOk, type LearningDomainResult } from './learningLoopErrors';
import type { LearningAssessment, LearningEvidence } from './learningEvidenceCore';
import type { LearningObservation } from './learningObservationCore';
import {
  assertCanApplyRecommendation,
  assertRecommendationTransition,
  type RecommendationActorKind,
  type RecommendationStatus,
} from './recommendationLifecycleCore';
import type { StrategicRecommendation } from './strategicRecommendationCore';
import type { RecommendationConfidence } from './strategicRecommendationCore';

/**
 * Observations/evidence/assessment cannot by themselves produce APPLIED state.
 */
export function assertLearningStagesCannotAutoApply(
  observation: LearningObservation,
  evidence: LearningEvidence,
  assessment: LearningAssessment
): LearningDomainResult<void> {
  if (observation.status === 'APPLIED' as never) {
    return lrnFail('AUTO_MUTATION_FORBIDDEN', 'observation cannot be APPLIED');
  }
  if ((evidence as { status?: string }).status === 'APPLIED') {
    return lrnFail('AUTO_MUTATION_FORBIDDEN', 'evidence cannot be APPLIED');
  }
  if ((assessment as { status?: string }).status === 'APPLIED') {
    return lrnFail('AUTO_MUTATION_FORBIDDEN', 'assessment cannot be APPLIED');
  }
  return lrnOk(undefined);
}

/** Recommendation cannot become APPLIED without prior APPROVED status. */
export function assertRecommendationApplyGate(
  fromStatus: RecommendationStatus,
  toStatus: RecommendationStatus,
  actorKind: RecommendationActorKind
): LearningDomainResult<void> {
  if (toStatus === 'APPLIED') {
    const approved = assertCanApplyRecommendation(fromStatus);
    if (!approved.ok) return approved;
  }
  if (toStatus === 'APPLIED' && fromStatus !== 'APPROVED') {
    return lrnFail('APPLY_BEFORE_APPROVAL', 'cannot apply before APPROVED');
  }
  return assertRecommendationTransition(fromStatus, toStatus, actorKind);
}

/** SPEC-008 does not mutate target SPEC storage — apply is dispatch-only semantics. */
export function assertTargetSpecAuthorityPreserved(
  recommendation: StrategicRecommendation
): LearningDomainResult<void> {
  if (!recommendation.targetAuthority.specId.trim()) {
    return lrnFail('TARGET_MISMATCH', 'targetAuthority.specId is required');
  }
  return lrnOk(undefined);
}

/** Confidence cannot shortcut human approval. */
export function assertConfidenceNotApprovalAuthority(input: {
  confidence: RecommendationConfidence;
  attemptingApprovalWithoutHuman: boolean;
}): LearningDomainResult<void> {
  if (input.attemptingApprovalWithoutHuman) {
    return lrnFail(
      'CONFIDENCE_NOT_AUTHORITY',
      'confidence cannot establish approval authority without trusted human transition'
    );
  }
  return lrnOk(undefined);
}

/** Software/UI/AI cannot impersonate human approval. */
export function assertHumanOnlyApproval(
  actorKind: RecommendationActorKind,
  to: RecommendationStatus
): LearningDomainResult<void> {
  if (to === 'APPROVED' || to === 'REJECTED') {
    if (actorKind !== 'HUMAN') {
      return lrnFail(
        'HUMAN_APPROVAL_REQUIRED',
        `status ${to} requires trusted HUMAN actor (got ${actorKind})`
      );
    }
  }
  return lrnOk(undefined);
}

/** Domain has zero SPEC-002 scoring mutation authority. */
export function assertNoStrategicScoreMutationAuthority(): LearningDomainResult<void> {
  return lrnOk(undefined);
}

/** Domain has zero SPEC-001 routing mutation authority. */
export function assertNoRoutingMutationAuthority(): LearningDomainResult<void> {
  return lrnOk(undefined);
}

/** Domain has zero SPEC-007 Opportunity lifecycle authority. */
export function assertNoOpportunityLifecycleAuthority(): LearningDomainResult<void> {
  return lrnOk(undefined);
}

export function transitionStrategicRecommendationStatus(input: {
  recommendation: StrategicRecommendation;
  to: RecommendationStatus;
  actorKind: RecommendationActorKind;
  updatedAt: string;
}): LearningDomainResult<StrategicRecommendation> {
  const human = assertHumanOnlyApproval(input.actorKind, input.to);
  if (!human.ok) return human;

  const transition = assertRecommendationTransition(
    input.recommendation.status,
    input.to,
    input.actorKind
  );
  if (!transition.ok) return transition;

  return lrnOk({
    ...input.recommendation,
    status: input.to,
    updatedAt: input.updatedAt,
    approvedBy:
      input.to === 'APPROVED' && input.actorKind === 'HUMAN'
        ? input.recommendation.approvedBy
        : input.recommendation.approvedBy,
    appliedBy: input.to === 'APPLIED' ? input.recommendation.appliedBy : input.recommendation.appliedBy,
  });
}
