import type { Signal } from '../../../types';

export interface SignalReadPort {
  getSignalById(signalId: string): Signal | undefined;
}
