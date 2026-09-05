/** Narrow write port for #15 — does not extend frozen B3 CurationRepositoryPort. */
export interface CurationAnglePersistencePort {
  setAngle(curationEntryId: string, aiAngle: string): void;
}
