/**
 * SPEC-007 Phase 3 — Persistence error helpers.
 */

import { OpportunityApplicationError } from '../../application/opportunityScout/errors';

const GENERIC = 'Opportunity Scout persistence failed.';

export function persistenceError(message = GENERIC): OpportunityApplicationError {
  return new OpportunityApplicationError('PERSISTENCE_ERROR', message);
}

export function rethrowGoverned(err: unknown, fallback = GENERIC): never {
  if (err instanceof OpportunityApplicationError) throw err;
  throw persistenceError(fallback);
}
