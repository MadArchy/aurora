import type { BriefScopeQuery, BriefWriteUnit, StrategicBriefRepository } from '../../application/strategicBrief';
import type { StrategicBrief } from '../../domain/strategicBriefCore';
import type { LocalStrategicBriefStore } from './LocalStrategicBriefStore';

/** Current-projection adapter. History is physically separate. */
export class LocalStrategicBriefRepository implements StrategicBriefRepository {
  constructor(private readonly store: LocalStrategicBriefStore) {}

  getById(briefId: string, tenant: { organizationId: string; clientId: string }): StrategicBrief | undefined {
    return this.store.getById(briefId, tenant);
  }

  findCurrentByScope(scope: BriefScopeQuery): StrategicBrief | undefined {
    return this.store.findCurrentByScope(scope);
  }

  commitWriteUnit(unit: BriefWriteUnit): void {
    this.store.commitWriteUnit(unit);
  }
}
