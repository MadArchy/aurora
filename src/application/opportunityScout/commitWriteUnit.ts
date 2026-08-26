/**
 * SPEC-007 Phase 2 — Commit write unit through ports (no concrete storage).
 */

import type {
  OpportunityCandidateRepository,
  OpportunityWriteUnit,
} from './ports/OpportunityCandidateRepository';
import type { OpportunityHistoryPort } from './ports/OpportunityHistoryPort';
import type { OpportunityRepository } from './ports/OpportunityRepository';
import { mapPortFailure } from './mapDomainError';

export type OpportunityWritePorts = {
  candidates?: OpportunityCandidateRepository;
  opportunities?: OpportunityRepository;
  history: OpportunityHistoryPort;
};

/**
 * Phase 2 contract: coherent write intent for aggregate + history + idempotency.
 * Phase 3 persists atomically. Prefer a single owning repository when both present.
 */
export function commitGovernedOpportunityWriteUnit(
  deps: OpportunityWritePorts,
  unit: OpportunityWriteUnit
): void {
  try {
    const hasCandidates = (unit.candidates?.length ?? 0) > 0;
    const hasOpportunities = (unit.opportunities?.length ?? 0) > 0;

    if (hasCandidates && hasOpportunities) {
      if (deps.candidates && deps.opportunities) {
        deps.candidates.commitWriteUnit(unit);
        // Opportunity rows may also be on the opportunity repo if stores are split.
        deps.opportunities.commitWriteUnit({
          opportunities: unit.opportunities,
          history: [],
          idempotencyKeys: unit.idempotencyKeys?.filter(
            (k) => k.aggregateKind === 'OPPORTUNITY'
          ),
        });
      } else if (deps.opportunities) {
        deps.opportunities.commitWriteUnit(unit);
      } else if (deps.candidates) {
        deps.candidates.commitWriteUnit(unit);
      } else {
        throw new Error('No repository available for write unit');
      }
    } else if (hasCandidates) {
      if (!deps.candidates) throw new Error('Candidate repository required');
      deps.candidates.commitWriteUnit(unit);
    } else if (hasOpportunities) {
      if (!deps.opportunities) throw new Error('Opportunity repository required');
      deps.opportunities.commitWriteUnit(unit);
    } else if (unit.idempotencyKeys?.length) {
      const repo = deps.candidates ?? deps.opportunities;
      if (!repo) throw new Error('Repository required for idempotency record');
      repo.commitWriteUnit(unit);
    }

    for (const entry of unit.history) {
      deps.history.append(entry);
    }
  } catch (err) {
    mapPortFailure(err, 'Failed to persist Opportunity write unit.');
  }
}
