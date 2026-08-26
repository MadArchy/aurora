import { StrategicPlanError } from '../../application/strategicPlan/errors';

const GENERIC_PERSISTENCE = 'Strategic Plan persistence failed.';

export function persistenceError(message = GENERIC_PERSISTENCE): StrategicPlanError {
  return new StrategicPlanError('PERSISTENCE_ERROR', message);
}

export function rethrowGoverned(err: unknown, fallback = GENERIC_PERSISTENCE): never {
  if (err instanceof StrategicPlanError) throw err;
  throw persistenceError(fallback);
}
