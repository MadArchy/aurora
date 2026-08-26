import type { StrategicPlanHistoryPort } from './ports/StrategicPlanHistoryPort';
import type {
  PlanWriteUnit,
  StrategicPlanRepository,
} from './ports/StrategicPlanRepository';
import { mapPortFailure } from './mapDomainError';

export function commitGovernedPlanWriteUnit(
  plans: StrategicPlanRepository,
  history: StrategicPlanHistoryPort,
  unit: PlanWriteUnit
): void {
  try {
    plans.commitWriteUnit(unit);
    for (const entry of unit.history) {
      history.append(entry);
    }
  } catch (err) {
    mapPortFailure(err, 'Failed to persist Strategic Plan write unit.');
  }
}
