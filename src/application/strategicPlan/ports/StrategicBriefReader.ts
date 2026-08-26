import type { StrategicBrief } from '../../../domain/strategicBriefCore';
import type { PlanTenantScope } from './StrategicPlanRepository';

/**
 * Read-only SPEC-003 Brief access for SPEC-004 Application.
 * Must not mutate Brief. Adapter implementation is Phase 3.
 */
export interface StrategicBriefReader {
  getById(briefId: string, tenant: PlanTenantScope): StrategicBrief | undefined;
}
