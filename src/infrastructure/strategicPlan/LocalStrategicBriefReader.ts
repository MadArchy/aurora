import type { StrategicBriefReader } from '../../application/strategicPlan';
import type { PlanTenantScope } from '../../application/strategicPlan/ports/StrategicPlanRepository';
import type { StrategicBrief } from '../../domain/strategicBriefCore';

/**
 * Read-only SPEC-003 Brief source for SPEC-004 Application.
 * Does not mutate Brief. Adapter may wrap LocalStrategicBriefStore or any
 * frozen SPEC-003 projection source.
 */
export interface StrategicBriefSource {
  getById(briefId: string, tenant: PlanTenantScope): StrategicBrief | undefined;
}

/**
 * READ ONLY StrategicBriefReader adapter.
 * SPEC-003 remains Brief authority; this is translation/read only.
 */
export class LocalStrategicBriefReader implements StrategicBriefReader {
  constructor(private readonly source: StrategicBriefSource) {}

  getById(briefId: string, tenant: PlanTenantScope): StrategicBrief | undefined {
    const brief = this.source.getById(briefId, tenant);
    if (!brief) return undefined;
    if (
      brief.organizationId !== tenant.organizationId ||
      brief.clientId !== tenant.clientId
    ) {
      return undefined;
    }
    // Fail closed on incomplete authoritative fields (no permissive defaults).
    if (
      !brief.id?.trim() ||
      !brief.thesisId?.trim() ||
      !brief.organizationId?.trim() ||
      !brief.clientId?.trim() ||
      !Number.isInteger(brief.version) ||
      brief.version < 1 ||
      !brief.status ||
      !brief.decision?.authorizedAction
    ) {
      return undefined;
    }
    return brief;
  }
}
