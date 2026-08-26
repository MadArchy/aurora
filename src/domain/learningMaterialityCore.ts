/**
 * SPEC-008 Phase 1 — Materiality / supersession / version + history intents (pure).
 * History = AUDIT_ONLY; never current authority.
 */

import type { LearningEvidence } from './learningEvidenceCore';
import type { LearningObservation } from './learningObservationCore';
import { lrnFail, lrnOk, type LearningDomainResult } from './learningLoopErrors';
import type { StrategicRecommendation } from './strategicRecommendationCore';
import { thesisScopeFingerprint } from './learningThesisScopeCore';

function uniqueSorted(ids: readonly string[]): string[] {
  return [...new Set(ids)].slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export interface RecommendationMaterialSnapshot {
  organizationId: string;
  clientId: string;
  thesisScope: string;
  recommendationType: string;
  targetAuthority: { specId: string; domain: string };
  proposedChange: { changeKind: string; schemaVersion: string; payload: Record<string, unknown> };
  learningEvidenceId: string;
  sourceObservationIds: string[];
  confidence: string;
  risks: string[];
  expectedImpactSummary: string;
  status: string;
}

export function toRecommendationMaterialSnapshot(
  recommendation: StrategicRecommendation
): RecommendationMaterialSnapshot {
  return {
    organizationId: recommendation.organizationId,
    clientId: recommendation.clientId,
    thesisScope: thesisScopeFingerprint(recommendation.thesisScope),
    recommendationType: recommendation.recommendationType,
    targetAuthority: { ...recommendation.targetAuthority },
    proposedChange: {
      changeKind: recommendation.proposedChange.changeKind,
      schemaVersion: recommendation.proposedChange.schemaVersion,
      payload: { ...recommendation.proposedChange.payload },
    },
    learningEvidenceId: recommendation.learningEvidenceId,
    sourceObservationIds: uniqueSorted(recommendation.sourceObservationIds),
    confidence: recommendation.confidence,
    risks: uniqueSorted(recommendation.risks),
    expectedImpactSummary: recommendation.expectedImpact.summary,
    status: recommendation.status,
  };
}

export function recommendationMaterialFingerprint(
  recommendation: StrategicRecommendation
): string {
  return JSON.stringify(toRecommendationMaterialSnapshot(recommendation));
}

/**
 * Material change at same id requires version increment / supersession — no silent overwrite.
 */
export function assertMaterialNotSilentlyOverwritten(input: {
  beforeVersion: number;
  afterVersion: number;
  beforeFingerprint: string;
  afterFingerprint: string;
  afterStatus: string;
}): LearningDomainResult<void> {
  if (input.beforeFingerprint === input.afterFingerprint) {
    return lrnOk(undefined);
  }
  if (input.afterStatus === 'APPROVED' || input.afterStatus === 'APPLIED') {
    return lrnFail(
      'MATERIAL_CHANGE_REQUIRES_REVISION',
      'post-approval material mutation requires supersession/new revision'
    );
  }
  if (input.afterVersion <= input.beforeVersion) {
    return lrnFail(
      'MATERIAL_CHANGE_REQUIRES_REVISION',
      'material change requires version increment / supersession'
    );
  }
  return lrnOk(undefined);
}

export function assertVersionMonotonic(input: {
  beforeVersion: number;
  afterVersion: number;
}): LearningDomainResult<void> {
  if (!Number.isInteger(input.afterVersion) || input.afterVersion < 1) {
    return lrnFail('INVALID_VERSION', 'version must be a positive integer');
  }
  if (input.afterVersion < input.beforeVersion) {
    return lrnFail('INVALID_VERSION', 'version regression denied');
  }
  return lrnOk(undefined);
}

export type LearningHistoryEventKind =
  | 'OBSERVATION_REGISTERED'
  | 'OBSERVATION_SUPERSEDED'
  | 'EVIDENCE_BUILT'
  | 'RECOMMENDATION_PROPOSED'
  | 'RECOMMENDATION_TRANSITION'
  | 'RECOMMENDATION_SUPERSEDED'
  | 'RECOMMENDATION_DECISION'
  | 'RECOMMENDATION_APPLY_ATTEMPT';

export interface LearningHistoryRecord {
  kind: LearningHistoryEventKind;
  organizationId: string;
  clientId: string;
  aggregateKind: 'OBSERVATION' | 'EVIDENCE' | 'RECOMMENDATION' | 'DECISION';
  aggregateId: string;
  aggregateVersion: number;
  actorKind: string;
  reasonCodes: string[];
  materialFingerprint: string;
  occurredAt: string;
  /** Explicit non-authority marker. */
  authority: 'AUDIT_ONLY';
}

export function createLearningHistoryRecord(input: {
  kind: LearningHistoryEventKind;
  organizationId: string;
  clientId: string;
  aggregateKind: LearningHistoryRecord['aggregateKind'];
  aggregateId: string;
  aggregateVersion: number;
  actorKind: string;
  reasonCodes: readonly string[];
  materialFingerprint: string;
  occurredAt: string;
}): LearningHistoryRecord {
  return {
    ...input,
    reasonCodes: [...input.reasonCodes],
    authority: 'AUDIT_ONLY',
  };
}

/** History replay must not become current authority. */
export function assertHistoryIsNonAuthoritative(
  record: LearningHistoryRecord
): LearningDomainResult<void> {
  if (record.authority !== 'AUDIT_ONLY') {
    return lrnFail('AUTO_MUTATION_FORBIDDEN', 'history cannot be current authority');
  }
  return lrnOk(undefined);
}

/** Deterministic command fingerprint for later idempotency (no durable replay in Domain). */
export function learningCommandFingerprint(parts: {
  organizationId: string;
  clientId: string;
  command: string;
  intentKey: string;
}): string {
  return [parts.organizationId, parts.clientId, parts.command, parts.intentKey].join('|');
}

export function observationMaterialFingerprint(observation: LearningObservation): string {
  return JSON.stringify({
    observationId: observation.observationId,
    sourceKind: observation.sourceKind,
    sourceRef: observation.sourceRef,
    observationKind: observation.observationKind,
    thesisScope: thesisScopeFingerprint(observation.thesisScope),
    status: observation.status,
  });
}

export function evidenceMaterialFingerprint(evidence: LearningEvidence): string {
  return JSON.stringify({
    evidenceId: evidence.evidenceId,
    observationIds: uniqueSorted(evidence.observationIds),
    thesisScope: thesisScopeFingerprint(evidence.thesisScope),
    metrics: evidence.metrics.map((m) => ({ key: m.key, value: m.value })),
  });
}
