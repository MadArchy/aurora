/**
 * TEMPORARY LEGACY ADAPTER — CR-1 Signal Intake strangler.
 * Persistence only. Dedup scope is enforced in dbService.addSignal (client-scoped per F6 §186).
 */

import type { SignalIntakePort, SourceRegistryPort } from '../../application/signalIntake';
import { dbService } from '../../services/db';

export function createDbSourceRegistryPort(): SourceRegistryPort {
  return {
    add(source) {
      return dbService.addSource(source);
    },
    listByClient(clientId) {
      return dbService.getSourcesByClient(clientId);
    },
    getById(sourceId) {
      return dbService.getSources().find((s) => s.id === sourceId);
    },
    listPollableByClient(clientId) {
      return dbService
        .getSourcesByClient(clientId)
        .filter((s) => s.url && s.status !== 'ARCHIVED' && s.status !== 'PAUSED');
    },
    recordSourceRun(sourceId, outcome) {
      dbService.recordSourceRun(sourceId, outcome);
    },
  };
}

export function createDbSignalIntakePort(): SignalIntakePort {
  return {
    add(signal) {
      return dbService.addSignal(signal);
    },
  };
}
