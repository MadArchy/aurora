/**
 * SPEC-008 Phase 3 — LearningObservationRepository adapter (LOCAL_AUTHORITATIVE).
 */

import type { LearningObservationRepository } from '../../application/learningLoop/ports/LearningObservationRepository';
import type {
  LearningTenantScope,
  LearningWriteUnit,
} from '../../application/learningLoop/ports/LearningTenantScope';
import type { LearningObservation } from '../../domain/learningObservationCore';
import type { LocalLearningLoopStore } from './LocalLearningLoopStore';

export class LocalLearningObservationRepository implements LearningObservationRepository {
  constructor(private readonly store: LocalLearningLoopStore) {}

  getById(
    observationId: string,
    tenant: LearningTenantScope
  ): LearningObservation | undefined {
    return this.store.getObservation(observationId, tenant);
  }

  list(tenant: LearningTenantScope): LearningObservation[] {
    return this.store.listObservations(tenant);
  }

  findByIdempotencyKey(
    tenant: LearningTenantScope,
    key: string
  ): { observationId: string; materialFingerprint: string } | undefined {
    const hit = this.store.findByIdempotencyKey(tenant, key);
    if (!hit || hit.aggregateKind !== 'OBSERVATION') return undefined;
    return {
      observationId: hit.observationId,
      materialFingerprint: hit.materialFingerprint,
    };
  }

  commitWriteUnit(unit: LearningWriteUnit): void {
    this.store.commitWriteUnit(unit);
  }
}
