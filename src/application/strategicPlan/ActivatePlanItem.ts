import {
  transitionPlanItemStatus,
  type PlanItem,
} from '../../domain/planItemCore';
import {
  transitionPlanStatus,
  type StrategicPlan,
} from '../../domain/strategicPlanCore';
import {
  activatePlanItemIdempotencyKey,
  planHistoryIntent,
} from '../../domain/planMaterialityCore';
import { authorizePlannedAction as authorizeDomain } from '../../domain/planGateCore';
import {
  loadAuthoritativeBrief,
  toPlanBriefContext,
} from './briefProjection';
import { commitGovernedPlanWriteUnit } from './commitWriteUnit';
import { StrategicPlanError } from './errors';
import { loadAuthoritativePlan } from './loadPlan';
import { unwrapDomain } from './mapDomainError';
import type { StrategicBriefReader } from './ports/StrategicBriefReader';
import type { StrategicPlanHistoryPort } from './ports/StrategicPlanHistoryPort';
import type { StrategicPlanRepository } from './ports/StrategicPlanRepository';
import {
  assertNoTenantSpoof,
  assertTrustedPlanActor,
  resolveTrustedActorKind,
  type TrustedPlanActorContext,
} from './trustedContext';

export interface PlanItemLifecycleInput {
  trusted: TrustedPlanActorContext;
  planId: string;
  planItemId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedPlan?: unknown;
  forgedBrief?: unknown;
  actorKind?: string;
  persist?: boolean;
}

export interface PlanItemLifecycleResult {
  plan: StrategicPlan;
  item: PlanItem;
  writeUnitCommitted: boolean;
}

export interface PlanItemLifecycleDeps {
  plans: StrategicPlanRepository;
  history: StrategicPlanHistoryPort;
  briefs: StrategicBriefReader;
}

function replaceItem(plan: StrategicPlan, item: PlanItem): StrategicPlan {
  return {
    ...plan,
    items: plan.items.map((row) => (row.id === item.id ? item : row)),
    updatedAt: item.updatedAt,
  };
}

export function createActivatePlanItem(deps: PlanItemLifecycleDeps) {
  return function activatePlanItem(input: PlanItemLifecycleInput): PlanItemLifecycleResult {
    assertTrustedPlanActor(input.trusted);
    assertNoTenantSpoof(input);
    void input.forgedPlan;
    void input.forgedBrief;
    void input.actorKind;

    const tenant = {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    };

    let plan = loadAuthoritativePlan(deps.plans, input.trusted, input.planId);
    const item = plan.items.find((row) => row.id === input.planItemId);
    if (!item) {
      throw new StrategicPlanError(
        'PLAN_ITEM_NOT_FOUND',
        `PlanItem not found: ${input.planItemId}`
      );
    }

    if (item.status === 'IN_PROGRESS' || item.status === 'DONE') {
      return { plan, item, writeUnitCommitted: false };
    }

    const brief = loadAuthoritativeBrief(
      deps.briefs,
      input.trusted,
      plan.strategicBriefId
    );
    const briefCtx = toPlanBriefContext(brief);
    const actorKind = resolveTrustedActorKind(input.trusted, 'activate');

    unwrapDomain(
      authorizeDomain({
        plan,
        item,
        brief: briefCtx,
        actorKind,
      })
    );

    const activated = unwrapDomain(
      transitionPlanItemStatus(item, 'IN_PROGRESS', input.trusted.now)
    );
    plan = replaceItem(plan, activated);

    if (plan.status === 'APPROVED') {
      plan = unwrapDomain(
        transitionPlanStatus(plan, 'ACTIVE', {
          actorKind,
          updatedAt: input.trusted.now,
        })
      );
    }

    const idemKey = activatePlanItemIdempotencyKey(activated.id, plan.version);
    const hist = planHistoryIntent('ITEM_ACTIVATED', plan, {
      itemId: activated.id,
      actorId: input.trusted.actorId,
    });

    const persist = input.persist !== false;
    if (persist) {
      commitGovernedPlanWriteUnit(deps.plans, deps.history, {
        plans: [plan],
        history: [
          {
            id: `hist_${plan.id}_item_act_${activated.id}`,
            organizationId: plan.organizationId,
            clientId: plan.clientId,
            planId: hist.planId,
            planVersion: hist.planVersion,
            event: hist.event,
            actorId: input.trusted.actorId,
            at: input.trusted.now,
            itemId: activated.id,
          },
        ],
        idempotencyKeys: [
          {
            key: idemKey,
            planId: plan.id,
            organizationId: tenant.organizationId,
            clientId: tenant.clientId,
            at: input.trusted.now,
          },
        ],
      });
    }

    return { plan, item: activated, writeUnitCommitted: persist };
  };
}

export function createCompletePlanItem(deps: PlanItemLifecycleDeps) {
  return function completePlanItem(input: PlanItemLifecycleInput): PlanItemLifecycleResult {
    assertTrustedPlanActor(input.trusted);
    assertNoTenantSpoof(input);
    void input.forgedPlan;
    void input.forgedBrief;
    void input.actorKind;

    let plan = loadAuthoritativePlan(deps.plans, input.trusted, input.planId);
    const item = plan.items.find((row) => row.id === input.planItemId);
    if (!item) {
      throw new StrategicPlanError(
        'PLAN_ITEM_NOT_FOUND',
        `PlanItem not found: ${input.planItemId}`
      );
    }

    if (item.status === 'DONE') {
      return { plan, item, writeUnitCommitted: false };
    }

    // Revalidate Brief still current before completing strategic work.
    const brief = loadAuthoritativeBrief(
      deps.briefs,
      input.trusted,
      plan.strategicBriefId
    );
    void toPlanBriefContext(brief);

    const actorKind = resolveTrustedActorKind(input.trusted, 'activate');
    void actorKind;

    const completed = unwrapDomain(
      transitionPlanItemStatus(item, 'DONE', input.trusted.now)
    );
    plan = replaceItem(plan, completed);

    const hist = planHistoryIntent('ITEM_COMPLETED', plan, {
      itemId: completed.id,
      actorId: input.trusted.actorId,
    });

    const persist = input.persist !== false;
    if (persist) {
      commitGovernedPlanWriteUnit(deps.plans, deps.history, {
        plans: [plan],
        history: [
          {
            id: `hist_${plan.id}_item_done_${completed.id}`,
            organizationId: plan.organizationId,
            clientId: plan.clientId,
            planId: hist.planId,
            planVersion: hist.planVersion,
            event: hist.event,
            actorId: input.trusted.actorId,
            at: input.trusted.now,
            itemId: completed.id,
          },
        ],
      });
    }

    return { plan, item: completed, writeUnitCommitted: persist };
  };
}

export function createCancelPlanItem(deps: PlanItemLifecycleDeps) {
  return function cancelPlanItem(input: PlanItemLifecycleInput): PlanItemLifecycleResult {
    assertTrustedPlanActor(input.trusted);
    assertNoTenantSpoof(input);
    void input.forgedPlan;
    void input.forgedBrief;
    void input.actorKind;

    let plan = loadAuthoritativePlan(deps.plans, input.trusted, input.planId);
    const item = plan.items.find((row) => row.id === input.planItemId);
    if (!item) {
      throw new StrategicPlanError(
        'PLAN_ITEM_NOT_FOUND',
        `PlanItem not found: ${input.planItemId}`
      );
    }

    if (item.status === 'CANCELLED') {
      return { plan, item, writeUnitCommitted: false };
    }

    const cancelled = unwrapDomain(
      transitionPlanItemStatus(item, 'CANCELLED', input.trusted.now)
    );
    plan = replaceItem(plan, cancelled);

    const hist = planHistoryIntent('ITEM_CANCELLED', plan, {
      itemId: cancelled.id,
      actorId: input.trusted.actorId,
    });

    const persist = input.persist !== false;
    if (persist) {
      commitGovernedPlanWriteUnit(deps.plans, deps.history, {
        plans: [plan],
        history: [
          {
            id: `hist_${plan.id}_item_cancel_${cancelled.id}`,
            organizationId: plan.organizationId,
            clientId: plan.clientId,
            planId: hist.planId,
            planVersion: hist.planVersion,
            event: hist.event,
            actorId: input.trusted.actorId,
            at: input.trusted.now,
            itemId: cancelled.id,
          },
        ],
      });
    }

    return { plan, item: cancelled, writeUnitCommitted: persist };
  };
}
