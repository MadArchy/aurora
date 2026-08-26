import { assertBriefContextCurrentForPlan } from '../../domain/planBriefContextCore';
import { projectStrategicPlanExplainability } from '../../domain/planExplainabilityCore';
import type { StrategicPlanExplainability } from '../../domain/planExplainabilityCore';
import type { StrategicPlan } from '../../domain/strategicPlanCore';
import {
  loadAuthoritativeBrief,
  toPlanBriefContext,
} from './briefProjection';
import { loadAuthoritativePlan } from './loadPlan';
import { unwrapDomain } from './mapDomainError';
import type { StrategicBriefReader } from './ports/StrategicBriefReader';
import type { StrategicPlanRepository } from './ports/StrategicPlanRepository';
import {
  assertNoTenantSpoof,
  assertTrustedPlanActor,
  type TrustedPlanActorContext,
} from './trustedContext';

export interface RevalidatePlanAgainstBriefInput {
  trusted: TrustedPlanActorContext;
  planId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedBrief?: unknown;
  forgedPlan?: unknown;
}

export interface RevalidatePlanAgainstBriefResult {
  valid: boolean;
  plan: StrategicPlan;
  explainability: StrategicPlanExplainability;
  briefId: string;
  briefVersion: number;
  briefStatus: string;
}

export interface RevalidatePlanAgainstBriefDeps {
  plans: StrategicPlanRepository;
  briefs: StrategicBriefReader;
}

/**
 * Load current Plan + current Brief and apply Domain stale predicates.
 * Does not mutate Plan or Brief.
 */
export function createRevalidatePlanAgainstBrief(deps: RevalidatePlanAgainstBriefDeps) {
  return function revalidatePlanAgainstBrief(
    input: RevalidatePlanAgainstBriefInput
  ): RevalidatePlanAgainstBriefResult {
    assertTrustedPlanActor(input.trusted);
    assertNoTenantSpoof(input);
    void input.forgedBrief;
    void input.forgedPlan;

    const plan = loadAuthoritativePlan(deps.plans, input.trusted, input.planId);
    const brief = loadAuthoritativeBrief(
      deps.briefs,
      input.trusted,
      plan.strategicBriefId
    );
    const briefCtx = toPlanBriefContext(brief);

    unwrapDomain(
      assertBriefContextCurrentForPlan(
        {
          strategicBriefId: plan.strategicBriefId,
          strategicBriefVersion: plan.strategicBriefVersion,
          thesisId: plan.thesisId,
          organizationId: plan.organizationId,
          clientId: plan.clientId,
        },
        briefCtx
      )
    );

    return {
      valid: true,
      plan,
      explainability: projectStrategicPlanExplainability(plan),
      briefId: brief.id,
      briefVersion: brief.version,
      briefStatus: brief.status,
    };
  };
}
