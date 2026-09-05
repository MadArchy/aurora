/**
 * TEMPORARY LEGACY ADAPTERS — CR-1 Execution Delivery #16-R / #16-O.
 */

import type {
  CurationRemovalPersistencePort,
  CurationReopenPersistencePort,
} from '../../application/executionDelivery';
import { dbService } from '../../services/db';

export function createDbCurationRemovalPersistencePort(): CurationRemovalPersistencePort {
  return {
    removeById(curationEntryId) {
      dbService.removeCuration(curationEntryId);
    },
  };
}

export function createDbCurationReopenPersistencePort(): CurationReopenPersistencePort {
  return {
    reopenById(curationEntryId) {
      dbService.reopenCuration(curationEntryId);
    },
  };
}
