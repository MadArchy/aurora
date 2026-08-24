import { StrategicBriefError } from '../../application/strategicBrief/errors';

const GENERIC_PERSISTENCE = 'Strategic Brief persistence failed.';

export function persistenceError(message = GENERIC_PERSISTENCE): StrategicBriefError {
  return new StrategicBriefError('PERSISTENCE_ERROR', message);
}

export function rethrowGoverned(err: unknown, fallback = GENERIC_PERSISTENCE): never {
  if (err instanceof StrategicBriefError) throw err;
  throw persistenceError(fallback);
}
