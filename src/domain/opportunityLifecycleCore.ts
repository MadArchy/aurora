/**
 * SPEC-007 Phase 1 — Canonical Opportunity lifecycle (pure).
 * Unifies dual legacy OpportunityStatus / lifecycleStage at Domain level.
 * Does not mutate legacy models.
 */

import { oppFail, oppOk, type OpportunityDomainResult } from './opportunityScoutErrors';

export const CANONICAL_OPPORTUNITY_STATUSES = [
  'PROPOSED',
  'ACCEPTED',
  'DECLINED',
  'CHECKLIST',
  'SUBMITTED',
  'COMPLETED',
  'ARCHIVED',
] as const;

export type CanonicalOpportunityStatus =
  (typeof CANONICAL_OPPORTUNITY_STATUSES)[number];

export const TERMINAL_OPPORTUNITY_STATUSES = [
  'DECLINED',
  'COMPLETED',
  'ARCHIVED',
] as const;

export type OpportunityActorKind = 'HUMAN' | 'SOFTWARE' | 'AI' | 'UI' | 'UNKNOWN';

/** Who may enter each status (opportunity-model.md). */
export const STATUS_ENTRY_ACTORS: Record<
  CanonicalOpportunityStatus,
  readonly OpportunityActorKind[]
> = {
  PROPOSED: ['SOFTWARE'],
  ACCEPTED: ['HUMAN'],
  DECLINED: ['HUMAN'],
  CHECKLIST: ['HUMAN', 'SOFTWARE'],
  SUBMITTED: ['HUMAN'],
  COMPLETED: ['HUMAN', 'SOFTWARE'],
  ARCHIVED: ['HUMAN', 'SOFTWARE'],
};

/**
 * Canonical transition graph. No arbitrary setStatus.
 * Terminal reopen default: deny.
 */
export const OPPORTUNITY_STATUS_TRANSITIONS: Record<
  CanonicalOpportunityStatus,
  readonly CanonicalOpportunityStatus[]
> = {
  PROPOSED: ['ACCEPTED', 'DECLINED', 'ARCHIVED'],
  ACCEPTED: ['CHECKLIST', 'ARCHIVED'],
  DECLINED: [],
  CHECKLIST: ['SUBMITTED', 'ARCHIVED'],
  SUBMITTED: ['COMPLETED', 'ARCHIVED'],
  COMPLETED: [],
  ARCHIVED: [],
};

export function isCanonicalOpportunityStatus(
  value: unknown
): value is CanonicalOpportunityStatus {
  return (
    typeof value === 'string' &&
    (CANONICAL_OPPORTUNITY_STATUSES as readonly string[]).includes(value)
  );
}

export function isTerminalOpportunityStatus(
  status: CanonicalOpportunityStatus
): boolean {
  return (TERMINAL_OPPORTUNITY_STATUSES as readonly string[]).includes(status);
}

export function canTransitionOpportunityStatus(
  from: CanonicalOpportunityStatus,
  to: CanonicalOpportunityStatus
): boolean {
  return (OPPORTUNITY_STATUS_TRANSITIONS[from] as readonly string[]).includes(to);
}

/**
 * Actor class fact supplied by Application (Phase 2). Domain does not trust
 * free-form caller strings as identity — only the canonical enum fact.
 * AI / UI / UNKNOWN never authorize transitions.
 */
export function assertActorMayEnterStatus(
  actorKind: OpportunityActorKind,
  to: CanonicalOpportunityStatus
): OpportunityDomainResult<void> {
  if (actorKind === 'AI') {
    return oppFail('AI_AUTHORITY_FORBIDDEN', 'AI cannot authorize lifecycle transitions');
  }
  if (actorKind === 'UI' || actorKind === 'UNKNOWN') {
    return oppFail(
      'ACTOR_FORBIDDEN',
      `actorKind=${actorKind} cannot authorize lifecycle transitions`
    );
  }
  const allowed = STATUS_ENTRY_ACTORS[to];
  if (!(allowed as readonly string[]).includes(actorKind)) {
    return oppFail(
      'ACTOR_FORBIDDEN',
      `actorKind=${actorKind} cannot enter status=${to}`
    );
  }
  return oppOk(undefined);
}

export function assertOpportunityTransition(
  from: CanonicalOpportunityStatus,
  to: CanonicalOpportunityStatus,
  actorKind: OpportunityActorKind
): OpportunityDomainResult<void> {
  if (isTerminalOpportunityStatus(from)) {
    return oppFail(
      'TERMINAL_STATE',
      `terminal status ${from} cannot reopen (default deny)`
    );
  }
  if (!canTransitionOpportunityStatus(from, to)) {
    return oppFail(
      'INVALID_TRANSITION',
      `invalid opportunity transition ${from} → ${to}`
    );
  }
  return assertActorMayEnterStatus(actorKind, to);
}

/** Human-required entry statuses (accept/decline/submit). */
export const HUMAN_REQUIRED_ENTRY_STATUSES: readonly CanonicalOpportunityStatus[] = [
  'ACCEPTED',
  'DECLINED',
  'SUBMITTED',
];
