import type { StrategicBriefHistoryRecord } from '../../../domain/strategicBriefCore';
import type { StrategicBriefOverrideRecord } from '../../../domain/strategicBriefCore';

/** Append-only history contract. Physical store is Phase 3. */
export interface StrategicBriefHistoryPort {
  append(entry: StrategicBriefHistoryRecord): void;
  appendOverride?(entry: StrategicBriefOverrideRecord): void;
}
