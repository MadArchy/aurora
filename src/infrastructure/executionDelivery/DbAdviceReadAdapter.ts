/**
 * TEMPORARY LEGACY ADAPTER — CR-1 Execution Delivery strangler (#21a advisor).
 */

import type { AdviceReadPort } from '../../application/executionDelivery';
import { dbService } from '../../services/db';

export function createDbAdviceReadPort(): AdviceReadPort {
  return {
    getLatestAdvice(clientId) {
      return dbService.getLatestAdvice(clientId);
    },
    findAdviceAction(clientId, adviceActionId) {
      const advice = dbService.getLatestAdvice(clientId);
      if (!advice) return undefined;
      const action = advice.actions.find((a) => a.id === adviceActionId);
      if (!action) return undefined;
      return { advice, action };
    },
  };
}
