/**
 * SPEC-008 Phase 3 — Persistence error helpers.
 */

import { LearningApplicationError } from '../../application/learningLoop/errors';

const GENERIC = 'Learning Loop persistence failed.';

export function persistenceError(message = GENERIC): LearningApplicationError {
  return new LearningApplicationError('PERSISTENCE_ERROR', message);
}

export function rethrowGoverned(err: unknown, fallback = GENERIC): never {
  if (err instanceof LearningApplicationError) throw err;
  throw persistenceError(fallback);
}
