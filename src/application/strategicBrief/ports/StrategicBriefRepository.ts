import type { StrategicBrief } from '../../../domain/strategicBriefCore';
import type { StrategicBriefHistoryRecord } from '../../../domain/strategicBriefCore';
import type { StrategicBriefOverrideRecord } from '../../../domain/strategicBriefCore';

export interface BriefScopeQuery {
  organizationId: string;
  clientId: string;
  thesisId: string;
  signalIds: readonly string[];
}

/**
 * Required write set for a governed Brief mutation.
 * Phase 3 must persist this unit atomically. Phase 2 does not implement storage.
 */
export interface BriefWriteUnit {
  briefs: StrategicBrief[];
  history: StrategicBriefHistoryRecord[];
  overrideAudit?: StrategicBriefOverrideRecord;
}

export interface StrategicBriefRepository {
  getById(briefId: string, tenant: { organizationId: string; clientId: string }): StrategicBrief | undefined;
  findCurrentByScope(scope: BriefScopeQuery): StrategicBrief | undefined;
  commitWriteUnit(unit: BriefWriteUnit): void;
}
