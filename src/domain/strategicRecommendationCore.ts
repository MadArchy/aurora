/**
 * SPEC-008 Phase 1 — StrategicRecommendation aggregate (pure).
 * Recommendation ≠ approval ≠ application ≠ target-SPEC mutation.
 */

import { lrnFail, lrnOk, type LearningDomainResult } from './learningLoopErrors';
import {
  assertLearningTenantKeyedId,
  assertSameOrgClientLearningEntity,
} from './learningTenantCore';
import {
  assertThesisScope,
  type ThesisScope,
} from './learningThesisScopeCore';
import type { RecommendationStatus } from './recommendationLifecycleCore';

export const STRATEGIC_RECOMMENDATION_SCHEMA_VERSION =
  'strategic-recommendation-v1' as const;

export const RECOMMENDATION_TYPES = [
  'THESIS',
  'STRATEGIC_SCORE_CONFIGURATION',
  'VOICE',
  'AUDIENCE',
  'OBJECTIVE',
  'CONTENT_STRATEGY',
  'CHANNEL_STRATEGY',
  'OPPORTUNITY_STRATEGY',
  'OTHER',
] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_CONFIDENCE_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type RecommendationConfidence = (typeof RECOMMENDATION_CONFIDENCE_LEVELS)[number];

export interface TargetAuthority {
  specId: string;
  domain: string;
}

export interface ProposedChange {
  changeKind: string;
  payload: Record<string, unknown>;
  schemaVersion: string;
}

export interface ExpectedImpact {
  summary: string;
  metrics?: Array<{ key: string; direction: 'INCREASE' | 'DECREASE' | 'NEUTRAL' }>;
}

export interface StrategicRecommendation {
  recommendationId: string;
  organizationId: string;
  clientId: string;
  thesisScope: ThesisScope;
  sourceObservationIds: string[];
  sourceOutcomeIds?: string[];
  sourceResultIds?: string[];
  sourceOpportunityIds?: string[];
  learningEvidenceId: string;
  recommendationType: RecommendationType;
  targetAuthority: TargetAuthority;
  proposedChange: ProposedChange;
  rationale: string;
  confidence: RecommendationConfidence;
  risks: string[];
  expectedImpact: ExpectedImpact;
  status: RecommendationStatus;
  version: number;
  schemaVersion: typeof STRATEGIC_RECOMMENDATION_SCHEMA_VERSION;
  createdBy: string;
  reviewedBy?: string;
  approvedBy?: string;
  appliedBy?: string;
  createdAt: string;
  updatedAt: string;
  supersedesRecommendationId?: string;
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

export function assertTargetAuthority(
  target: TargetAuthority
): LearningDomainResult<TargetAuthority> {
  const specId = nonEmpty(target.specId);
  const domain = nonEmpty(target.domain);
  if (!specId || !domain) {
    return lrnFail('TARGET_MISMATCH', 'targetAuthority requires specId and domain');
  }
  return lrnOk({ specId, domain });
}

export function assertProposedChange(
  change: ProposedChange
): LearningDomainResult<ProposedChange> {
  const changeKind = nonEmpty(change.changeKind);
  const schemaVersion = nonEmpty(change.schemaVersion);
  if (!changeKind || !schemaVersion) {
    return lrnFail('MALFORMED_RECOMMENDATION', 'proposedChange requires changeKind and schemaVersion');
  }
  if (!change.payload || typeof change.payload !== 'object') {
    return lrnFail('MALFORMED_RECOMMENDATION', 'proposedChange.payload must be an object');
  }
  return lrnOk({
    changeKind,
    schemaVersion,
    payload: { ...change.payload },
  });
}

export function assertRecommendationConfidence(
  confidence: unknown
): LearningDomainResult<RecommendationConfidence> {
  if (
    typeof confidence !== 'string' ||
    !(RECOMMENDATION_CONFIDENCE_LEVELS as readonly string[]).includes(confidence)
  ) {
    return lrnFail('MALFORMED_RECOMMENDATION', 'confidence must be LOW | MEDIUM | HIGH');
  }
  return lrnOk(confidence as RecommendationConfidence);
}

export function createStrategicRecommendation(input: {
  recommendationId: string;
  organizationId: string;
  clientId: string;
  thesisScope: ThesisScope;
  sourceObservationIds: readonly string[];
  sourceOutcomeIds?: readonly string[];
  sourceResultIds?: readonly string[];
  sourceOpportunityIds?: readonly string[];
  learningEvidenceId: string;
  recommendationType: RecommendationType;
  targetAuthority: TargetAuthority;
  proposedChange: ProposedChange;
  rationale: string;
  confidence: RecommendationConfidence;
  risks: readonly string[];
  expectedImpact: ExpectedImpact;
  status?: RecommendationStatus;
  version?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  supersedesRecommendationId?: string;
}): LearningDomainResult<StrategicRecommendation> {
  const keyed = assertLearningTenantKeyedId({
    id: input.recommendationId,
    organizationId: input.organizationId,
    clientId: input.clientId,
  });
  if (!keyed.ok) return keyed;

  const scope = assertThesisScope(input.thesisScope);
  if (!scope.ok) return scope;

  const sourceObservationIds = uniqueSorted(input.sourceObservationIds);
  if (sourceObservationIds.length === 0) {
    return lrnFail(
      'MALFORMED_RECOMMENDATION',
      'at least one sourceObservationId is required'
    );
  }

  const learningEvidenceId = nonEmpty(input.learningEvidenceId);
  if (!learningEvidenceId) {
    return lrnFail('MALFORMED_RECOMMENDATION', 'learningEvidenceId is required');
  }

  if (!(RECOMMENDATION_TYPES as readonly string[]).includes(input.recommendationType)) {
    return lrnFail(
      'MALFORMED_RECOMMENDATION',
      `invalid recommendationType=${input.recommendationType}`
    );
  }

  const target = assertTargetAuthority(input.targetAuthority);
  if (!target.ok) return target;

  const proposed = assertProposedChange(input.proposedChange);
  if (!proposed.ok) return proposed;

  const confidence = assertRecommendationConfidence(input.confidence);
  if (!confidence.ok) return confidence;

  const rationale = nonEmpty(input.rationale);
  if (!rationale) {
    return lrnFail('MALFORMED_RECOMMENDATION', 'rationale is required');
  }

  const createdBy = nonEmpty(input.createdBy);
  if (!createdBy) {
    return lrnFail('MALFORMED_RECOMMENDATION', 'createdBy is required');
  }

  const createdAt = nonEmpty(input.createdAt);
  const updatedAt = nonEmpty(input.updatedAt);
  if (!createdAt || !updatedAt) {
    return lrnFail('MALFORMED_RECOMMENDATION', 'createdAt and updatedAt are required');
  }

  const version = input.version ?? 1;
  if (!Number.isInteger(version) || version < 1) {
    return lrnFail('INVALID_VERSION', 'version must be a positive integer');
  }

  const status = input.status ?? 'DRAFT';

  return lrnOk({
    recommendationId: keyed.value.id,
    organizationId: keyed.value.organizationId,
    clientId: keyed.value.clientId,
    thesisScope: scope.value,
    sourceObservationIds,
    sourceOutcomeIds: input.sourceOutcomeIds
      ? uniqueSorted(input.sourceOutcomeIds)
      : undefined,
    sourceResultIds: input.sourceResultIds
      ? uniqueSorted(input.sourceResultIds)
      : undefined,
    sourceOpportunityIds: input.sourceOpportunityIds
      ? uniqueSorted(input.sourceOpportunityIds)
      : undefined,
    learningEvidenceId,
    recommendationType: input.recommendationType,
    targetAuthority: target.value,
    proposedChange: proposed.value,
    rationale,
    confidence: confidence.value,
    risks: [...input.risks],
    expectedImpact: {
      summary: nonEmpty(input.expectedImpact.summary) ?? '',
      metrics: input.expectedImpact.metrics?.map((m) => ({ ...m })),
    },
    status,
    version,
    schemaVersion: STRATEGIC_RECOMMENDATION_SCHEMA_VERSION,
    createdBy,
    createdAt,
    updatedAt,
    supersedesRecommendationId: input.supersedesRecommendationId?.trim() || undefined,
  });
}

export function assertRecommendationTenantMatch(
  recommendation: StrategicRecommendation,
  envelope: { organizationId: string; clientId: string }
): LearningDomainResult<void> {
  return assertSameOrgClientLearningEntity(recommendation, envelope, 'recommendation');
}

