/**
 * SPEC-008 Phase 2 — RegisterLearningObservation (T-008-201).
 */

import { createLearningObservation } from '../../domain/learningObservationCore';
import {
  createLearningHistoryRecord,
  learningCommandFingerprint,
  observationMaterialFingerprint,
} from '../../domain/learningMaterialityCore';
import { projectLearningObservationExplainability } from '../../domain/learningExplainabilityCore';
import type {
  LearningObservationKind,
  LearningSourceKind,
  LearningSourceRef,
} from '../../domain/learningObservationCore';
import type { ThesisScope } from '../../domain/learningThesisScopeCore';
import { commitGovernedLearningWriteUnit } from './commitWriteUnit';
import { LearningApplicationError } from './errors';
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

export interface RegisterLearningObservationInput {
  trusted: TrustedLearningActorContext;
  observationId: string;
  thesisScope: ThesisScope;
  sourceKind: LearningSourceKind;
  sourceRef: LearningSourceRef;
  observationKind: LearningObservationKind;
  payload: Record<string, unknown>;
  intentKey: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Caller-supplied tenant/actor — IGNORED. */
  forgedObservation?: unknown;
  actorType?: string;
  role?: string;
  actorUid?: string;
  createdBy?: string;
  persist?: boolean;
}

export interface RegisterLearningObservationDeps {
  observations: LearningObservationRepository;
  history: LearningHistoryPort;
}

export function createRegisterLearningObservation(deps: RegisterLearningObservationDeps) {
  return function registerLearningObservation(input: RegisterLearningObservationInput) {
    assertTrustedLearningActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedObservation;

    const actorKind = resolveTrustedLearningActorKind(input.trusted, 'observation');
    const tenant = trustedTenant(input.trusted);

    const intentKey = input.intentKey?.trim();
    if (!intentKey) {
      throw new LearningApplicationError(
        'INVALID_OBSERVATION',
        'intentKey is required for observation idempotency.'
      );
    }

    const idemKey = learningCommandFingerprint({
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      command: 'RegisterLearningObservation',
      intentKey,
    });

    const existingKey = deps.observations.findByIdempotencyKey(tenant, idemKey);
    if (existingKey) {
      const existing = deps.observations.getById(existingKey.observationId, tenant);
      if (existing) {
        return {
          observation: existing,
          created: false,
          writeUnitCommitted: false,
          explainability: projectLearningObservationExplainability(existing),
        };
      }
    }

    const observation = unwrapDomain(
      createLearningObservation({
        observationId: input.observationId,
        organizationId: tenant.organizationId,
        clientId: tenant.clientId,
        thesisScope: input.thesisScope,
        sourceKind: input.sourceKind,
        sourceRef: input.sourceRef,
        observationKind: input.observationKind,
        payload: input.payload,
        actorUid: input.trusted.actorId,
        recordedAt: input.trusted.now,
      })
    );

    const history = createLearningHistoryRecord({
      kind: 'OBSERVATION_REGISTERED',
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      aggregateKind: 'OBSERVATION',
      aggregateId: observation.observationId,
      aggregateVersion: 1,
      actorKind,
      reasonCodes: ['OBSERVATION_REGISTERED'],
      materialFingerprint: observationMaterialFingerprint(observation),
      occurredAt: input.trusted.now,
    });

    let writeUnitCommitted = false;
    if (input.persist !== false) {
      commitGovernedLearningWriteUnit(deps, {
        observations: [observation],
        history: [history],
        idempotencyKeys: [
          {
            key: idemKey,
            aggregateKind: 'OBSERVATION',
            aggregateId: observation.observationId,
            organizationId: tenant.organizationId,
            clientId: tenant.clientId,
            materialFingerprint: observationMaterialFingerprint(observation),
            at: input.trusted.now,
          },
        ],
      });
      writeUnitCommitted = true;
    }

    return {
      observation,
      created: true,
      writeUnitCommitted,
      explainability: projectLearningObservationExplainability(observation),
    };
  };
}
