import {
  transitionPlanStatus,
  type StrategicPlan,
} from '../../domain/strategicPlanCore';
import {
  approvePlanIdempotencyKey,
  planHistoryIntent,
} from '../../domain/planMaterialityCore';
import {
  loadAuthoritativeBrief,
  requireApprovedCurrentBrief,
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

export interface ApproveStrategicPlanInput {
  trusted: TrustedPlanActorContext;
  planId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Ignored — approval identity comes from trusted actor. */
  approvedBy?: string;
  /** Ignored — AI / caller actorKind never authority. */
  actorKind?: string;
  actorType?: string;
  role?: string;
  softwareAuthority?: boolean;
  forgedPlan?: unknown;
  forgedBrief?: unknown;
  persist?: boolean;
}

export interface ApproveStrategicPlanResult {
  plan: StrategicPlan;
  alreadyApproved: boolean;
  writeUnitCommitted: boolean;
}

export interface RejectStrategicPlanInput {
  trusted: TrustedPlanActorContext;
  planId: string;
  reason: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  approvedBy?: string;
  actorKind?: string;
  forgedPlan?: unknown;
  persist?: boolean;
}

export interface RejectStrategicPlanResult {
  plan: StrategicPlan;
  writeUnitCommitted: boolean;
}

export interface ApproveRejectDeps {
  plans: StrategicPlanRepository;
  history: StrategicPlanHistoryPort;
  briefs: StrategicBriefReader;
}

export function createApproveStrategicPlan(deps: ApproveRejectDeps) {
  return function approveStrategicPlan(
    input: ApproveStrategicPlanInput
  ): ApproveStrategicPlanResult {
    assertTrustedPlanActor(input.trusted);
    assertNoTenantSpoof(input);

    // Explicitly discard caller-forged authority fields.
    void input.approvedBy;
    void input.actorKind;
    void input.actorType;
    void input.role;
    void input.softwareAuthority;
    void input.forgedPlan;
    void input.forgedBrief;

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
        'Cannot approve plan against stale Brief revision.'
      );
    }
    if (brief.thesisId !== current.thesisId) {
      throw new StrategicPlanError(
        'THESIS_MISMATCH',
        'Brief thesisId does not match plan thesisId.'
      );
    }

    if (current.status === 'APPROVED' || current.status === 'ACTIVE') {
      return { plan: current, alreadyApproved: true, writeUnitCommitted: false };
    }

    const actorKind = resolveTrustedActorKind(input.trusted, 'approve');
    const plan = unwrapDomain(
      transitionPlanStatus(current, 'APPROVED', {
        actorKind,
        updatedAt: input.trusted.now,
        approvedBy: input.trusted.actorId,
      })
    );

    const idemKey = approvePlanIdempotencyKey(plan.id, plan.version);
    const hist = planHistoryIntent('PLAN_APPROVED', plan, {
      actorId: input.trusted.actorId,
    });

    const persist = input.persist !== false;
    if (persist) {
      commitGovernedPlanWriteUnit(deps.plans, deps.history, {
        plans: [plan],
        history: [
          {
            id: `hist_${plan.id}_approved_${plan.version}`,
            organizationId: plan.organizationId,
            clientId: plan.clientId,
            planId: hist.planId,
            planVersion: hist.planVersion,
            event: hist.event,
            actorId: input.trusted.actorId,
            at: input.trusted.now,
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

    return { plan, alreadyApproved: false, writeUnitCommitted: persist };
  };
}

export function createRejectStrategicPlan(deps: ApproveRejectDeps) {
  return function rejectStrategicPlan(
    input: RejectStrategicPlanInput
  ): RejectStrategicPlanResult {
    assertTrustedPlanActor(input.trusted);
    assertNoTenantSpoof(input);
    void input.approvedBy;
    void input.actorKind;
    void input.forgedPlan;

    if (!input.reason?.trim()) {
      throw new StrategicPlanError('INVALID_PLAN', 'Reject reason is required.');
    }

    const current = loadAuthoritativePlan(deps.plans, input.trusted, input.planId);
    const brief = loadAuthoritativeBrief(
      deps.briefs,
      input.trusted,
      current.strategicBriefId
    );
    // Rejection does not require Brief still APPROVED, but tenant must match if Brief exists.
    void brief;

    const actorKind = resolveTrustedActorKind(input.trusted, 'approve');
    const plan = unwrapDomain(
      transitionPlanStatus(current, 'REJECTED', {
        actorKind,
        updatedAt: input.trusted.now,
      })
    );

    const hist = planHistoryIntent('PLAN_REJECTED', plan, {
      actorId: input.trusted.actorId,
      note: input.reason.trim(),
    });

    const persist = input.persist !== false;
    if (persist) {
      commitGovernedPlanWriteUnit(deps.plans, deps.history, {
        plans: [plan],
        history: [
          {
            id: `hist_${plan.id}_rejected_${plan.version}`,
            organizationId: plan.organizationId,
            clientId: plan.clientId,
            planId: hist.planId,
            planVersion: hist.planVersion,
            event: hist.event,
            actorId: input.trusted.actorId,
            at: input.trusted.now,
            note: input.reason.trim(),
          },
        ],
      });
    }

    return { plan, writeUnitCommitted: persist };
  };
}
