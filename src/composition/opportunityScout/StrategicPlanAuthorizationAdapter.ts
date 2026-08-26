/**
 * SPEC-007 Phase 4 — SPEC-004 StrategicPlanAuthorizationPort adapter.
 * Consumes existing Planner authorize — does not reimplement or bypass Planner.
 */

import type {
  StrategicPlanAuthorizationDecision,
  StrategicPlanAuthorizationPort,
  StrategicPlanAuthorizationRequest,
} from '../../application/opportunityScout';
import {
  getStrategicPlan,
  requirePlannedAuthorization,
} from '../../services/strategicPlanConsumer';

function denyDecision(
  request: StrategicPlanAuthorizationRequest,
  disposition: StrategicPlanAuthorizationDecision['disposition'],
  reasons: string[],
  over: Partial<StrategicPlanAuthorizationDecision> = {}
): StrategicPlanAuthorizationDecision {
  return {
    disposition,
    allowed: false,
    action: over.action ?? 'NONE',
    organizationId: request.tenant.organizationId,
    clientId: request.tenant.clientId,
    thesisId: over.thesisId ?? '',
    strategicBriefId: over.strategicBriefId ?? '',
    strategicBriefVersion: over.strategicBriefVersion ?? 0,
    strategicPlanId: request.planId,
    strategicPlanVersion: over.strategicPlanVersion ?? 0,
    planItemId: request.planItemId,
    planStatus: over.planStatus ?? 'UNKNOWN',
    reasons,
    ...over,
  };
}

/**
 * Live adapter: Plan decision from requirePlannedAuthorization / current Plan.
 * Caller-forged Plan/Brief/allowed flags never establish authority.
 */
export function createStrategicPlanAuthorizationAdapter(): StrategicPlanAuthorizationPort {
  return {
    authorizeCreateOpportunity(
      request: StrategicPlanAuthorizationRequest
    ): StrategicPlanAuthorizationDecision {
      void request.actorKind;

      const plan = getStrategicPlan(request.planId, request.tenant.clientId);
      if (!plan) {
        return denyDecision(request, 'DENY', ['PLAN_NOT_FOUND']);
      }
      if (
        plan.organizationId !== request.tenant.organizationId ||
        plan.clientId !== request.tenant.clientId
      ) {
        return denyDecision(request, 'DENY', ['TENANT_MISMATCH'], {
          planStatus: plan.status,
          strategicPlanVersion: plan.version,
        });
      }

      const planned = requirePlannedAuthorization({
        clientId: request.tenant.clientId,
        briefId: plan.strategicBriefId,
        requestedAction: 'CREATE_OPPORTUNITY',
        planId: request.planId,
        planItemId: request.planItemId,
        forgedPlan: undefined,
        forgedBrief: undefined,
      });

      if (!planned.authorized) {
        const code = planned.denialCode ?? 'PLAN_NOT_APPROVED';
        let disposition: StrategicPlanAuthorizationDecision['disposition'] = 'DENY';
        if (code === 'ACTION_NOT_AUTHORIZED') {
          const auth = planned.authorizedAction;
          if (auth === 'NONE') disposition = 'NONE';
          else if (auth === 'RESEARCH_ONLY') disposition = 'RESEARCH_ONLY';
        }
        return denyDecision(request, disposition, [
          planned.denialReason ?? code,
          ...(planned.reasons ?? []),
        ], {
          action: planned.authorizedAction ?? 'NONE',
          thesisId: planned.thesisId ?? plan.thesisId,
          strategicBriefId: planned.briefId || plan.strategicBriefId,
          strategicBriefVersion:
            planned.briefVersion ?? plan.strategicBriefVersion,
          strategicPlanVersion: planned.planVersion ?? plan.version,
          planStatus: plan.status,
        });
      }

      if (planned.authorizedAction && planned.authorizedAction !== 'CREATE_OPPORTUNITY') {
        const disposition =
          planned.authorizedAction === 'NONE'
            ? 'NONE'
            : planned.authorizedAction === 'RESEARCH_ONLY'
              ? 'RESEARCH_ONLY'
              : 'DENY';
        return denyDecision(request, disposition, ['WRONG_ACTION'], {
          action: planned.authorizedAction,
          thesisId: planned.thesisId ?? plan.thesisId,
          strategicBriefId: planned.briefId,
          strategicBriefVersion:
            planned.briefVersion ?? plan.strategicBriefVersion,
          strategicPlanVersion: planned.planVersion ?? plan.version,
          planStatus: plan.status,
        });
      }

      return {
        disposition: 'ALLOW',
        allowed: true,
        action: 'CREATE_OPPORTUNITY',
        organizationId: request.tenant.organizationId,
        clientId: request.tenant.clientId,
        thesisId: planned.thesisId ?? plan.thesisId,
        strategicBriefId: planned.briefId,
        strategicBriefVersion:
          planned.briefVersion ?? plan.strategicBriefVersion,
        strategicPlanId: planned.planId ?? plan.id,
        strategicPlanVersion: planned.planVersion ?? plan.version,
        planItemId: planned.planItemId ?? request.planItemId,
        planStatus: plan.status,
        reasons: planned.reasons ?? ['ALLOW'],
      };
    },
  };
}
