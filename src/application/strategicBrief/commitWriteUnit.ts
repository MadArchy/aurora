import type { StrategicBriefHistoryPort } from './ports/StrategicBriefHistoryPort';
import type { BriefWriteUnit, StrategicBriefRepository } from './ports/StrategicBriefRepository';
import { mapPortFailure } from './mapDomainError';

export function commitGovernedWriteUnit(
  briefs: StrategicBriefRepository,
  history: StrategicBriefHistoryPort,
  unit: BriefWriteUnit
): void {
  try {
    briefs.commitWriteUnit(unit);
    for (const entry of unit.history) {
      history.append(entry);
    }
    if (unit.overrideAudit && history.appendOverride) {
      history.appendOverride(unit.overrideAudit);
    }
  } catch (err) {
    mapPortFailure(err, 'Failed to persist Strategic Brief write unit.');
  }
}
