import type { PositioningThesis } from '../../../types';

/** Authoritative PositioningThesis reload for #15 — read only. */
export interface CurationThesisReadPort {
  getById(clientId: string, thesisId: string): PositioningThesis | undefined;
}
