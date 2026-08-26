import type { PlanItem } from '../../../domain/planItemCore';
import type { PlanTenantScope } from './StrategicPlanRepository';

/**
 * Companion item store port (Phase 3 may split persistence).
 * Phase 2 Application primarily uses items on the StrategicPlan aggregate;
 * this port remains available for list/read contracts.
 */
export interface PlanItemStore {
  listByPlan(planId: string, tenant: PlanTenantScope): PlanItem[];
}
