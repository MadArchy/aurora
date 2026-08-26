import {
  transitionPlanStatus,
  type StrategicPlan,
} from '../../domain/strategicPlanCore';
import {
  loadAuthoritativeBrief,
  requireApprovedCurrentBrief,
} from './briefProjection';
import { commitGovernedPlanWriteUnit } from './commitWriteUnit';
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

export interface ProposeStrategicPlanInput {
  trusted: TrustedPlanActorContext;
  planId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Caller-forged status — IGNORED. */
  forgedStatus?: string;
  forgedPlan?: unknown;
  persist?: boolean;
}

export interface ProposeStrategicPlanResult {
  plan: StrategicPlan;
  writeUnitCommitted: boolean;
}

export interface ProposeStrategicPlanDeps {
  plans: StrategicPlanRepository;
  history: StrategicPlanHistoryPort;
  briefs: StrategicBriefReader;
}

export function createProposeStrategicPlan(deps: ProposeStrategicPlanDeps) {
  return function proposeStrategicPlan(
    input: ProposeStrategicPlanInput
  ): ProposeStrategicPlanResult {
    assertTrustedPlanActor(input.trusted);
    assertNoTenantSpoof(input);
    void input.forgedStatus;
    void input.forgedPlan;

    const current = loadAuthoritativePlan(deps.plans, input.trusted, input.planId);
    const brief = loadAuthoritativeBrief(
      deps.briefs,
      input.trusted,
      current.strategicBriefId
    );
    requireApprovedCurrentBrief(brief);

    const actorKind = resolveTrustedActorKind(input.trusted, 'mutate');
    const plan = unwrapDomain(
      transitionPlanStatus(current, 'PROPOSED', {
        actorKind,
        updatedAt: input.trusted.now,
      })
    );

    const persist = input.persist !== false;
    if (persist) {
      commitGovernedPlanWriteUnit(deps.plans, deps.history, {
        plans: [plan],
        history: [],
      });
    }

    return { plan, writeUnitCommitted: persist };
  };
}
