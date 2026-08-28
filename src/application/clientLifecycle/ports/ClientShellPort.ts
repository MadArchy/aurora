import type { Client, ClientOperationalStatus } from '../../../types';

/**
 * Capability port: client shell persistence for Client Lifecycle.
 * Not a generic dbService mirror.
 */
export interface ClientCreateFields {
  organizationId: string;
  primaryManagerId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  primaryEmail: string;
  profession?: string;
  company?: string;
  targetMarket?: string;
  onboardingStatus: 'NOT_STARTED';
  profileCompleteness: number;
  status: 'INVITED';
  avatarUrl: string;
  createdBy: string;
  updatedBy: string;
}

export interface ClientShellPort {
  getById(clientId: string): Client | undefined;
  create(fields: ClientCreateFields): Client;
  update(
    clientId: string,
    updates: Partial<
      Pick<
        Client,
        | 'userId'
        | 'status'
        | 'onboardingStatus'
        | 'updatedBy'
        | 'createdBy'
        | 'archivedAt'
        | 'archivedBy'
      >
    > & { status?: ClientOperationalStatus }
  ): Client | null;
}
