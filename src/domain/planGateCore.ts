/**
 * SPEC-004 Phase 1 — AuthorizePlannedAction Domain predicates (pure).
 * Does not embed SPEC-006 publication logic.
 */

import {
  assertBriefContextCurrentForPlan,
  type PlanBriefContext,
} from './planBriefContextCore';
import type { PlanActorKind, PlanItem } from './planItemCore';
import {
  assertActorMayActivate,
  PLAN_EXECUTION_ELIGIBLE_STATUSES,
  type StrategicPlan,
} from './strategicPlanCore';
import { planFail, planOk, type PlanDomainResult } from './strategicPlanErrors';

export interface AuthorizePlannedActionInput {
  plan: StrategicPlan;
  item: PlanItem;
  /** Supplied Brief projection — Application loads it in Phase 2. */
  brief: PlanBriefContext;
  actorKind: PlanActorKind;
}

export interface AuthorizePlannedActionDecision {
  allowed: boolean;
  planId: string;
  planItemId: string;
  strategicBriefId: string;
  strategicBriefVersion: number;
  thesisId: string;
  action: string;
  reasons: string[];
}

/**
 * Structural eligibility for executing a PlanItem.
 * Publication of claim-bearing content remains SPEC-006 downstream.
 */
export function authorizePlannedAction(
  input: AuthorizePlannedActionInput
): PlanDomainResult<AuthorizePlannedActionDecision> {
  const { plan, item, brief, actorKind } = input;
  const reasons: string[] = [];

  if (plan.status === 'SUPERSEDED') {
    return planFail('PLAN_SUPERSEDED', 'plan is SUPERSEDED');
  }
  if (!(PLAN_EXECUTION_ELIGIBLE_STATUSES as readonly string[]).includes(plan.status)) {
    return planFail(
      'PLAN_NOT_APPROVED',
      `plan status=${plan.status} cannot authorize execution`
    );
  }
  if (!plan.approvedBy) {
    return planFail('PLAN_NOT_APPROVED', 'plan lacks human approvedBy metadata');
  }

  const actor = assertActorMayActivate(actorKind);
  if (!actor.ok) return actor;

  if (item.planId !== plan.id) {
    return planFail('INVALID_PLAN_ITEM', 'PlanItem does not belong to plan');
  }
  const onPlan = plan.items.find((row) => row.id === item.id);
  if (!onPlan) {
    return planFail('INVALID_PLAN_ITEM', 'PlanItem is not attached to plan');
  }
  if (item.status !== 'READY') {
    return planFail(
      'INVALID_ITEM_TRANSITION',
      'PlanItem must be READY before AuthorizePlannedAction allows activation'
    );
  }

  const briefOk = assertBriefContextCurrentForPlan(
    {
      strategicBriefId: plan.strategicBriefId,
      strategicBriefVersion: plan.strategicBriefVersion,
      thesisId: plan.thesisId,
      organizationId: plan.organizationId,
      clientId: plan.clientId,
    },
    brief
  );
  if (!briefOk.ok) return briefOk;

  if (brief.authorizedAction !== plan.authorizedAction) {
    // Bound action drift relative to captured plan bound — fail closed via stale/action checks.
    if (brief.authorizedAction === 'NONE' || item.action !== brief.authorizedAction) {
      return planFail(
        'ACTION_NOT_AUTHORIZED',
        'item action not authorized by current Brief authorizedAction'
      );
    }
  } else if (brief.authorizedAction === 'NONE' || item.action !== brief.authorizedAction) {
    return planFail(
      'ACTION_NOT_AUTHORIZED',
      'item action not authorized by Brief authorizedAction'
    );
  }

  reasons.push('plan_status_eligible');
  reasons.push('human_approved');
  reasons.push('brief_current_approved');
  reasons.push('thesis_matches');
  reasons.push('tenant_matches');
  reasons.push('action_authorized');
  reasons.push('item_ready');
  reasons.push('spec006_publication_not_evaluated');

  return planOk({
    allowed: true,
    planId: plan.id,
    planItemId: item.id,
    strategicBriefId: plan.strategicBriefId,
    strategicBriefVersion: plan.strategicBriefVersion,
    thesisId: plan.thesisId,
    action: item.action,
    reasons,
  });
}
