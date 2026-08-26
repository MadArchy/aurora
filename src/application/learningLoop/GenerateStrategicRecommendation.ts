/**
 * SPEC-008 Phase 2 — GenerateStrategicRecommendation (T-008-203).
 * Creating a recommendation does NOT approve it.
 */

import { assertConfidenceNotApprovalAuthority } from '../../domain/learningAuthorityCore';
import {
  createLearningHistoryRecord,
  learningCommandFingerprint,
  recommendationMaterialFingerprint,
} from '../../domain/learningMaterialityCore';
import { projectStrategicRecommendationExplainability } from '../../domain/learningExplainabilityCore';
import { transitionStrategicRecommendationStatus } from '../../domain/learningAuthorityCore';
import {
  createStrategicRecommendation,
  type ExpectedImpact,
  type ProposedChange,
  type RecommendationConfidence,
  type RecommendationType,
  type TargetAuthority,
} from '../../domain/strategicRecommendationCore';
import type { ThesisScope } from '../../domain/learningThesisScopeCore';
import { commitGovernedLearningWriteUnit } from './commitWriteUnit';
import { LearningApplicationError } from './errors';
import { loadAuthoritativeEvidence } from './loadAggregates';
import { unwrapDomain } from './mapDomainError';
import type { LearningHistoryPort } from './ports/LearningHistoryPort';
import type { StrategicRecommendationRepository } from './ports/StrategicRecommendationRepository';
import type { LearningEvidenceRepository } from './ports/LearningEvidenceRepository';
import {
  assertNoTenantSpoof,
  assertTrustedLearningActor,
  ignoreCallerActorClaims,
  resolveTrustedLearningActorKind,
  trustedTenant,
  type TrustedLearningActorContext,
} from './trustedContext';

export interface GenerateStrategicRecommendationInput {
  trusted: TrustedLearningActorContext;
  recommendationId: string;
  thesisScope: ThesisScope;
  learningEvidenceId: string;
  recommendationType: RecommendationType;
  targetAuthority: TargetAuthority;
  proposedChange: ProposedChange;
  rationale: string;
  confidence: RecommendationConfidence;
  risks: readonly string[];
  expectedImpact: ExpectedImpact;
  sourceObservationIds?: readonly string[];
  sourceOutcomeIds?: readonly string[];
  sourceResultIds?: readonly string[];
  sourceOpportunityIds?: readonly string[];
  intentKey: string;
  /** Caller claiming APPROVED — IGNORED. */
  forgedStatus?: string;
  forgedApproved?: boolean;
  approvedBy?: string;
  forgedRecommendation?: unknown;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  actorType?: string;
  role?: string;
  softwareAuthority?: boolean;
  persist?: boolean;
}

export interface GenerateStrategicRecommendationDeps {
  evidence: LearningEvidenceRepository;
  recommendations: StrategicRecommendationRepository;
  history: LearningHistoryPort;
}

export function createGenerateStrategicRecommendation(
  deps: GenerateStrategicRecommendationDeps
) {
  return function generateStrategicRecommendation(input: GenerateStrategicRecommendationInput) {
    assertTrustedLearningActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedStatus;
    void input.forgedApproved;
    void input.forgedRecommendation;

    const actorKind = resolveTrustedLearningActorKind(input.trusted, 'generate');
    const tenant = trustedTenant(input.trusted);

    unwrapDomain(
      assertConfidenceNotApprovalAuthority({
        confidence: input.confidence,
        attemptingApprovalWithoutHuman: Boolean(input.forgedApproved || input.forgedStatus === 'APPROVED'),
      })
    );

    const intentKey = input.intentKey?.trim();
    if (!intentKey) {
      throw new LearningApplicationError(
        'INVALID_RECOMMENDATION',
        'intentKey is required for recommendation idempotency.'
      );
    }

    const idemKey = learningCommandFingerprint({
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      command: 'GenerateStrategicRecommendation',
      intentKey,
    });

    const existingKey = deps.recommendations.findByIdempotencyKey(tenant, idemKey);
    if (existingKey) {
      const existing = deps.recommendations.getById(existingKey.recommendationId, tenant);
      if (existing) {
        return {
          recommendation: existing,
          created: false,
          writeUnitCommitted: false,
          explainability: projectStrategicRecommendationExplainability(existing),
        };
      }
    }

    const evidence = loadAuthoritativeEvidence(
      deps.evidence,
      input.trusted,
      input.learningEvidenceId
    );

    const sourceObservationIds =
      input.sourceObservationIds && input.sourceObservationIds.length > 0
        ? input.sourceObservationIds
        : evidence.observationIds;

    const draft = unwrapDomain(
      createStrategicRecommendation({
        recommendationId: input.recommendationId,
        organizationId: tenant.organizationId,
        clientId: tenant.clientId,
        thesisScope: input.thesisScope,
        sourceObservationIds,
        sourceOutcomeIds: input.sourceOutcomeIds,
        sourceResultIds: input.sourceResultIds,
        sourceOpportunityIds: input.sourceOpportunityIds,
        learningEvidenceId: evidence.evidenceId,
        recommendationType: input.recommendationType,
        targetAuthority: input.targetAuthority,
        proposedChange: input.proposedChange,
        rationale: input.rationale,
        confidence: input.confidence,
        risks: input.risks,
        expectedImpact: input.expectedImpact,
        status: 'DRAFT',
        createdBy: input.trusted.actorId,
        createdAt: input.trusted.now,
        updatedAt: input.trusted.now,
      })
    );

    const recommendation = unwrapDomain(
      transitionStrategicRecommendationStatus({
        recommendation: draft,
        to: 'PROPOSED',
        actorKind,
        updatedAt: input.trusted.now,
      })
    );

    const history = createLearningHistoryRecord({
      kind: 'RECOMMENDATION_PROPOSED',
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      aggregateKind: 'RECOMMENDATION',
      aggregateId: recommendation.recommendationId,
      aggregateVersion: recommendation.version,
      actorKind,
      reasonCodes: ['RECOMMENDATION_PROPOSED', 'TARGET_SPEC_AUTHORITY_PRESERVED'],
      materialFingerprint: recommendationMaterialFingerprint(recommendation),
      occurredAt: input.trusted.now,
    });

    let writeUnitCommitted = false;
    if (input.persist !== false) {
      commitGovernedLearningWriteUnit(
        { recommendations: deps.recommendations, history: deps.history },
        {
          recommendations: [recommendation],
          history: [history],
          idempotencyKeys: [
            {
              key: idemKey,
              aggregateKind: 'RECOMMENDATION',
              aggregateId: recommendation.recommendationId,
              organizationId: tenant.organizationId,
              clientId: tenant.clientId,
              materialFingerprint: recommendationMaterialFingerprint(recommendation),
              at: input.trusted.now,
            },
          ],
        }
      );
      writeUnitCommitted = true;
    }

    return {
      recommendation,
      created: true,
      writeUnitCommitted,
      explainability: projectStrategicRecommendationExplainability(recommendation),
    };
  };
}
