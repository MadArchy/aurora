import type { StrategicBriefHistoryPort } from '../../application/strategicBrief';
import type { StrategicBriefHistoryRecord, StrategicBriefOverrideRecord } from '../../domain/strategicBriefCore';
import type { LocalStrategicBriefStore } from './LocalStrategicBriefStore';

/**
 * Append-only history adapter.
 * Production API: append / appendOverride only. No update/replace/delete.
 */
export class LocalStrategicBriefHistoryAdapter implements StrategicBriefHistoryPort {
  constructor(private readonly store: LocalStrategicBriefStore) {}

  append(entry: StrategicBriefHistoryRecord): void {
    this.store.appendHistory(entry);
  }

  appendOverride(entry: StrategicBriefOverrideRecord): void {
    this.store.appendOverride(entry);
  }
}
