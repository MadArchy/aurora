/**
 * TEMPORARY LEGACY ADAPTER — CR-1 Execution Delivery strangler (#21a).
 */

import type {
  CurationRepositoryPort,
  SignalReadPort,
} from '../../application/executionDelivery';
import { dbService } from '../../services/db';

export function createDbSignalReadPort(): SignalReadPort {
  return {
    getById(signalId) {
      return dbService.getSignalById(signalId);
    },
  };
}

export function createDbCurationRepositoryPort(): CurationRepositoryPort {
  return {
    isSignalInCuration(clientId, signalId) {
      return dbService.isSignalInCuration(clientId, signalId);
    },
    addToCuration(entry) {
      return dbService.addToCuration(entry);
    },
  };
}
