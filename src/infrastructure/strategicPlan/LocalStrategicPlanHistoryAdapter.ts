import type {
  StrategicPlanHistoryPort,
  StrategicPlanHistoryRecord,
} from '../../application/strategicPlan';
import type { LocalStrategicPlanStore } from './LocalStrategicPlanStore';

/**
 * Append-only history adapter.
 * Production API: append only. No update/replace/delete.
 * History is never current Plan authority.
 */
export class LocalStrategicPlanHistoryAdapter implements StrategicPlanHistoryPort {
  constructor(private readonly store: LocalStrategicPlanStore) {}

  append(entry: StrategicPlanHistoryRecord): void {
    this.store.appendHistory(entry);
  }
}
