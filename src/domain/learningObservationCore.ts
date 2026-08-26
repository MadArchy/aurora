/**
 * SPEC-008 Phase 1 — LearningObservation aggregate (pure).
 * Append-only semantics; supersession via new observation — not silent replace.
 */

import { lrnFail, lrnOk, type LearningDomainResult } from './learningLoopErrors';
import {
  assertLearningTenantKeyedId,
  assertSameOrgClientLearningEntity,
  type LearningTenantEnvelope,
} from './learningTenantCore';
import {
  assertThesisScope,
  type ThesisScope,
} from './learningThesisScopeCore';

export const LEARNING_OBSERVATION_SCHEMA_VERSION = 'learning-observation-v1' as const;

export const LEARNING_SOURCE_KINDS = [
  'SIGNAL_OUTCOME',
  'RESULT_RECORD',
  'FEEDBACK_EVENT',
  'OPPORTUNITY_OUTCOME',
  'OTHER',
] as const;
export type LearningSourceKind = (typeof LEARNING_SOURCE_KINDS)[number];

export const LEARNING_OBSERVATION_KINDS = [
  'USEFUL',
  'NOT_USEFUL',
  'KPI',
  'CONTENT_APPROVED',
  'CONTENT_MODIFIED',
  'CONTENT_REJECTED',
  'OPPORTUNITY_ACCEPTED',
  'OPPORTUNITY_DECLINED',
  'OPPORTUNITY_SUBMITTED',
  'OPPORTUNITY_COMPLETED',
  'OTHER',
] as const;
export type LearningObservationKind = (typeof LEARNING_OBSERVATION_KINDS)[number];

export const LEARNING_OBSERVATION_STATUSES = [
  'ACTIVE',
  'SUPERSEDED',
  'CORRECTED',
] as const;
export type LearningObservationStatus = (typeof LEARNING_OBSERVATION_STATUSES)[number];

export interface LearningSourceRef {
  sourceSpec: string;
  sourceId: string;
  sourceVersion?: string;
}

export interface LearningObservationPayload {
  /** Structured observation body — schema-versioned at aggregate level. */
  [key: string]: unknown;
}

export interface LearningObservation {
  observationId: string;
  organizationId: string;
  clientId: string;
  thesisScope: ThesisScope;
  sourceKind: LearningSourceKind;
  sourceRef: LearningSourceRef;
  observationKind: LearningObservationKind;
  payload: LearningObservationPayload;
  actorUid: string;
  recordedAt: string;
  schemaVersion: typeof LEARNING_OBSERVATION_SCHEMA_VERSION;
  supersedesObservationId?: string;
  status: LearningObservationStatus;
  supersessionReason?: string;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function assertLearningSourceRef(
  ref: LearningSourceRef
): LearningDomainResult<LearningSourceRef> {
  const sourceSpec = nonEmpty(ref.sourceSpec);
  const sourceId = nonEmpty(ref.sourceId);
  if (!sourceSpec || !sourceId) {
    return lrnFail('MALFORMED_OBSERVATION', 'sourceRef requires sourceSpec and sourceId');
  }
  return lrnOk({
    sourceSpec,
    sourceId,
    sourceVersion: ref.sourceVersion?.trim() || undefined,
  });
}

export function createLearningObservation(input: {
  observationId: string;
  organizationId: string;
  clientId: string;
  thesisScope: ThesisScope;
  sourceKind: LearningSourceKind;
  sourceRef: LearningSourceRef;
  observationKind: LearningObservationKind;
  payload: LearningObservationPayload;
  actorUid: string;
  recordedAt: string;
  supersedesObservationId?: string;
  status?: LearningObservationStatus;
  supersessionReason?: string;
}): LearningDomainResult<LearningObservation> {
  const keyed = assertLearningTenantKeyedId({
    id: input.observationId,
    organizationId: input.organizationId,
    clientId: input.clientId,
  });
  if (!keyed.ok) return keyed;

  const scope = assertThesisScope(input.thesisScope);
  if (!scope.ok) return scope;

  const sourceRef = assertLearningSourceRef(input.sourceRef);
  if (!sourceRef.ok) return sourceRef;

  const actorUid = nonEmpty(input.actorUid);
  if (!actorUid) {
    return lrnFail('MALFORMED_OBSERVATION', 'actorUid is required');
  }

  const recordedAt = nonEmpty(input.recordedAt);
  if (!recordedAt) {
    return lrnFail('MALFORMED_OBSERVATION', 'recordedAt is required');
  }

  if (!(LEARNING_SOURCE_KINDS as readonly string[]).includes(input.sourceKind)) {
    return lrnFail('MALFORMED_OBSERVATION', `invalid sourceKind=${input.sourceKind}`);
  }

  if (!(LEARNING_OBSERVATION_KINDS as readonly string[]).includes(input.observationKind)) {
    return lrnFail(
      'MALFORMED_OBSERVATION',
      `invalid observationKind=${input.observationKind}`
    );
  }

  const status = input.status ?? 'ACTIVE';
  if (!(LEARNING_OBSERVATION_STATUSES as readonly string[]).includes(status)) {
    return lrnFail('MALFORMED_OBSERVATION', `invalid status=${status}`);
  }

  if (input.supersedesObservationId) {
    const prior = nonEmpty(input.supersedesObservationId);
    if (!prior) {
      return lrnFail('MALFORMED_OBSERVATION', 'supersedesObservationId must be non-empty');
    }
  }

  return lrnOk({
    observationId: keyed.value.id,
    organizationId: keyed.value.organizationId,
    clientId: keyed.value.clientId,
    thesisScope: scope.value,
    sourceKind: input.sourceKind,
    sourceRef: sourceRef.value,
    observationKind: input.observationKind,
    payload: { ...input.payload },
    actorUid,
    recordedAt,
    schemaVersion: LEARNING_OBSERVATION_SCHEMA_VERSION,
    supersedesObservationId: input.supersedesObservationId?.trim() || undefined,
    status,
    supersessionReason: input.supersessionReason?.trim() || undefined,
  });
}

/**
 * Supersede prior observation by creating a successor — never in-place overwrite.
 */
export function supersedeLearningObservation(input: {
  prior: LearningObservation;
  successor: LearningObservation;
}): LearningDomainResult<LearningObservation> {
  const { prior, successor } = input;
  if (prior.status !== 'ACTIVE') {
    return lrnFail(
      'OBSERVATION_SUPERSEDED',
      `prior observation ${prior.observationId} is not ACTIVE`
    );
  }
  const tenant = assertSameOrgClientLearningEntity(prior, successor, 'observation supersession');
  if (!tenant.ok) return tenant;

  if (successor.supersedesObservationId !== prior.observationId) {
    return lrnFail(
      'MALFORMED_OBSERVATION',
      'successor must reference prior observationId in supersedesObservationId'
    );
  }

  if (successor.status !== 'ACTIVE') {
    return lrnFail('MALFORMED_OBSERVATION', 'successor must be ACTIVE');
  }

  return lrnOk(successor);
}

/** Derive current ACTIVE observation for a source from append-only history. */
export function resolveCurrentObservation(
  observations: readonly LearningObservation[],
  sourceRef: LearningSourceRef
): LearningObservation | null {
  const refKey = `${sourceRef.sourceSpec}:${sourceRef.sourceId}`;
  const matching = observations.filter(
    (o) =>
      o.status === 'ACTIVE' &&
      `${o.sourceRef.sourceSpec}:${o.sourceRef.sourceId}` === refKey
  );
  if (matching.length === 0) return null;
  return matching.reduce((latest, o) =>
    o.recordedAt >= latest.recordedAt ? o : latest
  );
}

export function markObservationSuperseded(
  observation: LearningObservation
): LearningDomainResult<LearningObservation> {
  if (observation.status !== 'ACTIVE') {
    return lrnFail(
      'OBSERVATION_SUPERSEDED',
      `observation ${observation.observationId} is already ${observation.status}`
    );
  }
  return lrnOk({ ...observation, status: 'SUPERSEDED' });
}

export function assertObservationTenantMatch(
  observation: LearningObservation,
  envelope: LearningTenantEnvelope
): LearningDomainResult<void> {
  return assertSameOrgClientLearningEntity(observation, envelope, 'observation');
}
