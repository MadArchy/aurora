/**
 * SPEC-004 Phase 1 — Explainability projection (pure).
 */

import type { StrategicPlan } from './strategicPlanCore';
import type { PlanItem } from './planItemCore';
import type { AuthorizePlannedActionDecision } from './planGateCore';

export interface StrategicPlanExplainability {
  planId: string;
  planVersion: number;
  planStatus: string;
  strategicBriefId: string;
  strategicBriefVersion: number;
  thesisId: string;
  authorizedAction: string;
  rationale: string;
  approvedBy: string | null;
  priorityBand: string | null;
  signalIds: string[];
  aiAdvisoryRefs: unknown[];
  items: Array<{
    id: string;
    action: string;
    status: string;
    order: number;
    rationale: string;
    channel: string | null;
    format: string | null;
    riskNotes: string[];
  }>;
}

export function projectStrategicPlanExplainability(
  plan: StrategicPlan
): StrategicPlanExplainability {
  return {
    planId: plan.id,
    planVersion: plan.version,
    planStatus: plan.status,
    strategicBriefId: plan.strategicBriefId,
    strategicBriefVersion: plan.strategicBriefVersion,
    thesisId: plan.thesisId,
    authorizedAction: plan.authorizedAction,
    rationale: plan.rationale,
    approvedBy: plan.approvedBy,
    priorityBand: plan.priorityBand,
    signalIds: [...plan.signalIds],
    aiAdvisoryRefs: [...plan.aiAdvisoryRefs],
    items: plan.items.map((item: PlanItem) => ({
      id: item.id,
      action: item.action,
      status: item.status,
      order: item.order,
      rationale: item.rationale,
      channel: item.channel,
      format: item.format,
      riskNotes: [...item.riskNotes],
    })),
  };
}

export function projectAuthorizeDecisionExplainability(
  decision: AuthorizePlannedActionDecision
): AuthorizePlannedActionDecision {
  return { ...decision, reasons: [...decision.reasons] };
}
