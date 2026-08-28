import type { PositioningThesis } from '../../../types';

/**
 * Capability port for Thesis Lifecycle persistence.
 * Explicit thesisId required — no positional selection.
 */
export interface ThesisRepository {
  getById(clientId: string, thesisId: string): PositioningThesis | undefined;
  listByClient(clientId: string): PositioningThesis[];
  save(thesis: PositioningThesis): void;
}
