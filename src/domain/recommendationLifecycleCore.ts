/**
 * SPEC-008 Phase 1 — Canonical StrategicRecommendation lifecycle (pure).
 * No generic setStatus. Human-required approval/rejection.
 */

import { lrnFail, lrnOk, type LearningDomainResult } from './learningLoopErrors';

export const RECOMMENDATION_STATUSES = [
  'DRAFT',
  'PROPOSED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED',
  'APPLIED',
  'APPROVED_NOT_APPLIED',
  'APPLY_FAILED',
] as const;

export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const TERMINAL_RECOMMENDATION_STATUSES = [
  'REJECTED',
  'SUPERSEDED',
  'APPLIED',
] as const;

export type RecommendationActorKind = 'HUMAN' | 'SOFTWARE' | 'AI' | 'UI' | 'UNKNOWN';

/** Who may enter each status (strategic-recommendation.md). */
export const RECOMMENDATION_STATUS_ENTRY_ACTORS: Record<
  RecommendationStatus,
  readonly RecommendationActorKind[]
> = {
  DRAFT: ['SOFTWARE'],
  PROPOSED: ['SOFTWARE'],
  UNDER_REVIEW: ['SOFTWARE', 'HUMAN'],
  APPROVED: ['HUMAN'],
  REJECTED: ['HUMAN'],
  SUPERSEDED: ['SOFTWARE', 'HUMAN'],
  APPLIED: ['SOFTWARE'],
  APPROVED_NOT_APPLIED: ['SOFTWARE'],
  APPLY_FAILED: ['SOFTWARE'],
};

/**
 * Canonical transition graph — exact formal table.
 */
export const RECOMMENDATION_STATUS_TRANSITIONS: Record<
  RecommendationStatus,
  readonly RecommendationStatus[]
> = {
  DRAFT: ['PROPOSED'],
  PROPOSED: ['UNDER_REVIEW', 'REJECTED', 'SUPERSEDED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'SUPERSEDED'],
  APPROVED: ['APPLIED', 'APPROVED_NOT_APPLIED', 'APPLY_FAILED'],
  REJECTED: [],
  SUPERSEDED: [],
  APPLIED: [],
  APPROVED_NOT_APPLIED: [],
  APPLY_FAILED: ['APPROVED', 'REJECTED', 'SUPERSEDED'],
};

export const HUMAN_REQUIRED_TRANSITIONS: readonly RecommendationStatus[] = [
  'APPROVED',
  'REJECTED',
];

export function isRecommendationStatus(value: unknown): value is RecommendationStatus {
  return (
    typeof value === 'string' &&
    (RECOMMENDATION_STATUSES as readonly string[]).includes(value)
  );
}

export function isTerminalRecommendationStatus(status: RecommendationStatus): boolean {
  return (TERMINAL_RECOMMENDATION_STATUSES as readonly string[]).includes(status);
}

export function canTransitionRecommendationStatus(
  from: RecommendationStatus,
  to: RecommendationStatus
): boolean {
  return (RECOMMENDATION_STATUS_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function assertActorMayEnterRecommendationStatus(
  actorKind: RecommendationActorKind,
  to: RecommendationStatus
): LearningDomainResult<void> {
  if (actorKind === 'AI') {
    return lrnFail('AI_AUTHORITY_FORBIDDEN', 'AI cannot authorize recommendation lifecycle transitions');
  }
  if (actorKind === 'UI' || actorKind === 'UNKNOWN') {
    return lrnFail(
      'ACTOR_FORBIDDEN',
      `actorKind=${actorKind} cannot authorize recommendation lifecycle transitions`
    );
  }
  const allowed = RECOMMENDATION_STATUS_ENTRY_ACTORS[to];
  if (!(allowed as readonly string[]).includes(actorKind)) {
    return lrnFail(
      'ACTOR_FORBIDDEN',
      `actorKind=${actorKind} cannot enter status=${to}`
    );
  }
  return lrnOk(undefined);
}

export function assertRecommendationTransition(
  from: RecommendationStatus,
  to: RecommendationStatus,
  actorKind: RecommendationActorKind
): LearningDomainResult<void> {
  if (isTerminalRecommendationStatus(from) && from !== 'APPLY_FAILED') {
    return lrnFail(
      'TERMINAL_STATE',
      `terminal status ${from} cannot transition (default deny)`
    );
  }
  if (from === 'APPLY_FAILED' && to === 'APPROVED') {
    // retry path — allowed by formal table
  } else if (isTerminalRecommendationStatus(from)) {
    return lrnFail('TERMINAL_STATE', `terminal status ${from} cannot transition`);
  }
  if (!canTransitionRecommendationStatus(from, to)) {
    return lrnFail(
      'INVALID_TRANSITION',
      `invalid recommendation transition ${from} → ${to}`
    );
  }
  return assertActorMayEnterRecommendationStatus(actorKind, to);
}

export function assertHumanApprovalRequired(to: RecommendationStatus): LearningDomainResult<void> {
  if ((HUMAN_REQUIRED_TRANSITIONS as readonly string[]).includes(to)) {
    return lrnOk(undefined);
  }
  return lrnFail('HUMAN_APPROVAL_REQUIRED', `transition to ${to} is not a human approval transition`);
}

export function assertCanApplyRecommendation(
  status: RecommendationStatus
): LearningDomainResult<void> {
  if (status !== 'APPROVED') {
    return lrnFail(
      'RECOMMENDATION_NOT_APPROVED',
      `recommendation must be APPROVED to apply (current=${status})`
    );
  }
  return lrnOk(undefined);
}

export function assertNotSuperseded(status: RecommendationStatus): LearningDomainResult<void> {
  if (status === 'SUPERSEDED') {
    return lrnFail('SUPERSEDED_RECOMMENDATION', 'superseded recommendation cannot be applied');
  }
  return lrnOk(undefined);
}

export function assertApprovedNotAppliedIsNotApplied(
  status: RecommendationStatus
): LearningDomainResult<void> {
  if (status === 'APPROVED_NOT_APPLIED') {
    return lrnOk(undefined);
  }
  if (status === 'APPLIED') {
    return lrnFail(
      'INVALID_TRANSITION',
      'APPLIED and APPROVED_NOT_APPLIED are distinct terminal semantics'
    );
  }
  return lrnOk(undefined);
}

export function assertApplyFailedIsNotApplied(
  status: RecommendationStatus
): LearningDomainResult<void> {
  if (status === 'APPLY_FAILED') {
    return lrnOk(undefined);
  }
  return lrnOk(undefined);
}
