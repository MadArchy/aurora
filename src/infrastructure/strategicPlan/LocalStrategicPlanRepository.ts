import type {
  PlanTenantScope,
  PlanWriteUnit,
  StrategicPlanRepository,
} from '../../application/strategicPlan';
import type { StrategicPlan } from '../../domain/strategicPlanCore';
import type { LocalStrategicPlanStore } from './LocalStrategicPlanStore';

/** Current Plan projection adapter. History is physically separate. */
export class LocalStrategicPlanRepository implements StrategicPlanRepository {
  constructor(private readonly store: LocalStrategicPlanStore) {}

  getById(planId: string, tenant: PlanTenantScope): StrategicPlan | undefined {
    return this.store.getById(planId, tenant);
  }

  findCurrentByBriefRevision(
    tenant: PlanTenantScope,
    strategicBriefId: string,
    strategicBriefVersion: number
  ): StrategicPlan | undefined {
    return this.store.findCurrentByBriefRevision(
      tenant,
      strategicBriefId,
      strategicBriefVersion
    );
  }

  findByIdempotencyKey(
    tenant: PlanTenantScope,
    key: string
  ): { planId: string } | undefined {
    return this.store.findByIdempotencyKey(tenant, key);
  }

  commitWriteUnit(unit: PlanWriteUnit): void {
    this.store.commitWriteUnit(unit);
  }
}
