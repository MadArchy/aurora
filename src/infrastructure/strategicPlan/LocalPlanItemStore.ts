import type { PlanItemStore } from '../../application/strategicPlan';
import type { PlanTenantScope } from '../../application/strategicPlan/ports/StrategicPlanRepository';
import type { PlanItem } from '../../domain/planItemCore';
import type { LocalStrategicPlanStore } from './LocalStrategicPlanStore';

/**
 * PlanItem companion store — items are aggregate-owned on StrategicPlan.
 * This adapter exposes listByPlan without giving PlanItem independent authority.
 */
export class LocalPlanItemStore implements PlanItemStore {
  constructor(private readonly store: LocalStrategicPlanStore) {}

  listByPlan(planId: string, tenant: PlanTenantScope): PlanItem[] {
    return this.store.listItemsByPlan(planId, tenant);
  }
}
