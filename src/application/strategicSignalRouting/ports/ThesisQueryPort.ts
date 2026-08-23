import type { PositioningThesis } from '../../../types';

/** Neutral thesis query — Application must not depend on a primary-thesis helper. */
export interface ThesisQueryPort {
  getThesesForClient(clientId: string): PositioningThesis[];
}
