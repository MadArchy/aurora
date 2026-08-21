import type { PriorityBand, Signal } from '../types';

export type SignalOutcomeKind = 'USEFUL' | 'NOT_USEFUL';

export interface SignalOutcome {
  id: string;
  organizationId: string;
  clientId: string;
  signalId: string;
  kind: SignalOutcomeKind;
  note?: string;
  /** Origen del feedback: entrega, curación o revisión en radar. */
  source: 'RADAR' | 'CURATION' | 'DELIVERY';
  actorUid: string;
  createdAt: string;
}

export interface SignalConversionStats {
  converted: number;
  useful: number;
  notUseful: number;
  pendingFeedback: number;
  usefulRate: number | null;
}

/** Señales convertidas (o enviadas en briefing) sin feedback aún. */
export function signalsAwaitingOutcome(signals: Signal[], outcomes: SignalOutcome[]): Signal[] {
  const rated = new Set(outcomes.map((o) => o.signalId));
  return signals.filter(
    (s) =>
      !rated.has(s.id) &&
      s.status !== 'DISCARDED' &&
      (s.status === 'CONVERTED' || s.managerDecision === 'CONVERTED' || s.managerDecision === 'SAVED')
  );
}

export function computeConversionStats(signals: Signal[], outcomes: SignalOutcome[]): SignalConversionStats {
  const converted = signals.filter((s) => s.status === 'CONVERTED' || s.managerDecision === 'CONVERTED').length;
  const useful = outcomes.filter((o) => o.kind === 'USEFUL').length;
  const notUseful = outcomes.filter((o) => o.kind === 'NOT_USEFUL').length;
  const rated = useful + notUseful;
  const pendingFeedback = signalsAwaitingOutcome(signals, outcomes).length;
  return {
    converted,
    useful,
    notUseful,
    pendingFeedback,
    usefulRate: rated > 0 ? Math.round((useful / rated) * 100) : null,
  };
}

/**
 * Ajuste suave para scoring: términos de señales marcadas útiles se refuerzan;
 * las no útiles aportan framings a evitar.
 */
export function feedbackScoringHints(
  signals: Signal[],
  outcomes: SignalOutcome[]
): { boostTerms: string[]; avoidTerms: string[] } {
  const byId = new Map(signals.map((s) => [s.id, s]));
  const boostTerms: string[] = [];
  const avoidTerms: string[] = [];

  for (const outcome of outcomes) {
    const signal = byId.get(outcome.signalId);
    if (!signal) continue;
    const tokens = `${signal.title} ${signal.targetDomain || ''}`
      .toLowerCase()
      .split(/[^a-záéíóúñü0-9]+/i)
      .filter((t) => t.length > 4)
      .slice(0, 6);
    if (outcome.kind === 'USEFUL') boostTerms.push(...tokens);
    else avoidTerms.push(...tokens);
  }

  return {
    boostTerms: Array.from(new Set(boostTerms)).slice(0, 24),
    avoidTerms: Array.from(new Set(avoidTerms)).slice(0, 24),
  };
}

export function bandPriorityWeight(band?: PriorityBand): number {
  switch (band) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 3;
    case 'MEDIUM':
      return 2;
    case 'LOW':
      return 1;
    default:
      return 0;
  }
}
