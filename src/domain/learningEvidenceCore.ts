/**
 * SPEC-008 Phase 1 — LearningEvidence + LearningAssessment (pure projections).
 * Evidence supports recommendation — not strategic authority.
 */

import { lrnFail, lrnOk, type LearningDomainResult } from './learningLoopErrors';
import type { LearningObservation } from './learningObservationCore';
import {
  assertLearningTenantKeyedId,
  assertSameOrgClientLearningEntity,
} from './learningTenantCore';
import {
  assertThesisScope,
  thesisScopesMatch,
  type ThesisScope,
} from './learningThesisScopeCore';

export const LEARNING_EVIDENCE_SCHEMA_VERSION = 'learning-evidence-v1' as const;

export interface LearningEvidenceMetric {
  key: string;
  label: string;
  value: number;
  unit?: string;
}

export interface LearningEvidencePattern {
  reasonCode: string;
  description: string;
  observationIds: string[];
}

export interface LearningEvidence {
  evidenceId: string;
  organizationId: string;
  clientId: string;
  thesisScope: ThesisScope;
  observationIds: string[];
  metrics: LearningEvidenceMetric[];
  patterns?: LearningEvidencePattern[];
  summary: string;
  schemaVersion: typeof LEARNING_EVIDENCE_SCHEMA_VERSION;
  builtAt: string;
}

export interface LearningAssessment {
  assessmentId: string;
  organizationId: string;
  clientId: string;
  evidenceId: string;
  thesisScope: ThesisScope;
  signalsScored: number;
  signalsUseful: number;
  signalsNotUseful: number;
  routingOverrides: number;
  contentPublished: number;
  claimFindings: number;
  claimBlocks: number;
  authorityScore: number;
  summary: string;
  builtAt: string;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function uniqueSorted(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  );
}

export function createLearningEvidence(input: {
  evidenceId: string;
  organizationId: string;
  clientId: string;
  thesisScope: ThesisScope;
  observationIds: readonly string[];
  metrics: readonly LearningEvidenceMetric[];
  patterns?: readonly LearningEvidencePattern[];
  summary: string;
  builtAt: string;
}): LearningDomainResult<LearningEvidence> {
  const keyed = assertLearningTenantKeyedId({
    id: input.evidenceId,
    organizationId: input.organizationId,
    clientId: input.clientId,
  });
  if (!keyed.ok) return keyed;

  const scope = assertThesisScope(input.thesisScope);
  if (!scope.ok) return scope;

  const observationIds = uniqueSorted(input.observationIds);
  if (observationIds.length === 0) {
    return lrnFail('MALFORMED_EVIDENCE', 'at least one observationId is required');
  }

  const summary = nonEmpty(input.summary);
  if (!summary) {
    return lrnFail('MALFORMED_EVIDENCE', 'summary is required');
  }

  const builtAt = nonEmpty(input.builtAt);
  if (!builtAt) {
    return lrnFail('MALFORMED_EVIDENCE', 'builtAt is required');
  }

  for (const metric of input.metrics) {
    if (!nonEmpty(metric.key) || !nonEmpty(metric.label)) {
      return lrnFail('MALFORMED_EVIDENCE', 'metrics require key and label');
    }
    if (typeof metric.value !== 'number' || Number.isNaN(metric.value)) {
      return lrnFail('MALFORMED_EVIDENCE', `metric ${metric.key} requires numeric value`);
    }
  }

  return lrnOk({
    evidenceId: keyed.value.id,
    organizationId: keyed.value.organizationId,
    clientId: keyed.value.clientId,
    thesisScope: scope.value,
    observationIds,
    metrics: input.metrics.map((m) => ({ ...m })),
    patterns: input.patterns?.map((p) => ({
      reasonCode: p.reasonCode,
      description: p.description,
      observationIds: uniqueSorted(p.observationIds),
    })),
    summary,
    schemaVersion: LEARNING_EVIDENCE_SCHEMA_VERSION,
    builtAt,
  });
}

export function assertObservationsCompatibleWithEvidence(
  evidence: LearningEvidence,
  observations: readonly LearningObservation[]
): LearningDomainResult<void> {
  const byId = new Map(observations.map((o) => [o.observationId, o]));
  for (const id of evidence.observationIds) {
    const obs = byId.get(id);
    if (!obs) {
      return lrnFail('MALFORMED_EVIDENCE', `observationId=${id} not found`);
    }
    const tenant = assertSameOrgClientLearningEntity(evidence, obs, 'evidence observation');
    if (!tenant.ok) return tenant;
    if (!thesisScopesMatch(evidence.thesisScope, obs.thesisScope)) {
      return lrnFail(
        'MALFORMED_EVIDENCE',
        `observation ${id} thesisScope mismatch with evidence`
      );
    }
  }
  return lrnOk(undefined);
}

export function buildLearningAssessment(input: {
  assessmentId: string;
  evidence: LearningEvidence;
  signalsScored?: number;
  signalsUseful?: number;
  signalsNotUseful?: number;
  routingOverrides?: number;
  contentPublished?: number;
  claimFindings?: number;
  claimBlocks?: number;
  authorityScore?: number;
  summary?: string;
  builtAt: string;
}): LearningDomainResult<LearningAssessment> {
  const keyed = assertLearningTenantKeyedId({
    id: input.assessmentId,
    organizationId: input.evidence.organizationId,
    clientId: input.evidence.clientId,
  });
  if (!keyed.ok) return keyed;

  const summary =
    nonEmpty(input.summary) ??
    `${input.signalsUseful ?? 0} useful / ${input.signalsNotUseful ?? 0} not useful`;

  return lrnOk({
    assessmentId: keyed.value.id,
    organizationId: keyed.value.organizationId,
    clientId: keyed.value.clientId,
    evidenceId: input.evidence.evidenceId,
    thesisScope: input.evidence.thesisScope,
    signalsScored: input.signalsScored ?? 0,
    signalsUseful: input.signalsUseful ?? 0,
    signalsNotUseful: input.signalsNotUseful ?? 0,
    routingOverrides: input.routingOverrides ?? 0,
    contentPublished: input.contentPublished ?? 0,
    claimFindings: input.claimFindings ?? 0,
    claimBlocks: input.claimBlocks ?? 0,
    authorityScore: input.authorityScore ?? 0,
    summary,
    builtAt: input.builtAt,
  });
}

/** Assessment is a pure projection — cannot authorize strategic mutation. */
export function assertAssessmentIsNonAuthoritative(): LearningDomainResult<void> {
  return lrnOk(undefined);
}
