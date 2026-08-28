/**
 * TEMPORARY LEGACY ADAPTER — CR-1 Master Profile strangler.
 * Wraps dbService persistence only. Application owns onboarding decisions.
 */

import type { MasterProfileRepository } from '../../application/masterProfile';
import { dbService } from '../../services/db';

export function createDbMasterProfileRepository(): MasterProfileRepository {
  return {
    getProfile(clientId) {
      return dbService.getMasterProfile(clientId);
    },
    saveProfile(profile) {
      dbService.saveMasterProfile(profile);
    },
    getClient(clientId) {
      return dbService.getClientById(clientId);
    },
    updateClient(clientId, updates) {
      return dbService.updateClient(clientId, updates);
    },
  };
}
