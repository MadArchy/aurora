import type { Client, ClientProfile } from '../../../types';

export interface MasterProfileRepository {
  getProfile(clientId: string): ClientProfile | null;
  saveProfile(profile: ClientProfile): void;
  getClient(clientId: string): Client | undefined;
  updateClient(
    clientId: string,
    updates: Partial<
      Pick<
        Client,
        | 'displayName'
        | 'firstName'
        | 'lastName'
        | 'profession'
        | 'company'
        | 'targetMarket'
        | 'onboardingStatus'
        | 'status'
        | 'profileCompleteness'
        | 'updatedBy'
      >
    >
  ): Client | null;
}
