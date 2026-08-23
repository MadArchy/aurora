import {
  createOverrideSignalThesis,
  createScoreAndRouteSignal,
} from '../../application/strategicSignalRouting';
import { dbService } from '../../services/db';
import { createDbStrategicSignalRoutingPorts } from '../../infrastructure/strategicSignalRouting/DbStrategicSignalRoutingAdapter';

/** Wire Application use cases to transitional dbService adapter. */
export function createStrategicSignalRoutingUseCases(db: typeof dbService = dbService) {
  const ports = createDbStrategicSignalRoutingPorts(db);
  return {
    scoreAndRouteSignal: createScoreAndRouteSignal(ports),
    overrideSignalThesis: createOverrideSignalThesis(ports),
  };
}
