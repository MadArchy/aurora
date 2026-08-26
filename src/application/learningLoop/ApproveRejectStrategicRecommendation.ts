/**
 * SPEC-008 Phase 2 — ApproveStrategicRecommendation / RejectStrategicRecommendation (T-008-205).
 */

import { transitionStrategicRecommendationStatus } from '../../domain/learningAuthorityCore';
import {
  createRecommendationDecision,
  type RecommendationDecisionKind,
} from '../../domain/recommendationDecisionCore';
import {
  createLearningHistoryRecord,
  recommendationMaterialFingerprint,
} from '../../domain/learningMaterialityCore';
import { projectStrategicRecommendationExplainability } from '../../domain/learningExplainabilityCore';
import type { RecommendationStatus } from '../../domain/recommendationLifecycleCore';
import { commitGovernedLearningWriteUnit } from './commitWriteUnit';
import { LearningApplicationError } from './errors';
import { loadAuthoritativeRecommendation } from './loadAggregates';
import { unwrapDomain } from './mapDomainError';
import type { LearningHistoryPort } from './ports/LearningHistoryPort';
import type { RecommendationDecisionRepository } from './ports/RecommendationDecisionRepository';
import type { StrategicRecommendationRepository } from './ports/StrategicRecommendationRepository';
import {
  assertNoTenantSpoof,
  assertTrustedLearningActor,
  ignoreCallerActorClaims,
  resolveTrustedLearningActorKind,
  trustedTenant,
  type TrustedLearningActorContext,
} from './trustedContext';

export interface RecommendationDecisionInput {
  trusted: TrustedLearningActorContext;
  recommendationId: string;
  decisionId: string;
  reason: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Caller snapshot / approval spoof fields — IGNORED. */
  forgedRecommendation?: unknown;
  forgedStatus?: string;
  approved?: boolean;
  approvedBy?: string;
  actorType?: string;
  role?: string;
  humanAuthority?: boolean;
  softwareAuthority?: boolean;
  expectedVersion?: number;
  persist?: boolean;
}

export interface RecommendationDecisionDeps {
  recommendations: StrategicRecommendationRepository;
  history: LearningHistoryPort;
  decisions?: RecommendationDecisionRepository;
}

function applyHumanDecision(
  deps: RecommendationDecisionDeps,
  input: RecommendationDecisionInput,
  decisionKind: RecommendationDecisionKind,
  toStatus: RecommendationStatus
) {
  assertTrustedLearningActor(input.trusted);
  assertNoTenantSpoof(input);
  ignoreCallerActorClaims(input);
  void input.forgedRecommendation;
  void input.forgedStatus;
  void input.approved;

  const actorKind = resolveTrustedLearningActorKind(input.trusted, 'humanLifecycle');
  const tenant = trustedTenant(input.trusted);

  const current = loadAuthoritativeRecommendation(
    deps.recommendations,
    input.trusted,
    input.recommendationId
  );

  if (input.expectedVersion != null && input.expectedVersion !== current.version) {
    throw new LearningApplicationError(
      'STALE_STATE',
      `Stale recommendation version: expected ${input.expectedVersion}, current ${current.version}`
    );
  }

  const previousStatus = current.status;

  const transitioned = unwrapDomain(
    transitionStrategicRecommendationStatus({
      recommendation: current,
      to: toStatus,
      actorKind,
      updatedAt: input.trusted.now,
    })
  );

  const recommendation = {
    ...transitioned,
    approvedBy: toStatus === 'APPROVED' ? input.trusted.actorId : transitioned.approvedBy,
    reviewedBy: transitioned.reviewedBy ?? input.trusted.actorId,
  };

  const decision = unwrapDomain(
    createRecommendationDecision({
      decisionId: input.decisionId,
      recommendationId: recommendation.recommendationId,
      recommendationVersion: recommendation.version,
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      decision: decisionKind,
      actorUid: input.trusted.actorId,
      reason: input.reason,
      decidedAt: input.trusted.now,
      previousStatus,
    })
  );

  const history = createLearningHistoryRecord({
    kind: 'RECOMMENDATION_DECISION',
    organizationId: tenant.organizationId,
    clientId: tenant.clientId,
    aggregateKind: 'DECISION',
    aggregateId: decision.decisionId,
    aggregateVersion: recommendation.version,
    actorKind,
    reasonCodes: ['HUMAN_APPROVAL_RECORDED'],
    materialFingerprint: recommendationMaterialFingerprint(recommendation),
    occurredAt: input.trusted.now,
  });

  let writeUnitCommitted = false;
  if (input.persist !== false) {
    commitGovernedLearningWriteUnit(deps, {
      recommendations: [recommendation],
      history: [history],
      decisions: [decision],
    });
    writeUnitCommitted = true;
  }

  return {
    recommendation,
    decision,
    writeUnitCommitted,
    explainability: projectStrategicRecommendationExplainability(recommendation),
  };
}

export function createApproveStrategicRecommendation(deps: RecommendationDecisionDeps) {
  return function approveStrategicRecommendation(input: RecommendationDecisionInput) {
    return applyHumanDecision(deps, input, 'APPROVE', 'APPROVED');
  };
}

export function createRejectStrategicRecommendation(deps: RecommendationDecisionDeps) {
  return function rejectStrategicRecommendation(input: RecommendationDecisionInput) {
    return applyHumanDecision(deps, input, 'REJECT', 'REJECTED');
  };
}
