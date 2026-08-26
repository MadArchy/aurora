/**
 * SPEC-004 Phase 4 — Consumer facade for Strategic Planner.
 * Composition root for main/UI. Does not treat CurationEntry as Plan authority.
 */

import type {
  StrategicAuthorizedAction,
  StrategicDownstreamAction,
} from '../domain/strategicBriefCore';
import { STRATEGIC_DOWNSTREAM_ACTIONS } from '../domain/strategicBriefCore';
import { StrategicPlanError } from '../application/strategicPlan';
import type { TrustedPlanActorContext } from '../application/strategicPlan';
import { composeStrategicPlan } from '../composition/strategicPlan/composeStrategicPlan';
import {
  createLocalStrategicPlanStore,
  LocalStrategicPlanStore,
} from '../infrastructure/strategicPlan';
import { authService } from './auth';
import { dbService } from './db';
import {
  formatAuthorizationDenial,
  getStrategicBrief,
  requireStrategicAuthorization,
} from './strategicBriefConsumer';

type PlanUseCases = ReturnType<typeof composeStrategicPlan>;

let store: LocalStrategicPlanStore = createLocalStrategicPlanStore();
let useCases: PlanUseCases = buildUseCases(store);

function buildUseCases(planStore: LocalStrategicPlanStore): PlanUseCases {
  return composeStrategicPlan({
    store: planStore,
    briefs: {
      getById(briefId, tenant) {
        const brief = getStrategicBrief(briefId, tenant.clientId);
        if (!brief) return undefined;
        if (
          brief.organizationId !== tenant.organizationId ||
          brief.clientId !== tenant.clientId
        ) {
          return undefined;
        }
        return brief;
      },
    },
  });
}

/** Test-only reset — not production API. */
export function resetStrategicPlanConsumerForTest(
  nextStore?: LocalStrategicPlanStore
): void {
  store = nextStore ?? createLocalStrategicPlanStore();
  store.resetForTest();
  useCases = buildUseCases(store);
}

export function buildTrustedPlanContext(
  clientId: string,
  now?: string
): TrustedPlanActorContext | undefined {
  const user = authService.getCurrentUser();
  const organizationId = dbService.getClientById(clientId)?.organizationId;
  if (!user || !organizationId) return undefined;
  return {
    actorId: user.uid,
    actorRole: user.role === 'CLIENT' ? 'CLIENT' : 'ADMIN',
    organizationId,
    clientId,
    now: now ?? new Date().toISOString(),
  };
}

/**
 * CurationEntry is COMPATIBILITY intake only — never StrategicPlan authority.
 * Call sites must not use curation status/decision as plan APPROVED/ACTIVE.
 */
export function assertCurationNotPlanAuthority(_curationLike: unknown): void {
  // Structural ban helper for architecture/docs. No-op at runtime.
  void _curationLike;
}

export interface PlannedAuthorizationResult {
  authorized: boolean;
  briefId: string;
  briefVersion?: number;
  planId?: string;
  planVersion?: number;
  planItemId?: string;
  thesisId?: string;
  signalIds?: string[];
  evidenceIds?: string[];
  authorizedAction?: string;
  reasons?: string[];
  denialCode?: string;
  denialReason?: string;
}

/**
 * Canonical execution gate for strategic downstream actions.
 * Loads current Plan + Brief via Application — ignores caller snapshots.
 * Missing Plan = DENY (no CurationEntry / DeliveryPackage fallback).
 */
export function requirePlannedAuthorization(params: {
  clientId: string;
  briefId: string | undefined;
  requestedAction: StrategicAuthorizedAction;
  planId?: string;
  planItemId?: string;
  /** Caller-forged Plan — IGNORED. */
  forgedPlan?: unknown;
  /** Caller-forged Brief — IGNORED. */
  forgedBrief?: unknown;
  now?: string;
}): PlannedAuthorizationResult {
  void params.forgedPlan;
  void params.forgedBrief;

  if (!params.briefId?.trim()) {
    return {
      authorized: false,
      briefId: params.briefId ?? '',
      denialCode: 'BRIEF_NOT_FOUND',
      denialReason: 'strategicBriefId is required for planned downstream actions.',
    };
  }

  if (
    params.requestedAction === 'NONE' ||
    params.requestedAction === 'RESEARCH_ONLY' ||
    !(STRATEGIC_DOWNSTREAM_ACTIONS as readonly string[]).includes(params.requestedAction)
  ) {
    return {
      authorized: false,
      briefId: params.briefId,
      denialCode: 'ACTION_NOT_AUTHORIZED',
      denialReason: `Action ${params.requestedAction} is not an executable planned downstream action.`,
    };
  }

  const downstreamAction = params.requestedAction as StrategicDownstreamAction;

  // SPEC-003 Brief gate first (upstream).
  const briefAuth = requireStrategicAuthorization({
    clientId: params.clientId,
    briefId: params.briefId,
    requestedAction: downstreamAction,
  });
  if (!briefAuth.authorized) {
    return {
      authorized: false,
      briefId: params.briefId,
      denialCode: briefAuth.denialCode,
      denialReason: briefAuth.denialReason,
    };
  }

  const trusted = buildTrustedPlanContext(params.clientId, params.now);
  if (!trusted) {
    return {
      authorized: false,
      briefId: params.briefId,
      denialCode: 'TRUSTED_CONTEXT_REQUIRED',
      denialReason: 'Missing trusted actor context.',
    };
  }

  const brief = getStrategicBrief(params.briefId, params.clientId);
  if (!brief) {
    return {
      authorized: false,
      briefId: params.briefId,
      denialCode: 'BRIEF_NOT_FOUND',
      denialReason: 'Strategic Brief not found for trusted tenant.',
    };
  }

  try {
    const tenant = {
      organizationId: trusted.organizationId,
      clientId: trusted.clientId,
    };

    const plan = params.planId
      ? useCases.plans.getById(params.planId, tenant)
      : useCases.plans.findCurrentByBriefRevision(
          tenant,
          brief.id,
          brief.version
        );

    if (!plan) {
      return {
        authorized: false,
        briefId: brief.id,
        briefVersion: brief.version,
        thesisId: brief.thesisId,
        denialCode: 'PLAN_NOT_FOUND',
        denialReason:
          'No current StrategicPlan for this Brief revision. Create and approve a Plan before execution.',
      };
    }

    // Explicit planId still must bind to this Brief revision.
    if (
      plan.strategicBriefId !== brief.id ||
      plan.strategicBriefVersion !== brief.version
    ) {
      return {
        authorized: false,
        briefId: brief.id,
        briefVersion: brief.version,
        planId: plan.id,
        denialCode: 'BRIEF_REVISION_STALE',
        denialReason: 'Plan Brief binding does not match current Brief revision.',
      };
    }

    const candidates = plan.items.filter(
      (item) =>
        item.action === params.requestedAction &&
        (!params.planItemId || item.id === params.planItemId)
    );
    if (params.planItemId) {
      const exact = candidates.find((item) => item.id === params.planItemId);
      if (!exact) {
        return {
          authorized: false,
          briefId: brief.id,
          planId: plan.id,
          denialCode: 'PLAN_ITEM_NOT_FOUND',
          denialReason: `PlanItem not found: ${params.planItemId}`,
        };
      }
    } else {
      const ready = candidates.filter((item) => item.status === 'READY');
      if (ready.length === 0) {
        return {
          authorized: false,
          briefId: brief.id,
          planId: plan.id,
          planVersion: plan.version,
          denialCode: 'PLAN_ITEM_NOT_FOUND',
          denialReason: `No READY PlanItem for action ${params.requestedAction}.`,
        };
      }
      if (ready.length > 1) {
        return {
          authorized: false,
          briefId: brief.id,
          planId: plan.id,
          denialCode: 'IDEMPOTENCY_CONFLICT',
          denialReason:
            'Multiple READY PlanItems match this action — specify planItemId explicitly.',
        };
      }
    }

    const item =
      (params.planItemId
        ? plan.items.find((row) => row.id === params.planItemId)
        : plan.items.find(
            (row) =>
              row.action === params.requestedAction && row.status === 'READY'
          )) ?? undefined;
    if (!item) {
      return {
        authorized: false,
        briefId: brief.id,
        planId: plan.id,
        denialCode: 'PLAN_ITEM_NOT_FOUND',
        denialReason: 'PlanItem not eligible for authorization.',
      };
    }

    const result = useCases.authorize({
      trusted,
      planId: plan.id,
      planItemId: item.id,
      forgedPlan: params.forgedPlan,
      forgedBrief: params.forgedBrief,
    });

    if (!result.decision.allowed) {
      return {
        authorized: false,
        briefId: brief.id,
        briefVersion: brief.version,
        planId: plan.id,
        planVersion: plan.version,
        planItemId: item.id,
        thesisId: plan.thesisId,
        denialCode: 'PLAN_NOT_APPROVED',
        denialReason: result.decision.reasons.join('; ') || 'AuthorizePlannedAction denied.',
        reasons: result.decision.reasons,
      };
    }

    return {
      authorized: true,
      briefId: brief.id,
      briefVersion: brief.version,
      planId: plan.id,
      planVersion: plan.version,
      planItemId: item.id,
      thesisId: plan.thesisId,
      signalIds: [...plan.signalIds],
      evidenceIds: [...brief.supportingEvidenceIds],
      authorizedAction: plan.authorizedAction,
      reasons: result.decision.reasons,
    };
  } catch (err) {
    if (err instanceof StrategicPlanError) {
      return {
        authorized: false,
        briefId: params.briefId,
        denialCode: err.code,
        denialReason: err.message,
      };
    }
    return {
      authorized: false,
      briefId: params.briefId,
      denialCode: 'PERSISTENCE_ERROR',
      denialReason: 'Strategic Plan authorization failed.',
    };
  }
}

export function formatPlannedAuthorizationDenial(
  result: PlannedAuthorizationResult
): string {
  if (result.denialCode && result.denialReason) {
    return `${result.denialCode}: ${result.denialReason}`;
  }
  return formatAuthorizationDenial({
    authorized: false,
    briefId: result.briefId,
    denialCode: result.denialCode,
    denialReason: result.denialReason,
  });
}

/** Manager workflow: create DRAFT plan bound to current APPROVED Brief. */
export function createStrategicPlanFromBrief(params: {
  clientId: string;
  briefId: string;
  planId: string;
  rationale: string;
  intentKey: string;
  now?: string;
}) {
  const trusted = buildTrustedPlanContext(params.clientId, params.now);
  if (!trusted) throw new StrategicPlanError('TRUSTED_CONTEXT_REQUIRED', 'Trusted actor required.');
  return useCases.create({
    trusted,
    planId: params.planId,
    strategicBriefId: params.briefId,
    rationale: params.rationale,
    intentKey: params.intentKey,
  });
}

export function addStrategicPlanItem(params: {
  clientId: string;
  planId: string;
  itemId: string;
  action: StrategicAuthorizedAction;
  order: number;
  rationale: string;
  intentKey: string;
  now?: string;
}) {
  const trusted = buildTrustedPlanContext(params.clientId, params.now);
  if (!trusted) throw new StrategicPlanError('TRUSTED_CONTEXT_REQUIRED', 'Trusted actor required.');
  return useCases.addItem({
    trusted,
    planId: params.planId,
    itemId: params.itemId,
    action: params.action,
    order: params.order,
    rationale: params.rationale,
    intentKey: params.intentKey,
  });
}

export function proposeStrategicPlan(params: {
  clientId: string;
  planId: string;
  now?: string;
}) {
  const trusted = buildTrustedPlanContext(params.clientId, params.now);
  if (!trusted) throw new StrategicPlanError('TRUSTED_CONTEXT_REQUIRED', 'Trusted actor required.');
  return useCases.propose({ trusted, planId: params.planId });
}

export function approveStrategicPlan(params: {
  clientId: string;
  planId: string;
  /** Ignored — trusted actor wins. */
  approvedBy?: string;
  actorKind?: string;
  now?: string;
}) {
  const trusted = buildTrustedPlanContext(params.clientId, params.now);
  if (!trusted) throw new StrategicPlanError('TRUSTED_CONTEXT_REQUIRED', 'Trusted actor required.');
  return useCases.approve({
    trusted,
    planId: params.planId,
    approvedBy: params.approvedBy,
    actorKind: params.actorKind,
  });
}

export function getStrategicPlan(
  planId: string,
  clientId: string
): ReturnType<PlanUseCases['plans']['getById']> {
  const trusted = buildTrustedPlanContext(clientId);
  if (!trusted) return undefined;
  return useCases.plans.getById(planId, {
    organizationId: trusted.organizationId,
    clientId: trusted.clientId,
  });
}

export { StrategicPlanError };
