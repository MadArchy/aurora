/**
 * SPEC-008 Phase 2 — LearningEvidence repository port (no adapter).
 */

import type { LearningAssessment, LearningEvidence } from '../../../domain/learningEvidenceCore';
import type { LearningTenantScope, LearningWriteUnit } from './LearningTenantScope';

export interface LearningEvidenceRepository {
  getById(
    evidenceId: string,
    tenant: LearningTenantScope
  ): LearningEvidence | undefined;
  getAssessmentByEvidenceId?(
    evidenceId: string,
    tenant: LearningTenantScope
  ): LearningAssessment | undefined;
  list(tenant: LearningTenantScope): LearningEvidence[];
  findByIdempotencyKey(
    tenant: LearningTenantScope,
    key: string
  ): { evidenceId: string; materialFingerprint: string } | undefined;
  commitWriteUnit(unit: LearningWriteUnit): void;
}
