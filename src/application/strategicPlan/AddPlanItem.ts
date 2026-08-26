import {
  attachPlanItem,
  removePlanItem as removePlanItemDomain,
  type StrategicPlan,
} from '../../domain/strategicPlanCore';
import {
  createPlanItem,
  transitionPlanItemStatus,
  type PlanItem,
} from '../../domain/planItemCore';
import type { StrategicAuthorizedAction } from '../../domain/strategicBriefCore';
import {
  addPlanItemIdempotencyKey,
  planHistoryIntent,
} from '../../domain/planMaterialityCore';
import {
  loadAuthoritativeBrief,
  requireApprovedCurrentBrief,
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
  type TrustedPlanActorContext,
} from './trustedContext';

export interface AddPlanItemInput {
  trusted: TrustedPlanActorContext;
  planId: string;
  itemId: string;
  action: StrategicAuthorizedAction;
  order: number;
  rationale: string;
  intentKey: string;
  channel?: string | null;
  format?: string | null;
  riskNotes?: string[];
  /** When true (default), PLANNED → READY so item can later authorize. */
  markReady?: boolean;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedPlan?: unknown;
  forgedBrief?: unknown;
  persist?: boolean;
}

export interface AddPlanItemResult {
  plan: StrategicPlan;
  item: PlanItem;
  created: boolean;
  writeUnitCommitted: boolean;
}

export interface RemovePlanItemInput {
  trusted: TrustedPlanActorContext;
  planId: string;
  itemId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedPlan?: unknown;
  persist?: boolean;
}

export interface RemovePlanItemResult {
  plan: StrategicPlan;
  writeUnitCommitted: boolean;
}

export interface PlanItemMutationDeps {
  plans: StrategicPlanRepository;
  history: StrategicPlanHistoryPort;
  briefs: StrategicBriefReader;
}

export function createAddPlanItem(deps: PlanItemMutationDeps) {
  return function addPlanItem(input: AddPlanItemInput): AddPlanItemResult {
    assertTrustedPlanActor(input.trusted);
    assertNoTenantSpoof(input);
    void input.forgedPlan;
    void input.forgedBrief;

    const intentKey = input.intentKey?.trim();
    if (!intentKey) {
      throw new StrategicPlanError('INVALID_PLAN_ITEM', 'intentKey is required.');
    }

    const tenant = {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    };

    const current = loadAuthoritativePlan(deps.plans, input.trusted, input.planId);
    const brief = loadAuthoritativeBrief(
      deps.briefs,
      input.trusted,
      current.strategicBriefId
    );
    requireApprovedCurrentBrief(brief);
    if (brief.version !== current.strategicBriefVersion) {
      throw new StrategicPlanError(
        'BRIEF_REVISION_STALE',
        'Plan Brief version does not match current Brief.'
      );
    }
    const briefCtx = toPlanBriefContext(brief);

    const idemKey = addPlanItemIdempotencyKey({
      planId: current.id,
      action: input.action,
      order: input.order,
      intentKey,
    });
    const existingKey = deps.plans.findByIdempotencyKey(tenant, idemKey);
    if (existingKey) {
      const existingPlan = deps.plans.getById(existingKey.planId, tenant) ?? current;
      const existingItem = existingPlan.items.find((row) => row.id === input.itemId);
      if (existingItem) {
        return {
          plan: existingPlan,
          item: existingItem,
          created: false,
          writeUnitCommitted: false,
        };
      }
    }

    if (current.items.some((row) => row.id === input.itemId)) {
      const existingItem = current.items.find((row) => row.id === input.itemId)!;
      return {
        plan: current,
        item: existingItem,
        created: false,
        writeUnitCommitted: false,
      };
    }

    let item = unwrapDomain(
      createPlanItem({
        id: input.itemId,
        planId: current.id,
        organizationId: current.organizationId,
        clientId: current.clientId,
        action: input.action,
        order: input.order,
        rationale: input.rationale,
        channel: input.channel ?? brief.recommendedChannel,
        format: input.format ?? brief.recommendedFormat,
        riskNotes: input.riskNotes,
        createdAt: input.trusted.now,
        briefAuthorizedAction: briefCtx.authorizedAction,
        planTenant: current,
      })
    );

    if (input.markReady !== false) {
      item = unwrapDomain(transitionPlanItemStatus(item, 'READY', input.trusted.now));
    }

    const plan = unwrapDomain(attachPlanItem(current, item));
    const hist = planHistoryIntent('ITEM_ADDED', plan, {
      itemId: item.id,
      actorId: input.trusted.actorId,
    });

    const persist = input.persist !== false;
    if (persist) {
      commitGovernedPlanWriteUnit(deps.plans, deps.history, {
        plans: [plan],
        history: [
          {
            id: `hist_${plan.id}_item_add_${item.id}`,
            organizationId: plan.organizationId,
            clientId: plan.clientId,
            planId: hist.planId,
            planVersion: hist.planVersion,
            event: hist.event,
            actorId: input.trusted.actorId,
            at: input.trusted.now,
            itemId: item.id,
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

    return { plan, item, created: true, writeUnitCommitted: persist };
  };
}

export function createRemovePlanItem(deps: PlanItemMutationDeps) {
  return function removePlanItem(input: RemovePlanItemInput): RemovePlanItemResult {
    assertTrustedPlanActor(input.trusted);
    assertNoTenantSpoof(input);
    void input.forgedPlan;

    const current = loadAuthoritativePlan(deps.plans, input.trusted, input.planId);
    const brief = loadAuthoritativeBrief(
      deps.briefs,
      input.trusted,
      current.strategicBriefId
    );
    requireApprovedCurrentBrief(brief);

    const plan = unwrapDomain(
      removePlanItemDomain(current, input.itemId, input.trusted.now)
    );
    const hist = planHistoryIntent('ITEM_REMOVED', plan, {
      itemId: input.itemId,
      actorId: input.trusted.actorId,
    });

    const persist = input.persist !== false;
    if (persist) {
      commitGovernedPlanWriteUnit(deps.plans, deps.history, {
        plans: [plan],
        history: [
          {
            id: `hist_${plan.id}_item_rm_${input.itemId}`,
            organizationId: plan.organizationId,
            clientId: plan.clientId,
            planId: hist.planId,
            planVersion: hist.planVersion,
            event: hist.event,
            actorId: input.trusted.actorId,
            at: input.trusted.now,
            itemId: input.itemId,
          },
        ],
      });
    }

    return { plan, writeUnitCommitted: persist };
  };
}
