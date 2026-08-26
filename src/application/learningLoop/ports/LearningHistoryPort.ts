/**
 * SPEC-008 Phase 2 — Learning history port (AUDIT_ONLY).
 * History is never current authority.
 */

import type { LearningHistoryRecord } from '../../../domain/learningMaterialityCore';

export type { LearningHistoryRecord };

export interface LearningHistoryPort {
  append(entry: LearningHistoryRecord): void;
}
