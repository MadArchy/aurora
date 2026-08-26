import {
  createStrategicPlan,
  type StrategicPlan,
} from '../../domain/strategicPlanCore';
import {
  createPlanIdempotencyKey,
  planHistoryIntent,
} from '../../domain/planMaterialityCore';
import {
  loadAuthoritativeBrief,
  requireApprovedCurrentBrief,
  toPlanBriefContext,
} from './briefProjection';
import { commitGovernedPlanWriteUnit } from './commitWriteUnit';
import { StrategicPlanError } from './errors';
import { unwrapDomain } from './mapDomainError';
import type { StrategicBriefReader } from './ports/StrategicBriefReader';
import type { StrategicPlanHistoryPort } from './ports/StrategicPlanHistoryPort';
import type { StrategicPlanRepository } from './ports/StrategicPlanRepository';
import {
  assertNoTenantSpoof,
  assertTrustedPlanActor,
  type TrustedPlanActorContext,
} from './trustedContext';

export interface CreateStrategicPlanInput {
  trusted: TrustedPlanActorContext;
  planId: string;
  strategicBriefId: string;
  rationale: string;
  intentKey: string;
  priorityBand?: string | null;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Ignored — multi-Brief aggregation denied. */
  additionalBriefIds?: string[];
  /** Ignored — thesis comes from Brief. */
  claimedThesisId?: string;
  /** Ignored — createdBy comes from trusted actor. */
  createdBy?: string;
  /** Caller Brief snapshot — IGNORED; Application loads via StrategicBriefReader. */
  forgedBrief?: unknown;
  /** Caller Plan snapshot — IGNORED. */
  forgedPlan?: unknown;
  persist?: boolean;
}

export interface CreateStrategicPlanResult {
  plan: StrategicPlan;
  created: boolean;
  writeUnitCommitted: boolean;
}

export interface CreateStrategicPlanDeps {
  plans: StrategicPlanRepository;
  history: StrategicPlanHistoryPort;
  briefs: StrategicBriefReader;
}

export function createCreateStrategicPlan(deps: CreateStrategicPlanDeps) {
  return function createStrategicPlanUseCase(
    input: CreateStrategicPlanInput
  ): CreateStrategicPlanResult {
    assertTrustedPlanActor(input.trusted);
    assertNoTenantSpoof(input);

    void input.forgedBrief;
    void input.forgedPlan;
    void input.createdBy;
    void input.claimedThesisId;

    if (input.additionalBriefIds && input.additionalBriefIds.length > 0) {
      throw new StrategicPlanError(
        'MULTI_BRIEF_AGGREGATION_DENIED',
        'Cannot aggregate multiple Briefs into one StrategicPlan.'
      );
    }

    const intentKey = input.intentKey?.trim();
    if (!intentKey) {
      throw new StrategicPlanError('INVALID_PLAN', 'intentKey is required for create idempotency.');
    }

    const tenant = {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    };

    const brief = loadAuthoritativeBrief(deps.briefs, input.trusted, input.strategicBriefId);
    requireApprovedCurrentBrief(brief);
    const briefCtx = toPlanBriefContext(brief);

    const idemKey = createPlanIdempotencyKey({
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      strategicBriefId: brief.id,
      strategicBriefVersion: brief.version,
      intentKey,
    });

    const existingKey = deps.plans.findByIdempotencyKey(tenant, idemKey);
    if (existingKey) {
      const existing = deps.plans.getById(existingKey.planId, tenant);
      if (existing) {
        return { plan: existing, created: false, writeUnitCommitted: false };
      }
    }

    const currentForBrief = deps.plans.findCurrentByBriefRevision(
      tenant,
      brief.id,
      brief.version
    );
    if (currentForBrief && currentForBrief.status !== 'SUPERSEDED') {
      // Same Brief revision already has a current plan — idempotent if same id, else conflict.
      if (currentForBrief.id === input.planId) {
        return { plan: currentForBrief, created: false, writeUnitCommitted: false };
      }
      throw new StrategicPlanError(
        'IDEMPOTENCY_CONFLICT',
        'A current StrategicPlan already exists for this Brief revision.'
      );
    }

    const byId = deps.plans.getById(input.planId, tenant);
    if (byId) {
      throw new StrategicPlanError(
        'IDEMPOTENCY_CONFLICT',
        `Plan id already exists: ${input.planId}`
      );
    }

    const plan = unwrapDomain(
      createStrategicPlan({
        id: input.planId,
        createdBy: input.trusted.actorId,
        createdAt: input.trusted.now,
        rationale: input.rationale,
        brief: briefCtx,
        priorityBand: input.priorityBand,
      })
    );

    const historyIntent = planHistoryIntent('PLAN_CREATED', plan, {
      actorId: input.trusted.actorId,
    });
    const historyRecord = {
      id: `hist_${plan.id}_created_${plan.version}`,
      organizationId: plan.organizationId,
      clientId: plan.clientId,
      planId: historyIntent.planId,
      planVersion: historyIntent.planVersion,
      event: historyIntent.event,
      actorId: input.trusted.actorId,
      at: input.trusted.now,
    };

    const persist = input.persist !== false;
    if (persist) {
      commitGovernedPlanWriteUnit(deps.plans, deps.history, {
        plans: [plan],
        history: [historyRecord],
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

    return { plan, created: true, writeUnitCommitted: persist };
  };
}
