import type { SignalRoutingHistoryEntry } from '../../../domain/routingHistoryCore';

/**
 * Read port for routing history.
 * Writes happen atomically with current-state via SignalWritePort.
 */
export interface RoutingHistoryPort {
  listHistoryForSignal(signalId: string): SignalRoutingHistoryEntry[];
}
