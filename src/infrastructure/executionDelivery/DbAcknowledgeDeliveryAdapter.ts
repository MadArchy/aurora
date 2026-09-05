/**
 * TEMPORARY LEGACY ADAPTER — CR-1 Execution Delivery #19.
 */

import type { DeliveryAcknowledgementPersistencePort } from '../../application/executionDelivery';
import { dbService } from '../../services/db';

export function createDbDeliveryAcknowledgementPersistencePort(): DeliveryAcknowledgementPersistencePort {
  return {
    markAcknowledged(packageId, input) {
      return dbService.acknowledgeDelivery(packageId, input.clientAckNote, input.acknowledgedAt);
    },
  };
}
