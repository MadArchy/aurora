/**
 * SPEC-007 Phase 3 — Fail-closed serialization for Opportunity Scout persistence.
 * Does not recalculate OpportunityScore. Does not select thesis winners.
 */

import type { OpportunityHistoryRecord } from '../../application/opportunityScout/ports/OpportunityHistoryPort';
import {
  CANDIDATE_STATUSES,
  OPPORTUNITY_CANDIDATE_SCHEMA_VERSION,
  OPPORTUNITY_TYPES,
  type CandidateStatus,
  type OpportunityCandidate,
  type OpportunityType,
  type RecommendedNextStep,
  type ThesisEvaluation,
  type ThesisEvaluationStatus,
} from '../../domain/opportunityCandidateCore';
import {
  MATERIALIZED_OPPORTUNITY_SCHEMA_VERSION,
  type MaterializedOpportunity,
  type OpportunityChecklistItem,
} from '../../domain/opportunityCore';
import {
  CANONICAL_OPPORTUNITY_STATUSES,
  type CanonicalOpportunityStatus,
} from '../../domain/opportunityLifecycleCore';
import {
  OPPORTUNITY_SCORE_DIMENSION_KEYS,
  OPPORTUNITY_SCORE_MODEL_VERSION,
  OPPORTUNITY_SCORE_SCHEMA_VERSION,
  type OpportunityScore,
  type OpportunityScoreBand,
  type OpportunityScoreDimension,
  type OpportunityScoreDimensionKey,
} from '../../domain/opportunityScoreCore';
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

export function historyIdentity(entry: OpportunityHistoryRecord): string {
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

function parseThesisEvaluation(raw: unknown): ThesisEvaluation {
  const record = asRecord(raw, 'ThesisEvaluation');
  const evaluationStatus = record.evaluationStatus;
  if (
    evaluationStatus !== 'ELIGIBLE' &&
    evaluationStatus !== 'INELIGIBLE' &&
    evaluationStatus !== 'UNKNOWN'
  ) {
    throw persistenceError('Malformed persisted ThesisEvaluation: evaluationStatus.');
  }
  const result: ThesisEvaluation = {
    thesisId: requiredString(record, 'thesisId', 'ThesisEvaluation'),
    fitNotes: requiredString(record, 'fitNotes', 'ThesisEvaluation'),
    evaluationStatus: evaluationStatus as ThesisEvaluationStatus,
  };
  if (typeof record.routingState === 'string') {
    result.routingState = record.routingState;
  }
  if (record.strategicScoreRef !== undefined) {
    const ref = asRecord(record.strategicScoreRef, 'strategicScoreRef');
    result.strategicScoreRef = {
      scoringVersion: requiredString(ref, 'scoringVersion', 'strategicScoreRef'),
    };
    if (typeof ref.totalScore === 'number') {
      result.strategicScoreRef.totalScore = ref.totalScore;
    }
    if (typeof ref.priorityBand === 'string') {
      result.strategicScoreRef.priorityBand = ref.priorityBand;
    }
  }
  return result;
}

function parseScoreDimension(raw: unknown): OpportunityScoreDimension {
  const record = asRecord(raw, 'OpportunityScoreDimension');
  const key = record.key;
  if (
    typeof key !== 'string' ||
    !(OPPORTUNITY_SCORE_DIMENSION_KEYS as readonly string[]).includes(key)
  ) {
    throw persistenceError('Malformed persisted OpportunityScore dimension key.');
  }
  const rawInput = record.rawInput;
  const weight = record.weight;
  const contribution = record.contribution;
  if (
    typeof rawInput !== 'number' ||
    !Number.isFinite(rawInput) ||
    typeof weight !== 'number' ||
    !Number.isFinite(weight) ||
    typeof contribution !== 'number' ||
    !Number.isFinite(contribution)
  ) {
    throw persistenceError('Malformed persisted OpportunityScore dimension numbers.');
  }
  return {
    key: key as OpportunityScoreDimensionKey,
    rawInput,
    weight,
    contribution,
    reasonCode: requiredString(record, 'reasonCode', 'OpportunityScoreDimension'),
  };
}

/**
 * Persist OpportunityScore exactly as Domain produced — no recalculation.
 */
export function parseStoredOpportunityScore(raw: unknown): OpportunityScore {
  const record = asRecord(raw, 'OpportunityScore');
  if (record.schemaVersion !== OPPORTUNITY_SCORE_SCHEMA_VERSION) {
    throw persistenceError('Malformed persisted OpportunityScore: unsupported schemaVersion.');
  }
  if (record.scoringModelVersion !== OPPORTUNITY_SCORE_MODEL_VERSION) {
    throw persistenceError(
      'Malformed persisted OpportunityScore: unsupported scoringModelVersion.'
    );
  }
  const band = record.band;
  if (
    band !== 'LOW' &&
    band !== 'MEDIUM' &&
    band !== 'HIGH' &&
    band !== 'CRITICAL'
  ) {
    throw persistenceError('Malformed persisted OpportunityScore: band.');
  }
  if (!Array.isArray(record.dimensions) || record.dimensions.length === 0) {
    throw persistenceError('Malformed persisted OpportunityScore: dimensions required.');
  }
  const dimensions = record.dimensions.map(parseScoreDimension);
  const keys = new Set(dimensions.map((d) => d.key));
  for (const required of OPPORTUNITY_SCORE_DIMENSION_KEYS) {
    if (!keys.has(required)) {
      throw persistenceError(`Malformed persisted OpportunityScore: missing ${required}.`);
    }
  }
  const totalScore = requiredNumber(record, 'totalScore', 'OpportunityScore');
  if (totalScore < 0 || totalScore > 100) {
    throw persistenceError('Malformed persisted OpportunityScore: totalScore out of range.');
  }
  return {
    id: requiredString(record, 'id', 'OpportunityScore'),
    organizationId: requiredString(record, 'organizationId', 'OpportunityScore'),
    clientId: requiredString(record, 'clientId', 'OpportunityScore'),
    candidateId: requiredString(record, 'candidateId', 'OpportunityScore'),
    scoringModelVersion: OPPORTUNITY_SCORE_MODEL_VERSION,
    totalScore,
    band: band as OpportunityScoreBand,
    dimensions,
    evidenceRefs: requiredStringArray(record, 'evidenceRefs', 'OpportunityScore'),
    riskFlags: requiredStringArray(record, 'riskFlags', 'OpportunityScore'),
    computedAt: requiredString(record, 'computedAt', 'OpportunityScore'),
    schemaVersion: OPPORTUNITY_SCORE_SCHEMA_VERSION,
  };
}

export function parseStoredCandidate(raw: unknown): OpportunityCandidate {
  const record = asRecord(raw, 'OpportunityCandidate');
  if (record.schemaVersion !== OPPORTUNITY_CANDIDATE_SCHEMA_VERSION) {
    throw persistenceError(
      'Malformed persisted OpportunityCandidate: unsupported schemaVersion.'
    );
  }
  const status = record.status;
  if (
    typeof status !== 'string' ||
    !(CANDIDATE_STATUSES as readonly string[]).includes(status)
  ) {
    throw persistenceError('Malformed persisted OpportunityCandidate: status.');
  }
  const opportunityType = record.opportunityType;
  if (
    typeof opportunityType !== 'string' ||
    !(OPPORTUNITY_TYPES as readonly string[]).includes(opportunityType)
  ) {
    throw persistenceError('Malformed persisted OpportunityCandidate: opportunityType.');
  }
  const next = record.recommendedNextStep;
  if (
    next !== 'CONTINUE_RESEARCH' &&
    next !== 'DRAFT_BRIEF' &&
    next !== 'HOLD' &&
    next !== 'DISCARD'
  ) {
    throw persistenceError('Malformed persisted OpportunityCandidate: recommendedNextStep.');
  }
  if (!Array.isArray(record.thesisEvaluations) || record.thesisEvaluations.length === 0) {
    throw persistenceError(
      'Malformed persisted OpportunityCandidate: thesisEvaluations required.'
    );
  }
  const thesisEvaluations = record.thesisEvaluations.map(parseThesisEvaluation);
  const seen = new Set<string>();
  for (const ev of thesisEvaluations) {
    if (seen.has(ev.thesisId)) {
      throw persistenceError(
        'Malformed persisted OpportunityCandidate: duplicate thesisEvaluation.'
      );
    }
    seen.add(ev.thesisId);
  }
  const version = requiredNumber(record, 'version', 'OpportunityCandidate');
  if (version < 1) {
    throw persistenceError('Malformed persisted OpportunityCandidate: version must be >= 1.');
  }
  let latestScore: OpportunityScore | null = null;
  if (record.latestScore !== null && record.latestScore !== undefined) {
    latestScore = parseStoredOpportunityScore(record.latestScore);
  }
  const id = requiredString(record, 'id', 'OpportunityCandidate');
  const organizationId = requiredString(record, 'organizationId', 'OpportunityCandidate');
  const clientId = requiredString(record, 'clientId', 'OpportunityCandidate');
  if (latestScore) {
    if (
      latestScore.organizationId !== organizationId ||
      latestScore.clientId !== clientId ||
      latestScore.candidateId !== id
    ) {
      throw persistenceError(
        'Malformed persisted OpportunityCandidate: latestScore tenant/candidate mismatch.'
      );
    }
  }
  return {
    id,
    organizationId,
    clientId,
    title: requiredString(record, 'title', 'OpportunityCandidate'),
    summary: requiredString(record, 'summary', 'OpportunityCandidate'),
    whyNow: requiredString(record, 'whyNow', 'OpportunityCandidate'),
    opportunityType: opportunityType as OpportunityType,
    sourceRefs: requiredStringArray(record, 'sourceRefs', 'OpportunityCandidate'),
    signalIds: requiredStringArray(record, 'signalIds', 'OpportunityCandidate'),
    thesisEvaluations,
    status: status as CandidateStatus,
    latestScore,
    riskFlags: requiredStringArray(record, 'riskFlags', 'OpportunityCandidate'),
    recommendedNextStep: next as RecommendedNextStep,
    schemaVersion: OPPORTUNITY_CANDIDATE_SCHEMA_VERSION,
    version,
    createdAt: requiredString(record, 'createdAt', 'OpportunityCandidate'),
    updatedAt: requiredString(record, 'updatedAt', 'OpportunityCandidate'),
    createdBy: requiredString(record, 'createdBy', 'OpportunityCandidate'),
  };
}

function parseChecklistItem(raw: unknown): OpportunityChecklistItem {
  const record = asRecord(raw, 'OpportunityChecklistItem');
  const done = record.done;
  if (typeof done !== 'boolean') {
    throw persistenceError('Malformed persisted checklist item: done.');
  }
  return {
    id: requiredString(record, 'id', 'OpportunityChecklistItem'),
    label: requiredString(record, 'label', 'OpportunityChecklistItem'),
    done,
  };
}

export function parseStoredOpportunity(raw: unknown): MaterializedOpportunity {
  const record = asRecord(raw, 'MaterializedOpportunity');
  if (record.schemaVersion !== MATERIALIZED_OPPORTUNITY_SCHEMA_VERSION) {
    throw persistenceError(
      'Malformed persisted MaterializedOpportunity: unsupported schemaVersion.'
    );
  }
  const status = record.status;
  if (
    typeof status !== 'string' ||
    !(CANONICAL_OPPORTUNITY_STATUSES as readonly string[]).includes(status)
  ) {
    throw persistenceError('Malformed persisted MaterializedOpportunity: status.');
  }
  const type = record.type;
  if (typeof type !== 'string' || !(OPPORTUNITY_TYPES as readonly string[]).includes(type)) {
    throw persistenceError('Malformed persisted MaterializedOpportunity: type.');
  }
  const version = requiredNumber(record, 'version', 'MaterializedOpportunity');
  if (version < 1) {
    throw persistenceError('Malformed persisted MaterializedOpportunity: version.');
  }
  const thesisId = requiredString(record, 'thesisId', 'MaterializedOpportunity');
  const strategicBriefVersion = requiredNumber(
    record,
    'strategicBriefVersion',
    'MaterializedOpportunity'
  );
  const strategicPlanVersion = requiredNumber(
    record,
    'strategicPlanVersion',
    'MaterializedOpportunity'
  );
  if (strategicBriefVersion < 1 || strategicPlanVersion < 1) {
    throw persistenceError('Malformed persisted MaterializedOpportunity: Brief/Plan version.');
  }
  let candidateId: string | null = null;
  let candidateVersion: number | null = null;
  if (record.candidateId !== null && record.candidateId !== undefined) {
    candidateId = requiredString(
      { candidateId: record.candidateId },
      'candidateId',
      'MaterializedOpportunity'
    );
  }
  if (record.candidateVersion !== null && record.candidateVersion !== undefined) {
    candidateVersion = requiredNumber(
      { candidateVersion: record.candidateVersion },
      'candidateVersion',
      'MaterializedOpportunity'
    );
  }
  if (!Array.isArray(record.submissionChecklist)) {
    throw persistenceError('Malformed persisted MaterializedOpportunity: checklist.');
  }
  return {
    id: requiredString(record, 'id', 'MaterializedOpportunity'),
    organizationId: requiredString(record, 'organizationId', 'MaterializedOpportunity'),
    clientId: requiredString(record, 'clientId', 'MaterializedOpportunity'),
    thesisId,
    candidateId,
    candidateVersion,
    strategicBriefId: requiredString(
      record,
      'strategicBriefId',
      'MaterializedOpportunity'
    ),
    strategicBriefVersion,
    strategicPlanId: requiredString(record, 'strategicPlanId', 'MaterializedOpportunity'),
    strategicPlanVersion,
    planItemId: requiredString(record, 'planItemId', 'MaterializedOpportunity'),
    title: requiredString(record, 'title', 'MaterializedOpportunity'),
    organization: requiredString(record, 'organization', 'MaterializedOpportunity'),
    type: type as OpportunityType,
    deadline: typeof record.deadline === 'string' ? record.deadline : null,
    description: requiredString(record, 'description', 'MaterializedOpportunity'),
    fitRationale: requiredString(record, 'fitRationale', 'MaterializedOpportunity'),
    status: status as CanonicalOpportunityStatus,
    submissionChecklist: record.submissionChecklist.map(parseChecklistItem),
    schemaVersion: MATERIALIZED_OPPORTUNITY_SCHEMA_VERSION,
    version,
    createdAt: requiredString(record, 'createdAt', 'MaterializedOpportunity'),
    updatedAt: requiredString(record, 'updatedAt', 'MaterializedOpportunity'),
    createdBy: requiredString(record, 'createdBy', 'MaterializedOpportunity'),
  };
}

export function parseStoredHistory(raw: unknown): OpportunityHistoryRecord {
  const record = asRecord(raw, 'OpportunityHistoryRecord');
  if (record.authority !== 'AUDIT_ONLY') {
    throw persistenceError('Malformed persisted history: authority must be AUDIT_ONLY.');
  }
  const aggregateKind = record.aggregateKind;
  if (
    aggregateKind !== 'CANDIDATE' &&
    aggregateKind !== 'OPPORTUNITY' &&
    aggregateKind !== 'SCORE'
  ) {
    throw persistenceError('Malformed persisted history: aggregateKind.');
  }
  if (!Array.isArray(record.reasonCodes)) {
    throw persistenceError('Malformed persisted history: reasonCodes.');
  }
  return {
    kind: requiredString(record, 'kind', 'OpportunityHistoryRecord') as OpportunityHistoryRecord['kind'],
    organizationId: requiredString(record, 'organizationId', 'OpportunityHistoryRecord'),
    clientId: requiredString(record, 'clientId', 'OpportunityHistoryRecord'),
    aggregateKind,
    aggregateId: requiredString(record, 'aggregateId', 'OpportunityHistoryRecord'),
    aggregateVersion: requiredNumber(record, 'aggregateVersion', 'OpportunityHistoryRecord'),
    actorKind: requiredString(record, 'actorKind', 'OpportunityHistoryRecord'),
    reasonCodes: record.reasonCodes.map(String),
    materialFingerprint: requiredString(
      record,
      'materialFingerprint',
      'OpportunityHistoryRecord'
    ),
    occurredAt: requiredString(record, 'occurredAt', 'OpportunityHistoryRecord'),
    authority: 'AUDIT_ONLY',
    id: typeof record.id === 'string' ? record.id : undefined,
  };
}

export interface StoredIdempotencyRecord {
  key: string;
  aggregateKind: 'CANDIDATE' | 'OPPORTUNITY';
  aggregateId: string;
  organizationId: string;
  clientId: string;
  at: string;
}

export function parseStoredIdempotency(raw: unknown): StoredIdempotencyRecord {
  const record = asRecord(raw, 'IdempotencyRecord');
  const aggregateKind = record.aggregateKind;
  if (aggregateKind !== 'CANDIDATE' && aggregateKind !== 'OPPORTUNITY') {
    throw persistenceError('Malformed persisted idempotency: aggregateKind.');
  }
  return {
    key: requiredString(record, 'key', 'IdempotencyRecord'),
    aggregateKind,
    aggregateId: requiredString(record, 'aggregateId', 'IdempotencyRecord'),
    organizationId: requiredString(record, 'organizationId', 'IdempotencyRecord'),
    clientId: requiredString(record, 'clientId', 'IdempotencyRecord'),
    at: requiredString(record, 'at', 'IdempotencyRecord'),
  };
}
