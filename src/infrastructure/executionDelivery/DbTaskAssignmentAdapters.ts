/**
 * TEMPORARY LEGACY ADAPTER — CR-1 #27 AssignClientTask.
 */

import type {
  ClientExecutionReadPort,
  TaskAssignmentPersistencePort,
} from '../../application/executionDelivery';
import { dbService } from '../../services/db';

export function createDbClientExecutionReadPort(): ClientExecutionReadPort {
  return {
    getById(clientId) {
      return dbService.getClientById(clientId);
    },
  };
}

export function createDbTaskAssignmentPersistencePort(): TaskAssignmentPersistencePort {
  return {
    createTask(task) {
      return dbService.addTask(task);
    },
  };
}
