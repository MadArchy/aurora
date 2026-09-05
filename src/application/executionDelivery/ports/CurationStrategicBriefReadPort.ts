import type { StrategicBrief } from '../../../domain/strategicBriefCore';

/** Authoritative Strategic Brief reload for #15 thesis resolution — read only. */
export interface CurationStrategicBriefReadPort {
  getById(briefId: string, clientId: string): StrategicBrief | undefined;
}
