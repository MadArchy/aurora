/**
 * SPEC-007 Phase 3 — Append-only Opportunity history adapter (AUDIT_ONLY).
 * History never becomes current Opportunity/Candidate authority.
 */

import type {
  OpportunityHistoryPort,
  OpportunityHistoryRecord,
} from '../../application/opportunityScout/ports/OpportunityHistoryPort';
import type { LocalOpportunityScoutStore } from './LocalOpportunityScoutStore';

export class LocalOpportunityHistoryAdapter implements OpportunityHistoryPort {
  constructor(private readonly store: LocalOpportunityScoutStore) {}

  append(entry: OpportunityHistoryRecord): void {
    this.store.appendHistory(entry);
  }

  /** Inspection only — not current authority. */
  listForInspection(): OpportunityHistoryRecord[] {
    return this.store.listHistory();
  }
}
