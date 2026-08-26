import type { StrategicPlan } from '../../../domain/strategicPlanCore';
import type { StrategicPlanHistoryRecord } from './StrategicPlanHistoryPort';

export interface PlanTenantScope {
  organizationId: string;
  clientId: string;
}

/**
 * Required write set for a governed Plan mutation.
 * Phase 3 must persist this unit atomically. Phase 2 does not implement storage.
 */
export interface PlanWriteUnit {
  plans: StrategicPlan[];
  history: StrategicPlanHistoryRecord[];
  /** Application idempotency records — Phase 3 persists; test fakes honor them. */
  idempotencyKeys?: Array<{
    key: string;
    planId: string;
    organizationId: string;
    clientId: string;
    at: string;
  }>;
}

export interface StrategicPlanRepository {
  getById(planId: string, tenant: PlanTenantScope): StrategicPlan | undefined;
  /**
   * Current non-SUPERSEDED plan for a Brief revision within tenant, if any.
   */
  findCurrentByBriefRevision(
    tenant: PlanTenantScope,
    strategicBriefId: string,
    strategicBriefVersion: number
  ): StrategicPlan | undefined;
  findByIdempotencyKey(
    tenant: PlanTenantScope,
    key: string
  ): { planId: string } | undefined;
  commitWriteUnit(unit: PlanWriteUnit): void;
}
