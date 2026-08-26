/**
 * SPEC-008 Phase 3 — Append-only Learning history adapter (AUDIT_ONLY).
 */

import type {
  LearningHistoryPort,
  LearningHistoryRecord,
} from '../../application/learningLoop/ports/LearningHistoryPort';
import type { LocalLearningLoopStore } from './LocalLearningLoopStore';

export class LocalLearningHistoryAdapter implements LearningHistoryPort {
  constructor(private readonly store: LocalLearningLoopStore) {}

  append(entry: LearningHistoryRecord): void {
    this.store.appendHistory(entry);
  }

  /** Inspection only — not current authority. */
  listForInspection(): LearningHistoryRecord[] {
    return this.store.listHistory();
  }
}
