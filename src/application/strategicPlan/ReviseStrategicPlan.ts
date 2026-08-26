import {
  createPlanItem,
  transitionPlanItemStatus,
  type PlanItem,
} from '../../domain/planItemCore';
import type { StrategicAuthorizedAction } from '../../domain/strategicBriefCore';
import {
  planMaterialFingerprint,
  planHistoryIntent,
  revisePlanIdempotencyKey,
} from '../../domain/planMaterialityCore';
import {
  reviseStrategicPlanMaterial,
  type StrategicPlan,
} from '../../domain/strategicPlanCore';
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

export interface RevisePlanItemDraft {
  id: string;
  action: StrategicAuthorizedAction;
  order: number;
  rationale: string;
  channel?: string | null;
  format?: string | null;
  riskNotes?: string[];
  markReady?: boolean;
}

export interface ReviseStrategicPlanInput {
  trusted: TrustedPlanActorContext;
  priorPlanId: string;
  nextPlanId: string;
  rationale: string;
  items: RevisePlanItemDraft[];
  /** Optional rebind to newer Brief version of same Brief id. */
  strategicBriefId?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Additional Briefs — DENIED. */
  additionalBriefIds?: string[];
  forgedPlan?: unknown;
  forgedBrief?: unknown;
  persist?: boolean;
}

export interface ReviseStrategicPlanResult {
  prior: StrategicPlan;
  next: StrategicPlan;
  writeUnitCommitted: boolean;
}

export interface ReviseStrategicPlanDeps {
  plans: StrategicPlanRepository;
  history: StrategicPlanHistoryPort;
  briefs: StrategicBriefReader;
}

export function createReviseStrategicPlan(deps: ReviseStrategicPlanDeps) {
  return function reviseStrategicPlan(
    input: ReviseStrategicPlanInput
  ): ReviseStrategicPlanResult {
    assertTrustedPlanActor(input.trusted);
    assertNoTenantSpoof(input);
    void input.forgedPlan;
    void input.forgedBrief;

    if (input.additionalBriefIds && input.additionalBriefIds.length > 0) {
      throw new StrategicPlanError(
        'MULTI_BRIEF_AGGREGATION_DENIED',
        'Cannot aggregate multiple Briefs into one StrategicPlan revision.'
      );
    }

    const tenant = {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    };

    const prior = loadAuthoritativePlan(deps.plans, input.trusted, input.priorPlanId);
    const briefId = input.strategicBriefId ?? prior.strategicBriefId;
    const brief = loadAuthoritativeBrief(deps.briefs, input.trusted, briefId);
    requireApprovedCurrentBrief(brief);
    const briefCtx = toPlanBriefContext(brief);

    const builtItems: PlanItem[] = [];
    for (const draft of input.items) {
      let item = unwrapDomain(
        createPlanItem({
          id: draft.id,
          planId: input.nextPlanId,
          organizationId: prior.organizationId,
          clientId: prior.clientId,
          action: draft.action,
          order: draft.order,
          rationale: draft.rationale,
          channel: draft.channel ?? brief.recommendedChannel,
          format: draft.format ?? brief.recommendedFormat,
          riskNotes: draft.riskNotes,
          createdAt: input.trusted.now,
          briefAuthorizedAction: briefCtx.authorizedAction,
          planTenant: {
            organizationId: prior.organizationId,
            clientId: prior.clientId,
          },
        })
      );
      if (draft.markReady !== false) {
        item = unwrapDomain(transitionPlanItemStatus(item, 'READY', input.trusted.now));
      }
      builtItems.push(item);
    }

    const revised = unwrapDomain(
      reviseStrategicPlanMaterial(
        prior,
        input.nextPlanId,
        input.trusted.actorId,
        input.trusted.now,
        briefCtx,
        input.rationale,
        builtItems
      )
    );

    const materialHash = planMaterialFingerprint(revised.next);
    const idemKey = revisePlanIdempotencyKey(prior.id, materialHash);
    const existing = deps.plans.findByIdempotencyKey(tenant, idemKey);
    if (existing) {
      const next = deps.plans.getById(existing.planId, tenant);
      const priorReloaded = deps.plans.getById(prior.id, tenant) ?? revised.prior;
      if (next) {
        return { prior: priorReloaded, next, writeUnitCommitted: false };
      }
    }

    const histPrior = planHistoryIntent('PLAN_SUPERSEDED', revised.prior, {
      actorId: input.trusted.actorId,
    });
    const histNext = planHistoryIntent('MATERIAL_REVISED', revised.next, {
      actorId: input.trusted.actorId,
    });

    const persist = input.persist !== false;
    if (persist) {
      commitGovernedPlanWriteUnit(deps.plans, deps.history, {
        plans: [revised.prior, revised.next],
        history: [
          {
            id: `hist_${revised.prior.id}_superseded`,
            organizationId: revised.prior.organizationId,
            clientId: revised.prior.clientId,
            planId: histPrior.planId,
            planVersion: histPrior.planVersion,
            event: histPrior.event,
            actorId: input.trusted.actorId,
            at: input.trusted.now,
          },
          {
            id: `hist_${revised.next.id}_revised`,
            organizationId: revised.next.organizationId,
            clientId: revised.next.clientId,
            planId: histNext.planId,
            planVersion: histNext.planVersion,
            event: histNext.event,
            actorId: input.trusted.actorId,
            at: input.trusted.now,
          },
        ],
        idempotencyKeys: [
          {
            key: idemKey,
            planId: revised.next.id,
            organizationId: tenant.organizationId,
            clientId: tenant.clientId,
            at: input.trusted.now,
          },
        ],
      });
    }

    return {
      prior: revised.prior,
      next: revised.next,
      writeUnitCommitted: persist,
    };
  };
}
