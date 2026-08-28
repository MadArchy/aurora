/**
 * TEMPORARY LEGACY ADAPTER — CR-1 Thesis Lifecycle strangler.
 * Wraps dbService persistence only. Domain decisions live in Application use cases.
 */

import type { ThesisRepository } from '../../application/thesisLifecycle';
import { dbService } from '../../services/db';

export function createDbThesisRepository(): ThesisRepository {
  return {
    getById(clientId, thesisId) {
      return dbService.getThesisById(clientId, thesisId);
    },
    listByClient(clientId) {
      return dbService.getThesesByClient(clientId);
    },
    save(thesis) {
      dbService.saveThesis(thesis);
    },
  };
}
