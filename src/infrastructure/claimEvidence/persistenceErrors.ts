import { ClaimEvidenceError } from '../../application/claimEvidence/errors';

const GENERIC_PERSISTENCE = 'Claim Evidence persistence failed.';

export function persistenceError(message = GENERIC_PERSISTENCE): ClaimEvidenceError {
  return new ClaimEvidenceError('PERSISTENCE_ERROR', message);
}

export function rethrowGoverned(err: unknown, fallback = GENERIC_PERSISTENCE): never {
  if (err instanceof ClaimEvidenceError) throw err;
  throw persistenceError(fallback);
}
