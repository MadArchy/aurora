/**
 * SPEC-008 Phase 2 — TargetSpecApplyPort (boundary contract only).
 * SPEC-008 must NOT write target SPEC storage directly.
 */

import type { StrategicRecommendation } from '../../../domain/strategicRecommendationCore';
import type { LearningTenantScope } from './LearningTenantScope';

export type TargetApplyDisposition =
  | 'APPLIED'
  | 'VALIDATION_REJECTED'
  | 'UNSUPPORTED_TARGET'
  | 'STALE_TARGET'
  | 'CONFLICT'
  | 'FAILED'
  | 'NOT_YET_SUPPORTED';

export interface TargetSpecApplyRequest {
  tenant: LearningTenantScope;
  recommendation: StrategicRecommendation;
  applyAttemptId: string;
}

export interface TargetSpecApplyResult {
  disposition: TargetApplyDisposition;
  appliedRevisionId?: string;
  reasonCodes: string[];
}

/** Per-target apply boundary — implemented by target SPEC adapter in Phase 3+. */
export interface TargetSpecApplyPort {
  readonly specId: string;
  apply(request: TargetSpecApplyRequest): TargetSpecApplyResult;
}

/** Registry resolves target owner port by targetAuthority.specId. */
export interface TargetSpecApplyPortRegistry {
  resolve(specId: string): TargetSpecApplyPort | undefined;
}
