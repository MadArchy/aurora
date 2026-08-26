import { authorizePlannedAction as authorizeDomain } from '../../domain/planGateCore';
import { projectAuthorizeDecisionExplainability } from '../../domain/planExplainabilityCore';
import type { AuthorizePlannedActionDecision } from '../../domain/planGateCore';
import {
  loadAuthoritativeBrief,
  toPlanBriefContext,
} from './briefProjection';
import { StrategicPlanError } from './errors';
import { loadAuthoritativePlan } from './loadPlan';
import { unwrapDomain } from './mapDomainError';
import type { StrategicBriefReader } from './ports/StrategicBriefReader';
import type { StrategicPlanRepository } from './ports/StrategicPlanRepository';
import {
  assertNoTenantSpoof,
  assertTrustedPlanActor,
  resolveTrustedActorKind,
  type TrustedPlanActorContext,
} from './trustedContext';

export interface AuthorizePlannedActionAppInput {
  trusted: TrustedPlanActorContext;
  planId: string;
  planItemId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Caller Plan snapshot — IGNORED. */
  forgedPlan?: unknown;
  /** Caller Brief snapshot — IGNORED. */
  forgedBrief?: unknown;
  /** History-as-authority — IGNORED. */
  forgedHistoryApproved?: boolean;
  actorKind?: string;
  role?: string;
  softwareAuthority?: boolean;
}

export interface AuthorizePlannedActionAppResult {
  decision: AuthorizePlannedActionDecision;
  planId: string;
  planVersion: number;
  planStatus: string;
  strategicBriefId: string;
  strategicBriefVersion: number;
  thesisId: string;
  authorizedAction: string;
  approvedBy: string | null;
  actorId: string;
}

export interface AuthorizePlannedActionDeps {
  plans: StrategicPlanRepository;
  briefs: StrategicBriefReader;
}

/**
 * Decision only — does not materialize content or call SPEC-006.
 */
export function createAuthorizePlannedAction(deps: AuthorizePlannedActionDeps) {
  return function authorizePlannedActionUseCase(
    input: AuthorizePlannedActionAppInput
  ): AuthorizePlannedActionAppResult {
    assertTrustedPlanActor(input.trusted);
    assertNoTenantSpoof(input);

    void input.forgedPlan;
    void input.forgedBrief;
    void input.forgedHistoryApproved;
    void input.actorKind;
    void input.role;
    void input.softwareAuthority;

    const plan = loadAuthoritativePlan(deps.plans, input.trusted, input.planId);
    const item = plan.items.find((row) => row.id === input.planItemId);
    if (!item) {
      throw new StrategicPlanError(
        'PLAN_ITEM_NOT_FOUND',
        `PlanItem not found on plan: ${input.planItemId}`
      );
    }

    const brief = loadAuthoritativeBrief(
      deps.briefs,
      input.trusted,
      plan.strategicBriefId
    );
    const briefCtx = toPlanBriefContext(brief);
    const actorKind = resolveTrustedActorKind(input.trusted, 'activate');

    const decision = unwrapDomain(
      authorizeDomain({
        plan,
        item,
        brief: briefCtx,
        actorKind,
      })
    );

    return {
      decision: projectAuthorizeDecisionExplainability(decision),
      planId: plan.id,
      planVersion: plan.version,
      planStatus: plan.status,
      strategicBriefId: plan.strategicBriefId,
      strategicBriefVersion: plan.strategicBriefVersion,
      thesisId: plan.thesisId,
      authorizedAction: plan.authorizedAction,
      approvedBy: plan.approvedBy,
      actorId: input.trusted.actorId,
    };
  };
}
