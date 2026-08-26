/**
 * SPEC-004 Phase 3 — fail-closed serialization for StrategicPlan persistence.
 */

import type { StrategicPlanHistoryRecord } from '../../application/strategicPlan/ports/StrategicPlanHistoryPort';
import { isStrategicAuthorizedAction } from '../../domain/strategicBriefCore';
import {
  PLAN_ITEM_SCHEMA_VERSION,
  PLAN_ITEM_STATUSES,
  type PlanDownstreamRef,
  type PlanItem,
  type PlanItemStatus,
} from '../../domain/planItemCore';
import { PLAN_MATERIAL_HISTORY_EVENTS } from '../../domain/planMaterialityCore';
import {
  STRATEGIC_PLAN_SCHEMA_VERSION,
  PLAN_STATUSES,
  type PlanAiAdvisoryRef,
  type PlanStatus,
  type StrategicPlan,
} from '../../domain/strategicPlanCore';
import { persistenceError } from './persistenceErrors';

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw persistenceError(`Malformed persisted ${label}.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, field: string, label: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw persistenceError(`Malformed persisted ${label}: ${field} is required.`);
  }
  return value;
}

function requiredNumber(record: Record<string, unknown>, field: string, label: string): number {
  const value = record[field];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw persistenceError(`Malformed persisted ${label}: ${field} is required.`);
  }
  return value;
}

function requiredStringArray(record: Record<string, unknown>, field: string, label: string): string[] {
  const value = record[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw persistenceError(`Malformed persisted ${label}: ${field} is required.`);
  }
  return [...value];
}

export function peekTenant(raw: unknown): { organizationId: string; clientId: string } | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  if (typeof record.organizationId === 'string' && typeof record.clientId === 'string') {
    return { organizationId: record.organizationId, clientId: record.clientId };
  }
  return undefined;
}

export function peekId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const id = (raw as Record<string, unknown>).id;
  return typeof id === 'string' ? id : undefined;
}

/** Deterministic tenant-safe key: organizationId|clientId|entityId */
export function tenantEntityKey(
  organizationId: string,
  clientId: string,
  id: string
): string {
  return `${organizationId}|${clientId}|${id}`;
}

export function idempotencyLookupKey(
  organizationId: string,
  clientId: string,
  key: string
): string {
  return `${organizationId}|${clientId}|${key}`;
}

function parseDownstreamRef(raw: unknown): PlanDownstreamRef | null {
  if (raw === null || raw === undefined) return null;
  const record = asRecord(raw, 'PlanDownstreamRef');
  const kind = record.kind;
  if (kind !== 'CONTENT' && kind !== 'OPPORTUNITY' && kind !== 'TASK' && kind !== 'OTHER') {
    throw persistenceError('Malformed persisted PlanDownstreamRef: kind is unsupported.');
  }
  return { kind, id: requiredString(record, 'id', 'PlanDownstreamRef') };
}

/**
 * Fail-closed PlanItem parse. Invalid item never becomes silent partial authority.
 */
export function parseStoredPlanItem(raw: unknown, expectedPlanId: string): PlanItem {
  const record = asRecord(raw, 'PlanItem');
  if (record.schemaVersion !== PLAN_ITEM_SCHEMA_VERSION) {
    throw persistenceError('Malformed persisted PlanItem: unsupported schemaVersion.');
  }
  const status = record.status;
  if (typeof status !== 'string' || !(PLAN_ITEM_STATUSES as readonly string[]).includes(status)) {
    throw persistenceError('Malformed persisted PlanItem: status is unsupported.');
  }
  const action = record.action;
  if (!isStrategicAuthorizedAction(action)) {
    throw persistenceError('Malformed persisted PlanItem: action is unsupported.');
  }
  const planId = requiredString(record, 'planId', 'PlanItem');
  if (planId !== expectedPlanId) {
    throw persistenceError('Malformed persisted PlanItem: planId does not match parent plan.');
  }
  const order = requiredNumber(record, 'order', 'PlanItem');
  if (order < 0) {
    throw persistenceError('Malformed persisted PlanItem: order must be >= 0.');
  }
  return {
    id: requiredString(record, 'id', 'PlanItem'),
    planId,
    organizationId: requiredString(record, 'organizationId', 'PlanItem'),
    clientId: requiredString(record, 'clientId', 'PlanItem'),
    action,
    status: status as PlanItemStatus,
    order,
    rationale: requiredString(record, 'rationale', 'PlanItem'),
    channel: typeof record.channel === 'string' ? record.channel : null,
    format: typeof record.format === 'string' ? record.format : null,
    riskNotes: requiredStringArray(record, 'riskNotes', 'PlanItem'),
    downstreamRef: parseDownstreamRef(record.downstreamRef ?? null),
    createdAt: requiredString(record, 'createdAt', 'PlanItem'),
    updatedAt: requiredString(record, 'updatedAt', 'PlanItem'),
    schemaVersion: PLAN_ITEM_SCHEMA_VERSION,
  };
}

/**
 * Fail-closed StrategicPlan parse. Never defaults tenant/Brief/thesis/status/version.
 */
export function parseStoredPlan(raw: unknown): StrategicPlan {
  const record = asRecord(raw, 'StrategicPlan');
  if (record.schemaVersion !== STRATEGIC_PLAN_SCHEMA_VERSION) {
    throw persistenceError('Malformed persisted StrategicPlan: unsupported schemaVersion.');
  }
  const status = record.status;
  if (typeof status !== 'string' || !(PLAN_STATUSES as readonly string[]).includes(status)) {
    throw persistenceError('Malformed persisted StrategicPlan: status is unsupported.');
  }
  const authorizedAction = record.authorizedAction;
  if (!isStrategicAuthorizedAction(authorizedAction)) {
    throw persistenceError('Malformed persisted StrategicPlan: authorizedAction is unsupported.');
  }
  const version = requiredNumber(record, 'version', 'StrategicPlan');
  if (version < 1) {
    throw persistenceError('Malformed persisted StrategicPlan: version must be >= 1.');
  }
  const briefVersion = requiredNumber(record, 'strategicBriefVersion', 'StrategicPlan');
  if (briefVersion < 1) {
    throw persistenceError('Malformed persisted StrategicPlan: strategicBriefVersion must be >= 1.');
  }
  const planId = requiredString(record, 'id', 'StrategicPlan');
  const organizationId = requiredString(record, 'organizationId', 'StrategicPlan');
  const clientId = requiredString(record, 'clientId', 'StrategicPlan');
  if (!Array.isArray(record.items)) {
    throw persistenceError('Malformed persisted StrategicPlan: items is required.');
  }
  const items = record.items.map((item) => parseStoredPlanItem(item, planId));
  for (const item of items) {
    if (item.organizationId !== organizationId || item.clientId !== clientId) {
      throw persistenceError('Malformed persisted StrategicPlan: PlanItem tenant mismatch.');
    }
  }

  const approvedBy =
    record.approvedBy === null
      ? null
      : typeof record.approvedBy === 'string'
        ? record.approvedBy
        : (() => {
            throw persistenceError('Malformed persisted StrategicPlan: approvedBy is invalid.');
          })();

  const aiAdvisoryRefs: PlanAiAdvisoryRef[] = Array.isArray(record.aiAdvisoryRefs)
    ? record.aiAdvisoryRefs.map((ref) => {
        if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
          throw persistenceError('Malformed persisted StrategicPlan: aiAdvisoryRefs entry invalid.');
        }
        const r = ref as Record<string, unknown>;
        return {
          operation: typeof r.operation === 'string' ? r.operation : undefined,
          aiRunId: typeof r.aiRunId === 'string' ? r.aiRunId : undefined,
          note: typeof r.note === 'string' ? r.note : undefined,
        };
      })
    : [];

  return {
    id: planId,
    organizationId,
    clientId,
    strategicBriefId: requiredString(record, 'strategicBriefId', 'StrategicPlan'),
    strategicBriefVersion: briefVersion,
    thesisId: requiredString(record, 'thesisId', 'StrategicPlan'),
    signalIds: requiredStringArray(record, 'signalIds', 'StrategicPlan'),
    authorizedAction,
    status: status as PlanStatus,
    version,
    schemaVersion: STRATEGIC_PLAN_SCHEMA_VERSION,
    createdBy: requiredString(record, 'createdBy', 'StrategicPlan'),
    approvedBy,
    createdAt: requiredString(record, 'createdAt', 'StrategicPlan'),
    updatedAt: requiredString(record, 'updatedAt', 'StrategicPlan'),
    rationale: requiredString(record, 'rationale', 'StrategicPlan'),
    priorityBand: typeof record.priorityBand === 'string' ? record.priorityBand : null,
    aiAdvisoryRefs,
    supersededByPlanId:
      record.supersededByPlanId === null || record.supersededByPlanId === undefined
        ? null
        : requiredString(record, 'supersededByPlanId', 'StrategicPlan'),
    supersedesPlanId:
      record.supersedesPlanId === null || record.supersedesPlanId === undefined
        ? null
        : requiredString(record, 'supersedesPlanId', 'StrategicPlan'),
    items,
  };
}

export function parseStoredHistory(raw: unknown): StrategicPlanHistoryRecord {
  const record = asRecord(raw, 'StrategicPlanHistory');
  const event = record.event;
  if (
    typeof event !== 'string' ||
    !(PLAN_MATERIAL_HISTORY_EVENTS as readonly string[]).includes(event)
  ) {
    throw persistenceError('Malformed persisted StrategicPlanHistory: event is unsupported.');
  }
  return {
    id: requiredString(record, 'id', 'StrategicPlanHistory'),
    organizationId: requiredString(record, 'organizationId', 'StrategicPlanHistory'),
    clientId: requiredString(record, 'clientId', 'StrategicPlanHistory'),
    planId: requiredString(record, 'planId', 'StrategicPlanHistory'),
    planVersion: requiredNumber(record, 'planVersion', 'StrategicPlanHistory'),
    event: event as StrategicPlanHistoryRecord['event'],
    actorId: requiredString(record, 'actorId', 'StrategicPlanHistory'),
    at: requiredString(record, 'at', 'StrategicPlanHistory'),
    itemId: typeof record.itemId === 'string' ? record.itemId : undefined,
    note: typeof record.note === 'string' ? record.note : undefined,
  };
}

export function historyIdentity(entry: StrategicPlanHistoryRecord): string {
  return [
    entry.organizationId,
    entry.clientId,
    entry.id,
    entry.planId,
    String(entry.planVersion),
    entry.event,
    entry.itemId ?? '',
  ].join('|');
}

export interface IdempotencyRecord {
  key: string;
  planId: string;
  organizationId: string;
  clientId: string;
  at: string;
}

export function parseStoredIdempotency(raw: unknown): IdempotencyRecord {
  const record = asRecord(raw, 'PlanIdempotency');
  return {
    key: requiredString(record, 'key', 'PlanIdempotency'),
    planId: requiredString(record, 'planId', 'PlanIdempotency'),
    organizationId: requiredString(record, 'organizationId', 'PlanIdempotency'),
    clientId: requiredString(record, 'clientId', 'PlanIdempotency'),
    at: requiredString(record, 'at', 'PlanIdempotency'),
  };
}
