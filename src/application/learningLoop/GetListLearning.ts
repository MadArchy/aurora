/**
 * SPEC-008 Phase 2 — GetLearningMetrics / ListStrategicRecommendations (T-008-207).
 */

import { projectLearningAssessmentExplainability } from '../../domain/learningExplainabilityCore';
import { projectStrategicRecommendationExplainability } from '../../domain/learningExplainabilityCore';
import type { RecommendationStatus } from '../../domain/recommendationLifecycleCore';
import { LearningApplicationError } from './errors';
import { loadAuthoritativeEvidence, loadAuthoritativeRecommendation } from './loadAggregates';
import type { LearningEvidenceRepository } from './ports/LearningEvidenceRepository';
import type { StrategicRecommendationRepository } from './ports/StrategicRecommendationRepository';
import {
  assertNoTenantSpoof,
  assertTrustedLearningActor,
  ignoreCallerActorClaims,
  trustedTenant,
  type TrustedLearningActorContext,
} from './trustedContext';
import { createBuildLearningAssessment } from './BuildLearningEvidence';

export interface GetLearningMetricsInput {
  trusted: TrustedLearningActorContext;
  evidenceId: string;
  assessmentId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedAssessment?: unknown;
  actorType?: string;
  role?: string;
}

export interface ListStrategicRecommendationsInput {
  trusted: TrustedLearningActorContext;
  status?: RecommendationStatus;
  thesisId?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  actorType?: string;
  role?: string;
}

export interface GetRecommendationInput {
  trusted: TrustedLearningActorContext;
  recommendationId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedRecommendation?: unknown;
  actorType?: string;
  role?: string;
}

export function createGetLearningMetrics(deps: { evidence: LearningEvidenceRepository }) {
  const buildAssessment = createBuildLearningAssessment(deps);

  return function getLearningMetrics(input: GetLearningMetricsInput) {
    assertTrustedLearningActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedAssessment;

    loadAuthoritativeEvidence(deps.evidence, input.trusted, input.evidenceId);

    const cached = deps.evidence.getAssessmentByEvidenceId?.(
      input.evidenceId,
      trustedTenant(input.trusted)
    );
    if (cached) {
      return {
        assessment: cached,
        explainability: projectLearningAssessmentExplainability(cached),
      };
    }

    return buildAssessment({
      trusted: input.trusted,
      assessmentId: input.assessmentId,
      evidenceId: input.evidenceId,
      persist: false,
    });
  };
}

export function createListStrategicRecommendations(deps: {
  recommendations: StrategicRecommendationRepository;
}) {
  return function listStrategicRecommendations(input: ListStrategicRecommendationsInput) {
    assertTrustedLearningActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);

    const items = deps.recommendations.list(trustedTenant(input.trusted), {
      status: input.status,
      thesisId: input.thesisId,
    });

    return items.map((r) => ({
      recommendation: r,
      explainability: projectStrategicRecommendationExplainability(r),
    }));
  };
}

export function createGetStrategicRecommendation(deps: {
  recommendations: StrategicRecommendationRepository;
}) {
  return function getStrategicRecommendation(input: GetRecommendationInput) {
    assertTrustedLearningActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedRecommendation;

    const recommendation = loadAuthoritativeRecommendation(
      deps.recommendations,
      input.trusted,
      input.recommendationId
    );

    return {
      recommendation,
      explainability: projectStrategicRecommendationExplainability(recommendation),
    };
  };
}

/** Explicit: history must never reconstruct current authority. */
export function denyHistoryAsCurrentAuthority(): never {
  throw new LearningApplicationError(
    'MALFORMED_DOMAIN_STATE',
    'History is AUDIT_ONLY and cannot establish current Recommendation authority.'
  );
}

/** Explicit: decision history must never reconstruct current authority. */
export function denyDecisionHistoryAsCurrentAuthority(): never {
  throw new LearningApplicationError(
    'MALFORMED_DOMAIN_STATE',
    'Decision history is AUDIT_ONLY and cannot establish current Recommendation authority.'
  );
}
