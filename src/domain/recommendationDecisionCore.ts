/**
 * SPEC-008 Phase 1 — RecommendationDecision append-only audit (pure).
 * Decision history supports audit; current status lives on recommendation aggregate.
 */

import { lrnFail, lrnOk, type LearningDomainResult } from './learningLoopErrors';
import {
  assertLearningTenantKeyedId,
  assertSameOrgClientLearningEntity,
} from './learningTenantCore';
import type { RecommendationStatus } from './recommendationLifecycleCore';
import type { StrategicRecommendation } from './strategicRecommendationCore';

export const RECOMMENDATION_DECISIONS = ['APPROVE', 'REJECT'] as const;
export type RecommendationDecisionKind = (typeof RECOMMENDATION_DECISIONS)[number];

export interface RecommendationDecision {
  decisionId: string;
  recommendationId: string;
  recommendationVersion: number;
  organizationId: string;
  clientId: string;
  decision: RecommendationDecisionKind;
  actorUid: string;
  reason: string;
  decidedAt: string;
  previousStatus: RecommendationStatus;
  /** Append-only audit — never current authority alone. */
  authority: 'AUDIT_ONLY';
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function createRecommendationDecision(input: {
  decisionId: string;
  recommendationId: string;
  recommendationVersion: number;
  organizationId: string;
  clientId: string;
  decision: RecommendationDecisionKind;
  actorUid: string;
  reason: string;
  decidedAt: string;
  previousStatus: RecommendationStatus;
}): LearningDomainResult<RecommendationDecision> {
  const keyed = assertLearningTenantKeyedId({
    id: input.decisionId,
    organizationId: input.organizationId,
    clientId: input.clientId,
  });
  if (!keyed.ok) return keyed;

  if (!(RECOMMENDATION_DECISIONS as readonly string[]).includes(input.decision)) {
    return lrnFail('MALFORMED_RECOMMENDATION', `invalid decision=${input.decision}`);
  }

  const actorUid = nonEmpty(input.actorUid);
  const reason = nonEmpty(input.reason);
  const decidedAt = nonEmpty(input.decidedAt);
  if (!actorUid || !reason || !decidedAt) {
    return lrnFail('MALFORMED_RECOMMENDATION', 'actorUid, reason, and decidedAt are required');
  }

  if (!Number.isInteger(input.recommendationVersion) || input.recommendationVersion < 1) {
    return lrnFail('INVALID_VERSION', 'recommendationVersion must be a positive integer');
  }

  const recId = nonEmpty(input.recommendationId);
  if (!recId) {
    return lrnFail('MALFORMED_RECOMMENDATION', 'recommendationId is required');
  }

  return lrnOk({
    decisionId: keyed.value.id,
    recommendationId: recId,
    recommendationVersion: input.recommendationVersion,
    organizationId: keyed.value.organizationId,
    clientId: keyed.value.clientId,
    decision: input.decision,
    actorUid,
    reason,
    decidedAt,
    previousStatus: input.previousStatus,
    authority: 'AUDIT_ONLY',
  });
}

export function assertDecisionMatchesRecommendation(
  decision: RecommendationDecision,
  recommendation: StrategicRecommendation
): LearningDomainResult<void> {
  if (decision.recommendationId !== recommendation.recommendationId) {
    return lrnFail('MALFORMED_RECOMMENDATION', 'decision recommendationId mismatch');
  }
  if (decision.recommendationVersion !== recommendation.version) {
    return lrnFail('INVALID_VERSION', 'decision recommendationVersion mismatch');
  }
  return assertSameOrgClientLearningEntity(decision, recommendation, 'recommendation decision');
}

/** Decision record alone cannot apply a recommendation. */
export function assertDecisionDoesNotApply(
  decision: RecommendationDecision
): LearningDomainResult<void> {
  if (decision.authority !== 'AUDIT_ONLY') {
    return lrnFail('AUTO_MUTATION_FORBIDDEN', 'decision record cannot be application authority');
  }
  return lrnOk(undefined);
}
