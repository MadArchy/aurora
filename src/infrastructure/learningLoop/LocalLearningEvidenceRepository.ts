/**
 * SPEC-008 Phase 3 — LearningEvidenceRepository adapter (LOCAL_AUTHORITATIVE).
 */

import type { LearningEvidenceRepository } from '../../application/learningLoop/ports/LearningEvidenceRepository';
import type {
  LearningTenantScope,
  LearningWriteUnit,
} from '../../application/learningLoop/ports/LearningTenantScope';
import type { LearningEvidence } from '../../domain/learningEvidenceCore';
import type { LocalLearningLoopStore } from './LocalLearningLoopStore';

export class LocalLearningEvidenceRepository implements LearningEvidenceRepository {
  constructor(private readonly store: LocalLearningLoopStore) {}

  getById(
    evidenceId: string,
    tenant: LearningTenantScope
  ): LearningEvidence | undefined {
    return this.store.getEvidence(evidenceId, tenant);
  }

  list(tenant: LearningTenantScope): LearningEvidence[] {
    return this.store.listEvidence(tenant);
  }

  findByIdempotencyKey(
    tenant: LearningTenantScope,
    key: string
  ): { evidenceId: string; materialFingerprint: string } | undefined {
    const hit = this.store.findByIdempotencyKey(tenant, key);
    if (!hit || hit.aggregateKind !== 'EVIDENCE') return undefined;
    return {
      evidenceId: hit.evidenceId,
      materialFingerprint: hit.materialFingerprint,
    };
  }

  commitWriteUnit(unit: LearningWriteUnit): void {
    this.store.commitWriteUnit(unit);
  }
}
