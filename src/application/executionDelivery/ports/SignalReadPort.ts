import type { Signal } from '../../../types';

/** Read-only Signal dependency for authoritative reload — not Signal Intake mutation. */
export interface SignalReadPort {
  getById(signalId: string): Signal | undefined;
}
