/**
 * SPEC-007 Phase 1 — Materialize gate predicates (pure).
 * Consumes SPEC-004 authorization FACT supplied by Application — does not call Planner.
 */

import type { OpportunityCandidate } from './opportunityCandidateCore';
import {
  assertActorMayEnterStatus,
  type OpportunityActorKind,
} from './opportunityLifecycleCore';
import { assertCandidateThesisForBinding } from './opportunityMultiThesisCore';
import { oppFail, oppOk, type OpportunityDomainResult } from './opportunityScoutErrors';
import {
  assertOpportunityTenantsMatch,
  type OpportunityTenantEnvelope,
} from './opportunityTenantCore';

export const CREATE_OPPORTUNITY_ACTION = 'CREATE_OPPORTUNITY' as const;

/**
 * Authorization context fact from higher layer (Phase 2 loads current Plan).
 * Domain validates shape/consistency only — does not prove Plan currency.
 */
export interface CreateOpportunityAuthorizationContext
  extends OpportunityTenantEnvelope {
  thesisId: string;
  strategicBriefId: string;
  strategicBriefVersion: number;
  strategicPlanId: string;
  strategicPlanVersion: number;
  planItemId: string;
  action: string;
  /** SPEC-004 AuthorizePlannedAction decision.allowed */
  authorizationAllowed: boolean;
  actorKind: OpportunityActorKind;
}

export interface MaterializeGateInput {
  authorization: CreateOpportunityAuthorizationContext;
  candidate?: OpportunityCandidate | null;
  /** Explicit thesis for Stage B — required; never inferred. */
  thesisId: string | null | undefined;
}

export interface MaterializeGateDecision {
  allowed: boolean;
  reasons: string[];
  thesisId: string;
  strategicBriefId: string;
  strategicBriefVersion: number;
  strategicPlanId: string;
  strategicPlanVersion: number;
  planItemId: string;
  candidateId: string | null;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function assertPositiveVersion(n: unknown, label: string): OpportunityDomainResult<number> {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
    return oppFail('TRUSTED_CONTEXT_REQUIRED', `${label} must be integer >= 1`);
  }
  return oppOk(n);
}

/**
 * Stage B materialization eligibility. High OpportunityScore alone never allows.
 */
export function assertMaterializeGate(
  input: MaterializeGateInput
): OpportunityDomainResult<MaterializeGateDecision> {
  const auth = input.authorization;
  if (!auth || typeof auth !== 'object') {
    return oppFail(
      'CREATE_OPPORTUNITY_AUTHORIZATION_REQUIRED',
      'authorization context required'
    );
  }

  const tenantSelf = assertOpportunityTenantsMatch(auth, auth);
  if (!tenantSelf.ok) return tenantSelf;

  const actor = assertActorMayEnterStatus(auth.actorKind, 'PROPOSED');
  if (!actor.ok) return actor;

  if (auth.authorizationAllowed !== true) {
    return oppFail(
      'CREATE_OPPORTUNITY_AUTHORIZATION_REQUIRED',
      'SPEC-004 authorizationAllowed must be true'
    );
  }

  if (auth.action !== CREATE_OPPORTUNITY_ACTION) {
    return oppFail(
      'ACTION_NOT_AUTHORIZED',
      `action must be ${CREATE_OPPORTUNITY_ACTION}`
    );
  }

  const briefId = nonEmpty(auth.strategicBriefId);
  const planId = nonEmpty(auth.strategicPlanId);
  const planItemId = nonEmpty(auth.planItemId);
  if (!briefId || !planId || !planItemId) {
    return oppFail(
      'TRUSTED_CONTEXT_REQUIRED',
      'Brief/Plan/PlanItem references required'
    );
  }

  const briefVer = assertPositiveVersion(
    auth.strategicBriefVersion,
    'strategicBriefVersion'
  );
  if (!briefVer.ok) return briefVer;
  const planVer = assertPositiveVersion(
    auth.strategicPlanVersion,
    'strategicPlanVersion'
  );
  if (!planVer.ok) return planVer;

  const authThesis = nonEmpty(auth.thesisId);
  if (!authThesis) {
    return oppFail('THESIS_MISMATCH', 'authorization.thesisId required');
  }

  const requested = nonEmpty(input.thesisId);
  if (!requested) {
    return oppFail(
      'THESIS_MISMATCH',
      'explicit thesisId required for materialization (no winner selection)'
    );
  }
  if (requested !== authThesis) {
    return oppFail(
      'THESIS_MISMATCH',
      'requested thesisId does not match authorization.thesisId'
    );
  }

  let candidateId: string | null = null;
  if (input.candidate) {
    const tenant = assertOpportunityTenantsMatch(auth, input.candidate);
    if (!tenant.ok) return tenant;
    const binding = assertCandidateThesisForBinding(input.candidate, requested);
    if (!binding.ok) return binding;
    candidateId = input.candidate.id;
  }

  return oppOk({
    allowed: true,
    reasons: ['CREATE_OPPORTUNITY_AUTHORIZATION_ALLOW'],
    thesisId: requested,
    strategicBriefId: briefId,
    strategicBriefVersion: briefVer.value,
    strategicPlanId: planId,
    strategicPlanVersion: planVer.value,
    planItemId,
    candidateId,
  });
}

/**
 * Explicit adversarial: max score without Plan allow → deny.
 */
export function assertHighScoreDoesNotAuthorize(
  opportunityScoreTotal: number,
  authorizationAllowed: boolean
): OpportunityDomainResult<void> {
  if (authorizationAllowed === true) {
    return oppOk(undefined);
  }
  return oppFail(
    'CREATE_OPPORTUNITY_AUTHORIZATION_REQUIRED',
    `OpportunityScore=${opportunityScoreTotal} does not authorize CREATE_OPPORTUNITY`
  );
}
