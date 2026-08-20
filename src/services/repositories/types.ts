import type { Client, Signal, Task, DeliveryPackage, CurationEntry } from '../../types';

/** Contrato de persistencia para migrar de localStorage a Firestore sin tocar la UI. */
export interface PosturaRepository {
  getClientById(clientId: string): Client | null;
  getSignalsByClient(clientId: string): Signal[];
  addSignal(
    signal: Omit<Signal, 'id' | 'detectedAt' | 'fingerprint' | 'aiStatus' | 'managerDecision' | 'createdAt' | 'updatedAt' | 'updatedBy'> &
      Partial<Pick<Signal, 'aiStatus' | 'managerDecision' | 'sourceQuality'>>
  ): Signal;
  getTasksByClient(clientId: string): Task[];
  getCurationByClient(clientId: string): CurationEntry[];
  getDeliveriesByClient(clientId: string): DeliveryPackage[];
}

export type RepositoryBackend = 'local' | 'firestore';
