/**
 * SPEC-008 Phase 2 — LearningObservation repository port (no adapter).
 * Tenant-safe identity only — no global id-only getById.
 */

import type { LearningObservation } from '../../../domain/learningObservationCore';
import type { LearningTenantScope, LearningWriteUnit } from './LearningTenantScope';

export interface LearningObservationRepository {
  getById(
    observationId: string,
    tenant: LearningTenantScope
  ): LearningObservation | undefined;
  list(tenant: LearningTenantScope): LearningObservation[];
  findByIdempotencyKey(
    tenant: LearningTenantScope,
    key: string
  ): { observationId: string; materialFingerprint: string } | undefined;
  commitWriteUnit(unit: LearningWriteUnit): void;
}
