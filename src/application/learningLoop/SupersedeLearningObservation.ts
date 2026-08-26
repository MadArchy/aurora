/**
 * SPEC-008 Phase 2 — SupersedeLearningObservation (T-008-201).
 */

import {
  createLearningObservation,
  markObservationSuperseded,
  supersedeLearningObservation,
  type LearningObservationKind,
  type LearningSourceKind,
  type LearningSourceRef,
} from '../../domain/learningObservationCore';
import {
  createLearningHistoryRecord,
  observationMaterialFingerprint,
} from '../../domain/learningMaterialityCore';
import { projectLearningObservationExplainability } from '../../domain/learningExplainabilityCore';
import type { ThesisScope } from '../../domain/learningThesisScopeCore';
import { commitGovernedLearningWriteUnit } from './commitWriteUnit';
import { loadAuthoritativeObservation } from './loadAggregates';
import { unwrapDomain } from './mapDomainError';
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

export interface SupersedeLearningObservationInput {
  trusted: TrustedLearningActorContext;
  priorObservationId: string;
  successorObservationId: string;
  thesisScope: ThesisScope;
  sourceKind: LearningSourceKind;
  sourceRef: LearningSourceRef;
  observationKind: LearningObservationKind;
  payload: Record<string, unknown>;
  supersessionReason?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  forgedPriorObservation?: unknown;
  forgedSuccessorObservation?: unknown;
  actorType?: string;
  role?: string;
  persist?: boolean;
}

export interface SupersedeLearningObservationDeps {
  observations: LearningObservationRepository;
  history: LearningHistoryPort;
}

export function createSupersedeLearningObservation(deps: SupersedeLearningObservationDeps) {
  return function supersedeLearningObservationUseCase(
    input: SupersedeLearningObservationInput
  ) {
    assertTrustedLearningActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedPriorObservation;
    void input.forgedSuccessorObservation;

    const actorKind = resolveTrustedLearningActorKind(input.trusted, 'observation');
    const tenant = trustedTenant(input.trusted);

    const prior = loadAuthoritativeObservation(
      deps.observations,
      input.trusted,
      input.priorObservationId
    );

    const successor = unwrapDomain(
      createLearningObservation({
        observationId: input.successorObservationId,
        organizationId: tenant.organizationId,
        clientId: tenant.clientId,
        thesisScope: input.thesisScope,
        sourceKind: input.sourceKind,
        sourceRef: input.sourceRef,
        observationKind: input.observationKind,
        payload: input.payload,
        actorUid: input.trusted.actorId,
        recordedAt: input.trusted.now,
        supersedesObservationId: prior.observationId,
        supersessionReason: input.supersessionReason,
      })
    );

    unwrapDomain(supersedeLearningObservation({ prior, successor }));
    const supersededPrior = unwrapDomain(markObservationSuperseded(prior));

    const history = [
      createLearningHistoryRecord({
        kind: 'OBSERVATION_SUPERSEDED',
        organizationId: tenant.organizationId,
        clientId: tenant.clientId,
        aggregateKind: 'OBSERVATION',
        aggregateId: prior.observationId,
        aggregateVersion: 1,
        actorKind,
        reasonCodes: ['OBSERVATION_SUPERSEDED'],
        materialFingerprint: observationMaterialFingerprint(supersededPrior),
        occurredAt: input.trusted.now,
      }),
      createLearningHistoryRecord({
        kind: 'OBSERVATION_REGISTERED',
        organizationId: tenant.organizationId,
        clientId: tenant.clientId,
        aggregateKind: 'OBSERVATION',
        aggregateId: successor.observationId,
        aggregateVersion: 1,
        actorKind,
        reasonCodes: ['OBSERVATION_REGISTERED'],
        materialFingerprint: observationMaterialFingerprint(successor),
        occurredAt: input.trusted.now,
      }),
    ];

    let writeUnitCommitted = false;
    if (input.persist !== false) {
      commitGovernedLearningWriteUnit(deps, {
        observations: [supersededPrior, successor],
        history,
      });
      writeUnitCommitted = true;
    }

    return {
      prior: supersededPrior,
      successor,
      writeUnitCommitted,
      explainability: projectLearningObservationExplainability(successor),
    };
  };
}
