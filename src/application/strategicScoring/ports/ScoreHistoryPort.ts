import type { SignalScoreHistoryEntry } from '../../../domain/scoreHistoryCore';

export interface ScoreHistoryPort {
  listHistoryForSignal(signalId: string): SignalScoreHistoryEntry[];
}
