import type { CurationDestination, CurationEntry } from '../../../types';

export type CurationEntryCreateInput = Omit<
  CurationEntry,
  'id' | 'createdAt' | 'destination' | 'managerRationale' | 'deliveryPackageId'
> &
  Partial<Pick<CurationEntry, 'destination' | 'managerRationale' | 'aiAngle'>>;

export interface CurationDecisionInput {
  id: string;
  destination: CurationDestination;
  managerRationale: string;
  decidedBy: string;
  decidedAt: string;
}

export interface CurationRepositoryPort {
  isSignalInCuration(clientId: string, signalId: string): boolean;
  /**
   * Advice-sourced duplicate: same adviceActionId, or same title when the
   * existing row has no signalId (pending, decided, or discarded).
   */
  findDuplicateAdviceCuration(
    clientId: string,
    params: { adviceActionId: string; title: string }
  ): CurationEntry | undefined;
  addToCuration(entry: CurationEntryCreateInput): CurationEntry;
  getById(id: string): CurationEntry | undefined;
  decideCuration(input: CurationDecisionInput): CurationEntry | null;
}
