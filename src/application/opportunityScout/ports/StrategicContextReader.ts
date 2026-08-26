/**
 * SPEC-007 Phase 2 — Optional Strategic context reader (SPEC-001/002 READ_ONLY).
 * Does not duplicate Strategic Score formula. Does not write.
 */

import type { OpportunityTenantScope } from './OpportunityCandidateRepository';

export interface StrategicScoreContextSnapshot {
  scoringVersion: string;
  totalScore?: number;
  priorityBand?: string;
}

export interface StrategicContextReader {
  getStrategicScoreRef?(
    tenant: OpportunityTenantScope,
    thesisId: string,
    signalId?: string
  ): StrategicScoreContextSnapshot | undefined;
}
