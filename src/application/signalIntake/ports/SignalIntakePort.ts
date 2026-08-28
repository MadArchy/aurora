import type { Signal } from '../../../types';

export type SignalIntakeWrite = Omit<
  Signal,
  'id' | 'detectedAt' | 'fingerprint' | 'aiStatus' | 'managerDecision'
> &
  Partial<Pick<Signal, 'aiStatus' | 'managerDecision' | 'sourceQuality'>>;

/**
 * Capability port — signal intake persistence + client-scoped dedup.
 * Must not perform thesis routing or scoring.
 */
export interface SignalIntakePort {
  add(signal: SignalIntakeWrite): { signal: Signal; isDuplicate: boolean };
}
