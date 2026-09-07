import type { Client } from '../../../types';

/** Authoritative Client reload for CR-1 #27 — read only. */
export interface ClientExecutionReadPort {
  getById(clientId: string): Client | undefined;
}
