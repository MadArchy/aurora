export interface CurationRemovalPersistencePort {
  removeById(curationEntryId: string): void;
}
