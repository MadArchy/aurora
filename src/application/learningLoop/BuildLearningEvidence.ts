/**
 * SPEC-008 Phase 2 — BuildLearningEvidence / BuildLearningAssessment (T-008-202).
 */

import {
  assertObservationsCompatibleWithEvidence,
  buildLearningAssessment,
  createLearningEvidence,
  type LearningEvidenceMetric,
  type LearningEvidencePattern,
} from '../../domain/learningEvidenceCore';
import {
  createLearningHistoryRecord,
  evidenceMaterialFingerprint,
  learningCommandFingerprint,
} from '../../domain/learningMaterialityCore';
import {
  projectLearningAssessmentExplainability,
  projectLearningEvidenceExplainability,
} from '../../domain/learningExplainabilityCore';
import type { ThesisScope } from '../../domain/learningThesisScopeCore';
import { commitGovernedLearningWriteUnit } from './commitWriteUnit';
import { LearningApplicationError } from './errors';
import { loadAuthoritativeObservation } from './loadAggregates';
import { unwrapDomain } from './mapDomainError';
import type { LearningEvidenceRepository } from './ports/LearningEvidenceRepository';
import type { LearningHistoryPort } from './ports/LearningHistoryPort';
import type { LearningObservationRepository } from './ports/LearningObservationRepository';
import {
  assertNoTenantSpoof,
  assertTrustedLearningActor,
  ignoreCallerActorClaims,
  resolveTrustedLearningActorKind,
  trustedTenant,
  type TrustedLearningActorContext,
} from './trustedContext';

export interface BuildLearningEvidenceInput {
  trusted: TrustedLearningActorContext;
  evidenceId: string;
  thesisScope: ThesisScope;
  observationIds: readonly string[];
  metrics: readonly LearningEvidenceMetric[];
  patterns?: readonly LearningEvidencePattern[];
  summary: string;
  intentKey: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Caller fabricated evidence — IGNORED. */
  forgedEvidence?: unknown;
  forgedObservations?: unknown;
  actorType?: string;
  role?: string;
  persist?: boolean;
}

export interface BuildLearningEvidenceDeps {
  observations: LearningObservationRepository;
  evidence: LearningEvidenceRepository;
  history: LearningHistoryPort;
}

export function createBuildLearningEvidence(deps: BuildLearningEvidenceDeps) {
  return function buildLearningEvidence(input: BuildLearningEvidenceInput) {
    assertTrustedLearningActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedEvidence;
    void input.forgedObservations;

    const actorKind = resolveTrustedLearningActorKind(input.trusted, 'observation');
    const tenant = trustedTenant(input.trusted);

    const intentKey = input.intentKey?.trim();
    if (!intentKey) {
      throw new LearningApplicationError(
        'INVALID_EVIDENCE',
        'intentKey is required for evidence idempotency.'
      );
    }

    const idemKey = learningCommandFingerprint({
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      command: 'BuildLearningEvidence',
      intentKey,
    });

    const existingKey = deps.evidence.findByIdempotencyKey(tenant, idemKey);
    if (existingKey) {
      const existing = deps.evidence.getById(existingKey.evidenceId, tenant);
      if (existing) {
        return {
          evidence: existing,
          created: false,
          writeUnitCommitted: false,
          explainability: projectLearningEvidenceExplainability(existing),
        };
      }
    }

    const loadedObservations = input.observationIds.map((id) =>
      loadAuthoritativeObservation(deps.observations, input.trusted, id)
    );

    const evidence = unwrapDomain(
      createLearningEvidence({
        evidenceId: input.evidenceId,
        organizationId: tenant.organizationId,
        clientId: tenant.clientId,
        thesisScope: input.thesisScope,
        observationIds: input.observationIds,
        metrics: input.metrics,
        patterns: input.patterns,
        summary: input.summary,
        builtAt: input.trusted.now,
      })
    );

    unwrapDomain(assertObservationsCompatibleWithEvidence(evidence, loadedObservations));

    const history = createLearningHistoryRecord({
      kind: 'EVIDENCE_BUILT',
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      aggregateKind: 'EVIDENCE',
      aggregateId: evidence.evidenceId,
      aggregateVersion: 1,
      actorKind,
      reasonCodes: ['EVIDENCE_BUILT'],
      materialFingerprint: evidenceMaterialFingerprint(evidence),
      occurredAt: input.trusted.now,
    });

    let writeUnitCommitted = false;
    if (input.persist !== false) {
      commitGovernedLearningWriteUnit(deps, {
        evidence: [evidence],
        history: [history],
        idempotencyKeys: [
          {
            key: idemKey,
            aggregateKind: 'EVIDENCE',
            aggregateId: evidence.evidenceId,
            organizationId: tenant.organizationId,
            clientId: tenant.clientId,
            materialFingerprint: evidenceMaterialFingerprint(evidence),
            at: input.trusted.now,
          },
        ],
      });
      writeUnitCommitted = true;
    }

    return {
      evidence,
      created: true,
      writeUnitCommitted,
      explainability: projectLearningEvidenceExplainability(evidence),
    };
  };
}

export interface BuildLearningAssessmentInput {
  trusted: TrustedLearningActorContext;
  assessmentId: string;
  evidenceId: string;
  signalsScored?: number;
  signalsUseful?: number;
  signalsNotUseful?: number;
  routingOverrides?: number;
  contentPublished?: number;
  claimFindings?: number;
  claimBlocks?: number;
  authorityScore?: number;
  summary?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedAssessment?: unknown;
  forgedEvidence?: unknown;
  actorType?: string;
  role?: string;
  persist?: boolean;
}

export interface BuildLearningAssessmentDeps {
  evidence: LearningEvidenceRepository;
}

export function createBuildLearningAssessment(deps: BuildLearningAssessmentDeps) {
  return function buildLearningAssessmentUseCase(input: BuildLearningAssessmentInput) {
    assertTrustedLearningActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedAssessment;
    void input.forgedEvidence;

    const evidence = deps.evidence.getById(input.evidenceId, trustedTenant(input.trusted));
    if (!evidence) {
      throw new LearningApplicationError(
        'EVIDENCE_NOT_FOUND',
        `LearningEvidence not found: ${input.evidenceId}`
      );
    }

    const assessment = unwrapDomain(
      buildLearningAssessment({
        assessmentId: input.assessmentId,
        evidence,
        signalsScored: input.signalsScored,
        signalsUseful: input.signalsUseful,
        signalsNotUseful: input.signalsNotUseful,
        routingOverrides: input.routingOverrides,
        contentPublished: input.contentPublished,
        claimFindings: input.claimFindings,
        claimBlocks: input.claimBlocks,
        authorityScore: input.authorityScore,
        summary: input.summary,
        builtAt: input.trusted.now,
      })
    );

    return {
      assessment,
      explainability: projectLearningAssessmentExplainability(assessment),
    };
  };
}
