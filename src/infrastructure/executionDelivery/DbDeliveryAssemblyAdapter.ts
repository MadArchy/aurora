/**
 * TEMPORARY LEGACY ADAPTER — CR-1 Execution Delivery strangler (#17).
 */

import type { DeliveryAssemblyRepositoryPort } from '../../application/executionDelivery';
import { dbService } from '../../services/db';

export function createDbDeliveryAssemblyRepositoryPort(): DeliveryAssemblyRepositoryPort {
  return {
    getClientById(clientId) {
      return dbService.getClientById(clientId);
    },
    getDraftByClientId(clientId) {
      return dbService.getDraftDelivery(clientId);
    },
    getPackageById(packageId) {
      return dbService.getDeliveryById(packageId);
    },
    ensureDraft(clientId, createdBy) {
      return dbService.ensureDraftDelivery(clientId, createdBy);
    },
    addDeliveryItem(packageId, item) {
      return dbService.addDeliveryItem(packageId, item);
    },
    removeDeliveryItem(packageId, itemId) {
      dbService.removeDeliveryItem(packageId, itemId);
    },
    updateDraftMetadata(packageId, updates) {
      dbService.updateDelivery(packageId, updates);
    },
    attachCurationToDelivery(curationId, packageId) {
      dbService.attachCurationToDelivery(curationId, packageId);
    },
    discardDraftDelivery(packageId) {
      return dbService.discardDraftDelivery(packageId);
    },
  };
}
