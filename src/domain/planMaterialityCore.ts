/**
 * SPEC-004 Phase 1 — Materiality fingerprint + change detection (pure).
 */

import type { StrategicPlan } from './strategicPlanCore';
import type { PlanItem } from './planItemCore';
import { planFail, planOk, type PlanDomainResult } from './strategicPlanErrors';

function uniqueSorted(ids: readonly string[]): string[] {
  return [...new Set(ids)].slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function itemMaterial(item: PlanItem): Record<string, unknown> {
  return {
    id: item.id,
    action: item.action,
    order: item.order,
    rationale: item.rationale,
    channel: item.channel,
    format: item.format,
    riskNotes: uniqueSorted(item.riskNotes),
  };
}

export interface PlanMaterialSnapshot {
  organizationId: string;
  clientId: string;
  strategicBriefId: string;
  strategicBriefVersion: number;
  thesisId: string;
  signalIds: string[];
  authorizedAction: string;
  rationale: string;
  priorityBand: string | null;
  items: Record<string, unknown>[];
}

/**
 * Material fields (planner-model.md). Timestamps, schemaVersion, createdBy,
 * aiAdvisoryRefs, and supersede pointers are non-material on their own.
 */
export function toPlanMaterialSnapshot(plan: StrategicPlan): PlanMaterialSnapshot {
  const items = [...plan.items]
    .map(itemMaterial)
    .sort((a, b) => {
      const ao = a.order as number;
      const bo = b.order as number;
      if (ao !== bo) return ao - bo;
      return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
    });
  return {
    organizationId: plan.organizationId,
    clientId: plan.clientId,
    strategicBriefId: plan.strategicBriefId,
    strategicBriefVersion: plan.strategicBriefVersion,
    thesisId: plan.thesisId,
    signalIds: uniqueSorted(plan.signalIds),
    authorizedAction: plan.authorizedAction,
    rationale: plan.rationale,
    priorityBand: plan.priorityBand,
    items,
  };
}

export function planMaterialFingerprint(plan: StrategicPlan): string {
  return JSON.stringify(toPlanMaterialSnapshot(plan));
}

export function isPlanMateriallyEqual(a: StrategicPlan, b: StrategicPlan): boolean {
  return planMaterialFingerprint(a) === planMaterialFingerprint(b);
}

export function assertApprovedPlanNotMateriallyMutatedInPlace(
  before: StrategicPlan,
  after: StrategicPlan
): PlanDomainResult<void> {
  if (before.status !== 'APPROVED' && before.status !== 'ACTIVE') {
    return planOk(undefined);
  }
  if (before.id !== after.id || before.version !== after.version) {
    return planOk(undefined);
  }
  if (!isPlanMateriallyEqual(before, after)) {
    return planFail(
      'MATERIAL_CHANGE_REQUIRES_REVISION',
      'material change on APPROVED/ACTIVE plan requires revision/supersession'
    );
  }
  return planOk(undefined);
}

/** Idempotency identity helpers for later Application (no persistence). */
export function createPlanIdempotencyKey(input: {
  organizationId: string;
  clientId: string;
  strategicBriefId: string;
  strategicBriefVersion: number;
  intentKey: string;
}): string {
  return [
    'plan-create',
    input.organizationId,
    input.clientId,
    input.strategicBriefId,
    String(input.strategicBriefVersion),
    input.intentKey,
  ].join('|');
}

export function addPlanItemIdempotencyKey(input: {
  planId: string;
  action: string;
  order: number;
  intentKey: string;
}): string {
  return ['plan-item-add', input.planId, input.action, String(input.order), input.intentKey].join(
    '|'
  );
}

export function approvePlanIdempotencyKey(planId: string, version: number): string {
  return ['plan-approve', planId, String(version)].join('|');
}

export function activatePlanItemIdempotencyKey(
  planItemId: string,
  planVersion: number
): string {
  return ['plan-item-activate', planItemId, String(planVersion)].join('|');
}

export function revisePlanIdempotencyKey(priorPlanId: string, materialHash: string): string {
  return ['plan-revise', priorPlanId, materialHash].join('|');
}

/** Material history event intents (persistence later). Not current authority. */
export const PLAN_MATERIAL_HISTORY_EVENTS = [
  'PLAN_CREATED',
  'ITEM_ADDED',
  'ITEM_REMOVED',
  'MATERIAL_REVISED',
  'PLAN_APPROVED',
  'PLAN_REJECTED',
  'PLAN_ACTIVATED',
  'ITEM_ACTIVATED',
  'ITEM_COMPLETED',
  'ITEM_CANCELLED',
  'PLAN_CANCELLED',
  'PLAN_COMPLETED',
  'PLAN_SUPERSEDED',
] as const;
export type PlanMaterialHistoryEvent = (typeof PLAN_MATERIAL_HISTORY_EVENTS)[number];

export interface PlanHistoryIntent {
  event: PlanMaterialHistoryEvent;
  planId: string;
  planVersion: number;
  itemId?: string;
  actorId?: string;
  note?: string;
}

export function planHistoryIntent(
  event: PlanMaterialHistoryEvent,
  plan: StrategicPlan,
  extras?: { itemId?: string; actorId?: string; note?: string }
): PlanHistoryIntent {
  return {
    event,
    planId: plan.id,
    planVersion: plan.version,
    itemId: extras?.itemId,
    actorId: extras?.actorId,
    note: extras?.note,
  };
}
