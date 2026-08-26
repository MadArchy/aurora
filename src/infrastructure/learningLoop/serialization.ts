/**
 * SPEC-008 Phase 3 — Fail-closed serialization for Learning Loop persistence.
 * Does not select thesis winners. Does not auto-approve or auto-apply.
 */

import type { LearningHistoryRecord } from '../../domain/learningMaterialityCore';
import type { LearningAssessment, LearningEvidence } from '../../domain/learningEvidenceCore';
import {
  LEARNING_EVIDENCE_SCHEMA_VERSION,
  type LearningEvidenceMetric,
  type LearningEvidencePattern,
} from '../../domain/learningEvidenceCore';
import {
  LEARNING_OBSERVATION_KINDS,
  LEARNING_OBSERVATION_SCHEMA_VERSION,
  LEARNING_OBSERVATION_STATUSES,
  LEARNING_SOURCE_KINDS,
  type LearningObservation,
  type LearningObservationKind,
  type LearningObservationStatus,
  type LearningSourceKind,
  type LearningSourceRef,
} from '../../domain/learningObservationCore';
import {
  RECOMMENDATION_CONFIDENCE_LEVELS,
  RECOMMENDATION_TYPES,
  STRATEGIC_RECOMMENDATION_SCHEMA_VERSION,
  type ExpectedImpact,
  type ProposedChange,
  type RecommendationConfidence,
  type RecommendationType,
  type StrategicRecommendation,
  type TargetAuthority,
} from '../../domain/strategicRecommendationCore';
import {
  RECOMMENDATION_DECISIONS,
  type RecommendationDecision,
  type RecommendationDecisionKind,
} from '../../domain/recommendationDecisionCore';
import {
  RECOMMENDATION_STATUSES,
  type RecommendationStatus,
} from '../../domain/recommendationLifecycleCore';
import type { ThesisScope } from '../../domain/learningThesisScopeCore';
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

function requiredStringArray(
  record: Record<string, unknown>,
  field: string,
  label: string
): string[] {
  const value = record[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw persistenceError(`Malformed persisted ${label}: ${field} is required.`);
  }
  return [...value];
}

export function peekTenant(
  raw: unknown
): { organizationId: string; clientId: string } | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  if (typeof record.organizationId === 'string' && typeof record.clientId === 'string') {
    return { organizationId: record.organizationId, clientId: record.clientId };
  }
  return undefined;
}

export function peekEntityId(
  raw: unknown,
  fields: string[]
): string | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return undefined;
}

/** Deterministic tenant-safe key: organizationId|clientId|entityId */
export function tenantEntityKey(
  organizationId: string,
  clientId: string,
  entityId: string
): string {
  return `${organizationId}|${clientId}|${entityId}`;
}

export function idempotencyLookupKey(
  organizationId: string,
  clientId: string,
  key: string
): string {
  return `${organizationId}|${clientId}|${key}`;
}

export function historyIdentity(entry: LearningHistoryRecord): string {
  return [
    entry.organizationId,
    entry.clientId,
    entry.aggregateKind,
    entry.aggregateId,
    entry.kind,
    String(entry.aggregateVersion),
    entry.occurredAt,
    entry.materialFingerprint,
  ].join('|');
}

export function decisionIdentity(decision: RecommendationDecision): string {
  return [
    decision.organizationId,
    decision.clientId,
    decision.decisionId,
    decision.recommendationId,
    String(decision.recommendationVersion),
    decision.decision,
    decision.decidedAt,
  ].join('|');
}

function parseThesisScope(raw: unknown): ThesisScope {
  const record = asRecord(raw, 'ThesisScope');
  const kind = record.kind;
  if (kind === 'SINGLE') {
    return { kind: 'SINGLE', thesisId: requiredString(record, 'thesisId', 'ThesisScope') };
  }
  if (kind === 'MULTI') {
    const ids = requiredStringArray(record, 'thesisIds', 'ThesisScope');
    if (ids.length < 2) {
      throw persistenceError('Malformed persisted ThesisScope: MULTI requires >= 2 thesisIds.');
    }
    return { kind: 'MULTI', thesisIds: ids };
  }
  if (kind === 'CLIENT_WIDE') {
    return { kind: 'CLIENT_WIDE' };
  }
  throw persistenceError('Malformed persisted ThesisScope: unknown kind.');
}

function parseSourceRef(raw: unknown): LearningSourceRef {
  const record = asRecord(raw, 'LearningSourceRef');
  const ref: LearningSourceRef = {
    sourceSpec: requiredString(record, 'sourceSpec', 'LearningSourceRef'),
    sourceId: requiredString(record, 'sourceId', 'LearningSourceRef'),
  };
  if (typeof record.sourceVersion === 'string') {
    ref.sourceVersion = record.sourceVersion;
  }
  return ref;
}

export function parseStoredObservation(raw: unknown): LearningObservation {
  const record = asRecord(raw, 'LearningObservation');
  if (record.schemaVersion !== LEARNING_OBSERVATION_SCHEMA_VERSION) {
    throw persistenceError(
      'Malformed persisted LearningObservation: unsupported schemaVersion.'
    );
  }
  const sourceKind = record.sourceKind;
  if (
    typeof sourceKind !== 'string' ||
    !(LEARNING_SOURCE_KINDS as readonly string[]).includes(sourceKind)
  ) {
    throw persistenceError('Malformed persisted LearningObservation: sourceKind.');
  }
  const observationKind = record.observationKind;
  if (
    typeof observationKind !== 'string' ||
    !(LEARNING_OBSERVATION_KINDS as readonly string[]).includes(observationKind)
  ) {
    throw persistenceError('Malformed persisted LearningObservation: observationKind.');
  }
  const status = record.status;
  if (
    typeof status !== 'string' ||
    !(LEARNING_OBSERVATION_STATUSES as readonly string[]).includes(status)
  ) {
    throw persistenceError('Malformed persisted LearningObservation: status.');
  }
  if (!record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload)) {
    throw persistenceError('Malformed persisted LearningObservation: payload.');
  }
  const observation: LearningObservation = {
    observationId: requiredString(record, 'observationId', 'LearningObservation'),
    organizationId: requiredString(record, 'organizationId', 'LearningObservation'),
    clientId: requiredString(record, 'clientId', 'LearningObservation'),
    thesisScope: parseThesisScope(record.thesisScope),
    sourceKind: sourceKind as LearningSourceKind,
    sourceRef: parseSourceRef(record.sourceRef),
    observationKind: observationKind as LearningObservationKind,
    payload: { ...(record.payload as Record<string, unknown>) },
    actorUid: requiredString(record, 'actorUid', 'LearningObservation'),
    recordedAt: requiredString(record, 'recordedAt', 'LearningObservation'),
    schemaVersion: LEARNING_OBSERVATION_SCHEMA_VERSION,
    status: status as LearningObservationStatus,
  };
  if (typeof record.supersedesObservationId === 'string') {
    observation.supersedesObservationId = record.supersedesObservationId;
  }
  if (typeof record.supersessionReason === 'string') {
    observation.supersessionReason = record.supersessionReason;
  }
  return observation;
}

function parseMetric(raw: unknown): LearningEvidenceMetric {
  const record = asRecord(raw, 'LearningEvidenceMetric');
  const metric: LearningEvidenceMetric = {
    key: requiredString(record, 'key', 'LearningEvidenceMetric'),
    label: requiredString(record, 'label', 'LearningEvidenceMetric'),
    value: record.value as number,
  };
  if (typeof metric.value !== 'number' || Number.isNaN(metric.value)) {
    throw persistenceError('Malformed persisted LearningEvidenceMetric: value.');
  }
  if (typeof record.unit === 'string') metric.unit = record.unit;
  return metric;
}

function parsePattern(raw: unknown): LearningEvidencePattern {
  const record = asRecord(raw, 'LearningEvidencePattern');
  return {
    reasonCode: requiredString(record, 'reasonCode', 'LearningEvidencePattern'),
    description: requiredString(record, 'description', 'LearningEvidencePattern'),
    observationIds: requiredStringArray(record, 'observationIds', 'LearningEvidencePattern'),
  };
}

export function parseStoredEvidence(raw: unknown): LearningEvidence {
  const record = asRecord(raw, 'LearningEvidence');
  if (record.schemaVersion !== LEARNING_EVIDENCE_SCHEMA_VERSION) {
    throw persistenceError('Malformed persisted LearningEvidence: unsupported schemaVersion.');
  }
  const evidence: LearningEvidence = {
    evidenceId: requiredString(record, 'evidenceId', 'LearningEvidence'),
    organizationId: requiredString(record, 'organizationId', 'LearningEvidence'),
    clientId: requiredString(record, 'clientId', 'LearningEvidence'),
    thesisScope: parseThesisScope(record.thesisScope),
    observationIds: requiredStringArray(record, 'observationIds', 'LearningEvidence'),
    metrics: Array.isArray(record.metrics)
      ? record.metrics.map(parseMetric)
      : [],
    summary: requiredString(record, 'summary', 'LearningEvidence'),
    schemaVersion: LEARNING_EVIDENCE_SCHEMA_VERSION,
    builtAt: requiredString(record, 'builtAt', 'LearningEvidence'),
  };
  if (Array.isArray(record.patterns)) {
    evidence.patterns = record.patterns.map(parsePattern);
  }
  if (evidence.metrics.length === 0) {
    throw persistenceError('Malformed persisted LearningEvidence: metrics required.');
  }
  return evidence;
}

function parseTargetAuthority(raw: unknown): TargetAuthority {
  const record = asRecord(raw, 'TargetAuthority');
  return {
    specId: requiredString(record, 'specId', 'TargetAuthority'),
    domain: requiredString(record, 'domain', 'TargetAuthority'),
  };
}

function parseProposedChange(raw: unknown): ProposedChange {
  const record = asRecord(raw, 'ProposedChange');
  if (!record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload)) {
    throw persistenceError('Malformed persisted ProposedChange: payload.');
  }
  return {
    changeKind: requiredString(record, 'changeKind', 'ProposedChange'),
    schemaVersion: requiredString(record, 'schemaVersion', 'ProposedChange'),
    payload: { ...(record.payload as Record<string, unknown>) },
  };
}

function parseExpectedImpact(raw: unknown): ExpectedImpact {
  const record = asRecord(raw, 'ExpectedImpact');
  const impact: ExpectedImpact = {
    summary: requiredString(record, 'summary', 'ExpectedImpact'),
  };
  if (Array.isArray(record.metrics)) {
    impact.metrics = record.metrics.map((m) => {
      const row = asRecord(m, 'ExpectedImpactMetric');
      const direction = row.direction;
      if (direction !== 'INCREASE' && direction !== 'DECREASE' && direction !== 'NEUTRAL') {
        throw persistenceError('Malformed persisted ExpectedImpact: direction.');
      }
      return {
        key: requiredString(row, 'key', 'ExpectedImpactMetric'),
        direction,
      };
    });
  }
  return impact;
}

export function parseStoredRecommendation(raw: unknown): StrategicRecommendation {
  const record = asRecord(raw, 'StrategicRecommendation');
  if (record.schemaVersion !== STRATEGIC_RECOMMENDATION_SCHEMA_VERSION) {
    throw persistenceError(
      'Malformed persisted StrategicRecommendation: unsupported schemaVersion.'
    );
  }
  const status = record.status;
  if (
    typeof status !== 'string' ||
    !(RECOMMENDATION_STATUSES as readonly string[]).includes(status)
  ) {
    throw persistenceError('Malformed persisted StrategicRecommendation: status.');
  }
  const recommendationType = record.recommendationType;
  if (
    typeof recommendationType !== 'string' ||
    !(RECOMMENDATION_TYPES as readonly string[]).includes(recommendationType)
  ) {
    throw persistenceError('Malformed persisted StrategicRecommendation: recommendationType.');
  }
  const confidence = record.confidence;
  if (
    typeof confidence !== 'string' ||
    !(RECOMMENDATION_CONFIDENCE_LEVELS as readonly string[]).includes(confidence)
  ) {
    throw persistenceError('Malformed persisted StrategicRecommendation: confidence.');
  }
  const version = requiredNumber(record, 'version', 'StrategicRecommendation');
  if (version < 1) {
    throw persistenceError('Malformed persisted StrategicRecommendation: version.');
  }
  const rec: StrategicRecommendation = {
    recommendationId: requiredString(record, 'recommendationId', 'StrategicRecommendation'),
    organizationId: requiredString(record, 'organizationId', 'StrategicRecommendation'),
    clientId: requiredString(record, 'clientId', 'StrategicRecommendation'),
    thesisScope: parseThesisScope(record.thesisScope),
    sourceObservationIds: requiredStringArray(
      record,
      'sourceObservationIds',
      'StrategicRecommendation'
    ),
    learningEvidenceId: requiredString(record, 'learningEvidenceId', 'StrategicRecommendation'),
    recommendationType: recommendationType as RecommendationType,
    targetAuthority: parseTargetAuthority(record.targetAuthority),
    proposedChange: parseProposedChange(record.proposedChange),
    rationale: requiredString(record, 'rationale', 'StrategicRecommendation'),
    confidence: confidence as RecommendationConfidence,
    risks: requiredStringArray(record, 'risks', 'StrategicRecommendation'),
    expectedImpact: parseExpectedImpact(record.expectedImpact),
    status: status as RecommendationStatus,
    version,
    schemaVersion: STRATEGIC_RECOMMENDATION_SCHEMA_VERSION,
    createdBy: requiredString(record, 'createdBy', 'StrategicRecommendation'),
    createdAt: requiredString(record, 'createdAt', 'StrategicRecommendation'),
    updatedAt: requiredString(record, 'updatedAt', 'StrategicRecommendation'),
  };
  if (Array.isArray(record.sourceOutcomeIds)) {
    rec.sourceOutcomeIds = requiredStringArray(
      record,
      'sourceOutcomeIds',
      'StrategicRecommendation'
    );
  }
  if (Array.isArray(record.sourceResultIds)) {
    rec.sourceResultIds = requiredStringArray(record, 'sourceResultIds', 'StrategicRecommendation');
  }
  if (Array.isArray(record.sourceOpportunityIds)) {
    rec.sourceOpportunityIds = requiredStringArray(
      record,
      'sourceOpportunityIds',
      'StrategicRecommendation'
    );
  }
  if (typeof record.reviewedBy === 'string') rec.reviewedBy = record.reviewedBy;
  if (typeof record.approvedBy === 'string') rec.approvedBy = record.approvedBy;
  if (typeof record.appliedBy === 'string') rec.appliedBy = record.appliedBy;
  if (typeof record.supersedesRecommendationId === 'string') {
    rec.supersedesRecommendationId = record.supersedesRecommendationId;
  }
  return rec;
}

export function parseStoredHistory(raw: unknown): LearningHistoryRecord {
  const record = asRecord(raw, 'LearningHistoryRecord');
  if (record.authority !== 'AUDIT_ONLY') {
    throw persistenceError('Malformed persisted history: authority must be AUDIT_ONLY.');
  }
  const aggregateKind = record.aggregateKind;
  if (
    aggregateKind !== 'OBSERVATION' &&
    aggregateKind !== 'EVIDENCE' &&
    aggregateKind !== 'RECOMMENDATION' &&
    aggregateKind !== 'DECISION'
  ) {
    throw persistenceError('Malformed persisted history: aggregateKind.');
  }
  if (!Array.isArray(record.reasonCodes)) {
    throw persistenceError('Malformed persisted history: reasonCodes.');
  }
  return {
    kind: requiredString(record, 'kind', 'LearningHistoryRecord') as LearningHistoryRecord['kind'],
    organizationId: requiredString(record, 'organizationId', 'LearningHistoryRecord'),
    clientId: requiredString(record, 'clientId', 'LearningHistoryRecord'),
    aggregateKind,
    aggregateId: requiredString(record, 'aggregateId', 'LearningHistoryRecord'),
    aggregateVersion: requiredNumber(record, 'aggregateVersion', 'LearningHistoryRecord'),
    actorKind: requiredString(record, 'actorKind', 'LearningHistoryRecord'),
    reasonCodes: record.reasonCodes.map(String),
    materialFingerprint: requiredString(record, 'materialFingerprint', 'LearningHistoryRecord'),
    occurredAt: requiredString(record, 'occurredAt', 'LearningHistoryRecord'),
    authority: 'AUDIT_ONLY',
  };
}

export function parseStoredDecision(raw: unknown): RecommendationDecision {
  const record = asRecord(raw, 'RecommendationDecision');
  if (record.authority !== 'AUDIT_ONLY') {
    throw persistenceError('Malformed persisted decision: authority must be AUDIT_ONLY.');
  }
  const decision = record.decision;
  if (
    typeof decision !== 'string' ||
    !(RECOMMENDATION_DECISIONS as readonly string[]).includes(decision)
  ) {
    throw persistenceError('Malformed persisted decision: decision.');
  }
  const previousStatus = record.previousStatus;
  if (
    typeof previousStatus !== 'string' ||
    !(RECOMMENDATION_STATUSES as readonly string[]).includes(previousStatus)
  ) {
    throw persistenceError('Malformed persisted decision: previousStatus.');
  }
  return {
    decisionId: requiredString(record, 'decisionId', 'RecommendationDecision'),
    recommendationId: requiredString(record, 'recommendationId', 'RecommendationDecision'),
    recommendationVersion: requiredNumber(
      record,
      'recommendationVersion',
      'RecommendationDecision'
    ),
    organizationId: requiredString(record, 'organizationId', 'RecommendationDecision'),
    clientId: requiredString(record, 'clientId', 'RecommendationDecision'),
    decision: decision as RecommendationDecisionKind,
    actorUid: requiredString(record, 'actorUid', 'RecommendationDecision'),
    reason: requiredString(record, 'reason', 'RecommendationDecision'),
    decidedAt: requiredString(record, 'decidedAt', 'RecommendationDecision'),
    previousStatus: previousStatus as RecommendationStatus,
    authority: 'AUDIT_ONLY',
  };
}

export interface StoredIdempotencyRecord {
  key: string;
  aggregateKind: 'OBSERVATION' | 'EVIDENCE' | 'RECOMMENDATION';
  aggregateId: string;
  organizationId: string;
  clientId: string;
  materialFingerprint: string;
  at: string;
}

export function parseStoredIdempotency(raw: unknown): StoredIdempotencyRecord {
  const record = asRecord(raw, 'IdempotencyRecord');
  const aggregateKind = record.aggregateKind;
  if (
    aggregateKind !== 'OBSERVATION' &&
    aggregateKind !== 'EVIDENCE' &&
    aggregateKind !== 'RECOMMENDATION'
  ) {
    throw persistenceError('Malformed persisted idempotency: aggregateKind.');
  }
  return {
    key: requiredString(record, 'key', 'IdempotencyRecord'),
    aggregateKind,
    aggregateId: requiredString(record, 'aggregateId', 'IdempotencyRecord'),
    organizationId: requiredString(record, 'organizationId', 'IdempotencyRecord'),
    clientId: requiredString(record, 'clientId', 'IdempotencyRecord'),
    materialFingerprint: requiredString(record, 'materialFingerprint', 'IdempotencyRecord'),
    at: requiredString(record, 'at', 'IdempotencyRecord'),
  };
}

export function observationMaterialFingerprint(observation: LearningObservation): string {
  return JSON.stringify({
    observationId: observation.observationId,
    sourceKind: observation.sourceKind,
    sourceRef: observation.sourceRef,
    observationKind: observation.observationKind,
    status: observation.status,
    thesisScope: observation.thesisScope,
  });
}

export function evidenceMaterialFingerprint(evidence: LearningEvidence): string {
  return JSON.stringify({
    evidenceId: evidence.evidenceId,
    observationIds: evidence.observationIds,
    metrics: evidence.metrics.map((m) => ({ key: m.key, value: m.value })),
    thesisScope: evidence.thesisScope,
  });
}

/** Optional assessment parse for derived read models. */
export function parseStoredAssessment(raw: unknown): LearningAssessment {
  const record = asRecord(raw, 'LearningAssessment');
  return {
    assessmentId: requiredString(record, 'assessmentId', 'LearningAssessment'),
    organizationId: requiredString(record, 'organizationId', 'LearningAssessment'),
    clientId: requiredString(record, 'clientId', 'LearningAssessment'),
    evidenceId: requiredString(record, 'evidenceId', 'LearningAssessment'),
    thesisScope: parseThesisScope(record.thesisScope),
    signalsScored: typeof record.signalsScored === 'number' ? record.signalsScored : 0,
    signalsUseful: typeof record.signalsUseful === 'number' ? record.signalsUseful : 0,
    signalsNotUseful: typeof record.signalsNotUseful === 'number' ? record.signalsNotUseful : 0,
    routingOverrides: typeof record.routingOverrides === 'number' ? record.routingOverrides : 0,
    contentPublished: typeof record.contentPublished === 'number' ? record.contentPublished : 0,
    claimFindings: typeof record.claimFindings === 'number' ? record.claimFindings : 0,
    claimBlocks: typeof record.claimBlocks === 'number' ? record.claimBlocks : 0,
    authorityScore: typeof record.authorityScore === 'number' ? record.authorityScore : 0,
    summary: requiredString(record, 'summary', 'LearningAssessment'),
    builtAt: requiredString(record, 'builtAt', 'LearningAssessment'),
  };
}
