/**
 * SPEC-008 Phase 2 — ApplyApprovedRecommendation + TargetSpecApplyPort registry (T-008-206).
 */

import {
  assertRecommendationApplyGate,
  assertTargetSpecAuthorityPreserved,
  transitionStrategicRecommendationStatus,
} from '../../domain/learningAuthorityCore';
import {
  assertCanApplyRecommendation,
  assertNotSuperseded,
} from '../../domain/recommendationLifecycleCore';
import {
  createLearningHistoryRecord,
  learningCommandFingerprint,
  recommendationMaterialFingerprint,
} from '../../domain/learningMaterialityCore';
import { projectStrategicRecommendationExplainability } from '../../domain/learningExplainabilityCore';
import type { RecommendationStatus } from '../../domain/recommendationLifecycleCore';
import { commitGovernedLearningWriteUnit } from './commitWriteUnit';
import { LearningApplicationError } from './errors';
import { loadAuthoritativeRecommendation } from './loadAggregates';
import { unwrapDomain } from './mapDomainError';
import type { LearningHistoryPort } from './ports/LearningHistoryPort';
import type { StrategicRecommendationRepository } from './ports/StrategicRecommendationRepository';
import type {
  TargetApplyDisposition,
  TargetSpecApplyPortRegistry,
} from './ports/TargetSpecApplyPort';
import {
  assertNoTenantSpoof,
  assertTrustedLearningActor,
  ignoreCallerActorClaims,
  resolveTrustedLearningActorKind,
  trustedTenant,
  type TrustedLearningActorContext,
} from './trustedContext';

export interface ApplyApprovedRecommendationInput {
  trusted: TrustedLearningActorContext;
  recommendationId: string;
  applyAttemptId: string;
  expectedVersion?: number;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Caller snapshot claiming APPROVED — IGNORED. */
  forgedRecommendation?: unknown;
  forgedStatus?: string;
  approved?: boolean;
  approvedBy?: string;
  actorType?: string;
  role?: string;
  persist?: boolean;
}

export interface ApplyApprovedRecommendationDeps {
  recommendations: StrategicRecommendationRepository;
  history: LearningHistoryPort;
  targetApplyRegistry: TargetSpecApplyPortRegistry;
}

function mapTargetDispositionToStatus(
  disposition: TargetApplyDisposition
): RecommendationStatus {
  switch (disposition) {
    case 'APPLIED':
      return 'APPLIED';
    case 'FAILED':
      return 'APPLY_FAILED';
    case 'VALIDATION_REJECTED':
    case 'UNSUPPORTED_TARGET':
    case 'STALE_TARGET':
    case 'CONFLICT':
    case 'NOT_YET_SUPPORTED':
      return 'APPROVED_NOT_APPLIED';
    default:
      return 'APPLY_FAILED';
  }
}

export function createApplyApprovedRecommendation(deps: ApplyApprovedRecommendationDeps) {
  return function applyApprovedRecommendation(input: ApplyApprovedRecommendationInput) {
    assertTrustedLearningActor(input.trusted);
    assertNoTenantSpoof(input);
    ignoreCallerActorClaims(input);
    void input.forgedRecommendation;
    void input.forgedStatus;
    void input.approved;
    void input.approvedBy;

    const actorKind = resolveTrustedLearningActorKind(input.trusted, 'apply');
    const tenant = trustedTenant(input.trusted);

    const applyAttemptId = input.applyAttemptId?.trim();
    if (!applyAttemptId) {
      throw new LearningApplicationError(
        'INVALID_RECOMMENDATION',
        'applyAttemptId is required for apply idempotency.'
      );
    }

    const idemKey = learningCommandFingerprint({
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      command: 'ApplyApprovedRecommendation',
      intentKey: `${input.recommendationId}|${applyAttemptId}`,
    });

    const existingKey = deps.recommendations.findByIdempotencyKey(tenant, idemKey);
    if (existingKey) {
      const existing = deps.recommendations.getById(existingKey.recommendationId, tenant);
      if (existing && existing.status === 'APPLIED') {
        return {
          recommendation: existing,
          targetPortCalled: false,
          writeUnitCommitted: false,
          explainability: projectStrategicRecommendationExplainability(existing),
        };
      }
    }

    const current = loadAuthoritativeRecommendation(
      deps.recommendations,
      input.trusted,
      input.recommendationId
    );

    if (input.expectedVersion != null && input.expectedVersion !== current.version) {
      throw new LearningApplicationError(
        'STALE_STATE',
        `Stale recommendation version: expected ${input.expectedVersion}, current ${current.version}`
      );
    }

    unwrapDomain(assertNotSuperseded(current.status));
    unwrapDomain(assertTargetSpecAuthorityPreserved(current));

    if (current.status !== 'APPROVED') {
      return {
        recommendation: current,
        targetPortCalled: false,
        writeUnitCommitted: false,
        deniedReason: 'RECOMMENDATION_NOT_APPROVED',
        explainability: projectStrategicRecommendationExplainability(current),
      };
    }

    unwrapDomain(assertCanApplyRecommendation(current.status));

    const port = deps.targetApplyRegistry.resolve(current.targetAuthority.specId);
    let targetPortCalled = false;
    let toStatus: RecommendationStatus = 'APPROVED_NOT_APPLIED';
    let reasonCodes = ['TARGET_SPEC_AUTHORITY_PRESERVED'];

    if (!port) {
      toStatus = 'APPROVED_NOT_APPLIED';
      reasonCodes = ['UNSUPPORTED_TARGET'];
    } else {
      targetPortCalled = true;
      const result = port.apply({
        tenant,
        recommendation: current,
        applyAttemptId,
      });
      toStatus = mapTargetDispositionToStatus(result.disposition);
      reasonCodes = result.reasonCodes.length > 0 ? result.reasonCodes : [result.disposition];
    }

    unwrapDomain(
      assertRecommendationApplyGate(current.status, toStatus, actorKind)
    );

    const recommendation = unwrapDomain(
      transitionStrategicRecommendationStatus({
        recommendation: current,
        to: toStatus,
        actorKind,
        updatedAt: input.trusted.now,
      })
    );

    const withAppliedBy = {
      ...recommendation,
      appliedBy: toStatus === 'APPLIED' ? input.trusted.actorId : recommendation.appliedBy,
    };

    const history = createLearningHistoryRecord({
      kind: 'RECOMMENDATION_APPLY_ATTEMPT',
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      aggregateKind: 'RECOMMENDATION',
      aggregateId: withAppliedBy.recommendationId,
      aggregateVersion: withAppliedBy.version,
      actorKind,
      reasonCodes,
      materialFingerprint: recommendationMaterialFingerprint(withAppliedBy),
      occurredAt: input.trusted.now,
    });

    let writeUnitCommitted = false;
    if (input.persist !== false) {
      commitGovernedLearningWriteUnit(deps, {
        recommendations: [withAppliedBy],
        history: [history],
        idempotencyKeys: [
          {
            key: idemKey,
            aggregateKind: 'RECOMMENDATION',
            aggregateId: withAppliedBy.recommendationId,
            organizationId: tenant.organizationId,
            clientId: tenant.clientId,
            materialFingerprint: recommendationMaterialFingerprint(withAppliedBy),
            at: input.trusted.now,
          },
        ],
      });
      writeUnitCommitted = true;
    }

    return {
      recommendation: withAppliedBy,
      targetPortCalled,
      writeUnitCommitted,
      explainability: projectStrategicRecommendationExplainability(withAppliedBy),
    };
  };
}

/** Simple in-memory registry for tests and composition wiring. */
export function createTargetSpecApplyPortRegistry(
  ports: import('./ports/TargetSpecApplyPort').TargetSpecApplyPort[]
): TargetSpecApplyPortRegistry {
  const bySpec = new Map(ports.map((p) => [p.specId, p]));
  return {
    resolve(specId: string) {
      return bySpec.get(specId);
    },
  };
}
