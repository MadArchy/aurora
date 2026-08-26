/**
 * SPEC-007 Phase 2 — Opportunity history port (AUDIT_ONLY).
 * History is never current authority.
 */

import type { OpportunityHistoryEventIntent } from '../../../domain/opportunityMaterialityCore';

export type OpportunityHistoryRecord = OpportunityHistoryEventIntent & {
  id?: string;
};

export interface OpportunityHistoryPort {
  append(entry: OpportunityHistoryRecord): void;
}
