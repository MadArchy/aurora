/**
 * SPEC-004 Phase 1 — PlanItem entity + PlanItemStatus lifecycle (pure).
 */

import type { StrategicAuthorizedAction } from './strategicBriefCore';
import { isStrategicAuthorizedAction } from './strategicBriefCore';
import {
  assertActionAllowedByBrief,
  type PlanBriefContext,
} from './planBriefContextCore';
import { planFail, planOk, type PlanDomainResult } from './strategicPlanErrors';
import {
  assertPlanTenantStructure,
  assertPlanTenantsMatch,
  type PlanTenantEnvelope,
} from './planTenantCore';

export const PLAN_ITEM_SCHEMA_VERSION = 'plan-item-v1' as const;

export const PLAN_ITEM_STATUSES = [
  'PLANNED',
  'READY',
  'IN_PROGRESS',
  'DONE',
  'BLOCKED',
  'CANCELLED',
] as const;
export type PlanItemStatus = (typeof PLAN_ITEM_STATUSES)[number];

export const PLAN_ITEM_STATUS_TRANSITIONS: Record<
  PlanItemStatus,
  readonly PlanItemStatus[]
> = {
  PLANNED: ['READY', 'BLOCKED', 'CANCELLED'],
  READY: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED', 'PLANNED'],
  IN_PROGRESS: ['DONE', 'BLOCKED', 'CANCELLED'],
  DONE: [],
  BLOCKED: ['READY', 'PLANNED', 'CANCELLED'],
  CANCELLED: [],
};

export type PlanDownstreamRefKind = 'CONTENT' | 'OPPORTUNITY' | 'TASK' | 'OTHER';

export interface PlanDownstreamRef {
  kind: PlanDownstreamRefKind;
  id: string;
}

export interface PlanItem {
  id: string;
  planId: string;
  organizationId: string;
  clientId: string;
  action: StrategicAuthorizedAction;
  status: PlanItemStatus;
  order: number;
  rationale: string;
  channel: string | null;
  format: string | null;
  riskNotes: string[];
  downstreamRef: PlanDownstreamRef | null;
  createdAt: string;
  updatedAt: string;
  schemaVersion: typeof PLAN_ITEM_SCHEMA_VERSION;
}

export type PlanActorKind = 'HUMAN' | 'SOFTWARE' | 'AI';

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function isPlanItemStatus(value: unknown): value is PlanItemStatus {
  return typeof value === 'string' && (PLAN_ITEM_STATUSES as readonly string[]).includes(value);
}

export function canTransitionPlanItemStatus(
  from: PlanItemStatus,
  to: PlanItemStatus
): boolean {
  return PLAN_ITEM_STATUS_TRANSITIONS[from].includes(to);
}

export function transitionPlanItemStatus(
  item: PlanItem,
  to: PlanItemStatus,
  updatedAt: string
): PlanDomainResult<PlanItem> {
  if (!canTransitionPlanItemStatus(item.status, to)) {
    return planFail(
      'INVALID_ITEM_TRANSITION',
      `PlanItem cannot transition ${item.status} → ${to}`
    );
  }
  return planOk({ ...item, status: to, updatedAt });
}

export interface CreatePlanItemInput {
  id: string;
  planId: string;
  organizationId: string;
  clientId: string;
  action: StrategicAuthorizedAction;
  order: number;
  rationale: string;
  channel?: string | null;
  format?: string | null;
  riskNotes?: string[];
  createdAt: string;
  /** Brief authorizedAction upper bound (supplied context — not loaded). */
  briefAuthorizedAction: StrategicAuthorizedAction;
  /** Plan tenant for consistency. */
  planTenant: PlanTenantEnvelope;
}

/**
 * PlanItem cannot self-authorize: action must be allowed by Brief and not NONE-executable.
 */
export function createPlanItem(input: CreatePlanItemInput): PlanDomainResult<PlanItem> {
  const id = nonEmpty(input.id);
  const planId = nonEmpty(input.planId);
  const rationale = nonEmpty(input.rationale);
  if (!id || !planId || !rationale) {
    return planFail('INVALID_PLAN_ITEM', 'id, planId, and rationale are required');
  }
  if (!isStrategicAuthorizedAction(input.action)) {
    return planFail('INVALID_PLAN_ITEM', 'action is invalid');
  }
  if (input.action === 'NONE') {
    return planFail(
      'ACTION_NOT_AUTHORIZED',
      'NONE cannot create executable PlanItem authority'
    );
  }
  if (!Number.isInteger(input.order) || input.order < 0) {
    return planFail('INVALID_PLAN_ITEM', 'order must be integer >= 0');
  }
  const tenant = assertPlanTenantStructure(input);
  if (!tenant.ok) return tenant;
  const planTenant = assertPlanTenantsMatch(tenant.value, input.planTenant);
  if (!planTenant.ok) return planTenant;

  const allowed = assertActionAllowedByBrief(input.briefAuthorizedAction, input.action);
  if (!allowed.ok) return allowed;

  return planOk({
    id,
    planId,
    organizationId: tenant.value.organizationId,
    clientId: tenant.value.clientId,
    action: input.action,
    status: 'PLANNED',
    order: input.order,
    rationale,
    channel: input.channel?.trim() ? input.channel.trim() : null,
    format: input.format?.trim() ? input.format.trim() : null,
    riskNotes: Array.isArray(input.riskNotes) ? [...input.riskNotes] : [],
    downstreamRef: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    schemaVersion: PLAN_ITEM_SCHEMA_VERSION,
  });
}

/** Item alone never authorizes execution — gate required. */
export function assertPlanItemCannotSelfAuthorize(
  _item: PlanItem
): PlanDomainResult<void> {
  return planFail(
    'ITEM_CANNOT_SELF_AUTHORIZE',
    'PlanItem cannot self-authorize; AuthorizePlannedAction required'
  );
}

export function assertPlanItemMatchesBrief(
  item: PlanItem,
  brief: PlanBriefContext
): PlanDomainResult<void> {
  const tenant = assertPlanTenantsMatch(item, brief);
  if (!tenant.ok) return tenant;
  return assertActionAllowedByBrief(brief.authorizedAction, item.action);
}
