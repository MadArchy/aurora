/**
 * SPEC-008 Phase 2 — ReviewStrategicRecommendation (T-008-204).
 */

import { transitionStrategicRecommendationStatus } from '../../domain/learningAuthorityCore';
import {
  createLearningHistoryRecord,
  recommendationMaterialFingerprint,
} from '../../domain/learningMaterialityCore';
import { projectStrategicRecommendationExplainability } from '../../domain/learningExplainabilityCore';
import { commitGovernedLearningWriteUnit } from './commitWriteUnit';
import { loadAuthoritativeRecommendation } from './loadAggregates';
import { unwrapDomain } from './mapDomainError';
import type { LearningHistoryPort } from './ports/LearningHistoryPort';
import type { StrategicRecommendationRepository } from './ports/StrategicRecommendationRepository';
import {
  assertNoTenantSpoof,
  assertTrustedLearningActor,
  ignoreCallerActorClaims,
  resolveTrustedLearningActorKind,
  trustedTenant,
  type TrustedLearningActorContext,
} from './trustedContext';

export interface ReviewStrategicRecommendationInput {
  trusted: TrustedLearningActorContext;
  recommendationId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedRecommendation?: unknown;
  forgedStatus?: string;
  actorType?: string;
  role?: string;
  persist?: boolean;
}

export interface ReviewStrategicRecommendationDeps {
  recommendations: StrategicRecommendationRepository;
  history: LearningHistoryPort;
}

export function createReviewStrategicRecommendation(deps: ReviewStrategicRecommendationDeps) {
  return function reviewStrategicRecommendation(input: ReviewStrategicRecommendationInput) {
    assertTrustedLearningActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedRecommendation;
    void input.forgedStatus;

    const actorKind = resolveTrustedLearningActorKind(input.trusted, 'review');
    const tenant = trustedTenant(input.trusted);

    const current = loadAuthoritativeRecommendation(
      deps.recommendations,
      input.trusted,
      input.recommendationId
    );

    const recommendation = unwrapDomain(
      transitionStrategicRecommendationStatus({
        recommendation: current,
        to: 'UNDER_REVIEW',
        actorKind,
        updatedAt: input.trusted.now,
      })
    );

    const withReviewer = {
      ...recommendation,
      reviewedBy: input.trusted.actorId,
    };

    const history = createLearningHistoryRecord({
      kind: 'RECOMMENDATION_TRANSITION',
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      aggregateKind: 'RECOMMENDATION',
      aggregateId: withReviewer.recommendationId,
      aggregateVersion: withReviewer.version,
      actorKind,
      reasonCodes: ['RECOMMENDATION_TRANSITION'],
      materialFingerprint: recommendationMaterialFingerprint(withReviewer),
      occurredAt: input.trusted.now,
    });

    let writeUnitCommitted = false;
    if (input.persist !== false) {
      commitGovernedLearningWriteUnit(deps, {
        recommendations: [withReviewer],
        history: [history],
      });
      writeUnitCommitted = true;
    }

    return {
      recommendation: withReviewer,
      writeUnitCommitted,
      explainability: projectStrategicRecommendationExplainability(withReviewer),
    };
  };
}
