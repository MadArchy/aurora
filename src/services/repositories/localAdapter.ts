import { dbService } from '../db';
import type { PosturaRepository } from './types';

/** Adaptador local: delega al monolito mientras Firestore no es autoritativo. */
export const localStorageRepository: PosturaRepository = {
  getClientById: (clientId) => dbService.getClientById(clientId) || null,
  getSignalsByClient: (clientId) => dbService.getSignalsByClient(clientId),
  addSignal: (signal) => dbService.addSignal(signal).signal,
  getTasksByClient: (clientId) => dbService.getTasksByClient(clientId),
  getCurationByClient: (clientId) => dbService.getCurationByClient(clientId),
  getDeliveriesByClient: (clientId) => dbService.getDeliveriesByClient(clientId),
};
