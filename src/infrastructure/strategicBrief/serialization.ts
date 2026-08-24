import {
  BRIEF_SCHEMA_VERSION,
  isBriefStatus,
  validateOverrideRecord,
  validateStrategicBriefStructure,
  type BriefSchemaVersion,
  type StrategicBrief,
  type StrategicBriefHistoryRecord,
  type StrategicBriefOverrideRecord,
  type StrategicDecisionSnapshot,
} from '../../domain/strategicBriefCore';
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

function parseDecision(raw: unknown): StrategicDecisionSnapshot {
  const record = asRecord(raw, 'decision snapshot');
  const authorizedAction = record.authorizedAction;
  const dispositionDecision = record.dispositionDecision;
  const formatDecision = record.formatDecision;
  const routing = asRecord(record.upstreamRoutingRef, 'upstreamRoutingRef');
  const score = asRecord(record.upstreamScoreRef, 'upstreamScoreRef');
  if (typeof record.decisionRationale !== 'string') {
    throw persistenceError('Malformed persisted decision snapshot.');
  }
  if (typeof authorizedAction !== 'string' || typeof dispositionDecision !== 'string' || typeof formatDecision !== 'string') {
    throw persistenceError('Malformed persisted decision snapshot.');
  }
  if (typeof routing.routingState !== 'string' || typeof score.scoringVersion !== 'string') {
    throw persistenceError('Malformed persisted decision snapshot.');
  }
  if (!Array.isArray(record.signalContextRefs)) {
    throw persistenceError('Malformed persisted decision snapshot.');
  }
  return cloneJson(raw) as StrategicDecisionSnapshot;
}

/**
 * Fail-closed parse. Never defaults tenant, thesis, status, version, approval, or schemaVersion.
 */
export function parseStoredBrief(raw: unknown): StrategicBrief {
  const record = asRecord(raw, 'StrategicBrief');
  const schemaVersion = record.schemaVersion;
  if (typeof schemaVersion !== 'string') {
    throw persistenceError('Malformed persisted StrategicBrief: schemaVersion is required.');
  }
  if (schemaVersion !== BRIEF_SCHEMA_VERSION) {
    throw persistenceError('Malformed persisted StrategicBrief: unsupported schemaVersion.');
  }

  const status = record.status;
  if (!isBriefStatus(status)) {
    throw persistenceError('Malformed persisted StrategicBrief: status is unsupported.');
  }

  const brief = {
    id: requiredString(record, 'id', 'StrategicBrief'),
    organizationId: requiredString(record, 'organizationId', 'StrategicBrief'),
    clientId: requiredString(record, 'clientId', 'StrategicBrief'),
    thesisId: requiredString(record, 'thesisId', 'StrategicBrief'),
    signalIds: requiredStringArray(record, 'signalIds', 'StrategicBrief'),
    primaryAudience: requiredString(record, 'primaryAudience', 'StrategicBrief'),
    geography: requiredString(record, 'geography', 'StrategicBrief'),
    territory: requiredString(record, 'territory', 'StrategicBrief'),
    framework: requiredString(record, 'framework', 'StrategicBrief'),
    whyNow: cloneJson(record.whyNow) as StrategicBrief['whyNow'],
    strategicAngle: requiredString(record, 'strategicAngle', 'StrategicBrief'),
    supportingEvidenceIds: requiredStringArray(record, 'supportingEvidenceIds', 'StrategicBrief'),
    riskFlags: requiredStringArray(record, 'riskFlags', 'StrategicBrief'),
    recommendedChannel: requiredString(record, 'recommendedChannel', 'StrategicBrief'),
    recommendedFormat: requiredString(record, 'recommendedFormat', 'StrategicBrief'),
    CTA: requiredString(record, 'CTA', 'StrategicBrief'),
    status,
    createdBy: requiredString(record, 'createdBy', 'StrategicBrief'),
    approvedBy: record.approvedBy === null || record.approvedBy === undefined ? null : requiredString(record, 'approvedBy', 'StrategicBrief'),
    version: requiredNumber(record, 'version', 'StrategicBrief'),
    schemaVersion: schemaVersion as BriefSchemaVersion,
    decision: parseDecision(record.decision),
    createdAt: requiredString(record, 'createdAt', 'StrategicBrief'),
    updatedAt: requiredString(record, 'updatedAt', 'StrategicBrief'),
    approvedAt:
      record.approvedAt === undefined
        ? undefined
        : record.approvedAt === null
          ? null
          : requiredString(record, 'approvedAt', 'StrategicBrief'),
    supersededByBriefId:
      record.supersededByBriefId === undefined
        ? undefined
        : record.supersededByBriefId === null
          ? null
          : requiredString(record, 'supersededByBriefId', 'StrategicBrief'),
    supersedesBriefId:
      record.supersedesBriefId === undefined
        ? undefined
        : record.supersedesBriefId === null
          ? null
          : requiredString(record, 'supersedesBriefId', 'StrategicBrief'),
    rejectionReason:
      record.rejectionReason === undefined
        ? undefined
        : record.rejectionReason === null
          ? null
          : requiredString(record, 'rejectionReason', 'StrategicBrief'),
  } satisfies StrategicBrief;

  const structure = validateStrategicBriefStructure(brief);
  if (!structure.ok) {
    throw persistenceError('Malformed persisted StrategicBrief.');
  }
  return cloneJson(brief);
}

export function parseStoredHistory(raw: unknown): StrategicBriefHistoryRecord {
  const record = asRecord(raw, 'history');
  const status = record.status;
  if (!isBriefStatus(status)) {
    throw persistenceError('Malformed persisted history: status is unsupported.');
  }
  const entry: StrategicBriefHistoryRecord = {
    briefId: requiredString(record, 'briefId', 'history'),
    version: requiredNumber(record, 'version', 'history'),
    status,
    decision: parseDecision(record.decision),
    organizationId: requiredString(record, 'organizationId', 'history'),
    clientId: requiredString(record, 'clientId', 'history'),
    actorId: requiredString(record, 'actorId', 'history'),
    source: record.source === 'SYSTEM' ? 'SYSTEM' : record.source === 'HUMAN' ? 'HUMAN' : (() => {
      throw persistenceError('Malformed persisted history: source is unsupported.');
    })(),
    changeType: requiredString(record, 'changeType', 'history') as StrategicBriefHistoryRecord['changeType'],
    changedAt: requiredString(record, 'changedAt', 'history'),
    materialFingerprint: requiredString(record, 'materialFingerprint', 'history'),
  };
  return cloneJson(entry);
}

export function parseStoredOverride(raw: unknown): StrategicBriefOverrideRecord {
  asRecord(raw, 'override audit');
  const parsed: StrategicBriefOverrideRecord = cloneJson(raw) as StrategicBriefOverrideRecord;
  if (typeof parsed.overrideId !== 'string' || typeof parsed.briefId !== 'string') {
    throw persistenceError('Malformed persisted override audit.');
  }
  const checked = validateOverrideRecord(parsed);
  if (!checked.ok) {
    throw persistenceError('Malformed persisted override audit.');
  }
  return cloneJson(checked.value);
}

export function historyIdentity(entry: StrategicBriefHistoryRecord): string {
  return [
    entry.briefId,
    String(entry.version),
    entry.changeType,
    entry.changedAt,
    entry.materialFingerprint,
  ].join('|');
}

export function sortedSignalKey(ids: readonly string[]): string {
  return [...ids].slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join('|');
}
