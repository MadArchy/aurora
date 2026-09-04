import type { CurationEntry } from '../../../types';

export type CurationEntryCreateInput = Omit<
  CurationEntry,
  'id' | 'createdAt' | 'destination' | 'managerRationale' | 'deliveryPackageId'
> &
  Partial<Pick<CurationEntry, 'destination' | 'managerRationale' | 'aiAngle'>>;

export interface CurationRepositoryPort {
  isSignalInCuration(clientId: string, signalId: string): boolean;
  addToCuration(entry: CurationEntryCreateInput): CurationEntry;
}
