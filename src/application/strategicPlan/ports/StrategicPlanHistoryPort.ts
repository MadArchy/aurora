import type { PlanMaterialHistoryEvent } from '../../../domain/planMaterialityCore';

export interface StrategicPlanHistoryRecord {
  id: string;
  organizationId: string;
  clientId: string;
  planId: string;
  planVersion: number;
  event: PlanMaterialHistoryEvent;
  actorId: string;
  at: string;
  itemId?: string;
  note?: string;
}

/**
 * Append-only material history. History is NEVER current Plan authority.
 */
export interface StrategicPlanHistoryPort {
  append(record: StrategicPlanHistoryRecord): void;
}
