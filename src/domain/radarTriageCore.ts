import type { PriorityBand, RecommendedAction, Signal, StrategicDisposition } from '../types';

export type RadarTriageBucket = 'DECIDE_NOW' | 'REVIEW' | 'MONITOR';

export interface RadarTriageGroups {
  decideNow: Signal[];
  review: Signal[];
  monitor: Signal[];
}

function effectiveDisposition(signal: Signal): StrategicDisposition | undefined {
  if (signal.recommendedDisposition) return signal.recommendedDisposition;
  const action = signal.recommendedAction as RecommendedAction | undefined;
  if (!action) return undefined;
  if (action === 'CREATE_OPPORTUNITY') return 'OPPORTUNITY_CANDIDATE';
  if (action === 'RESEARCH_REQUIRED') return 'RESEARCH_REQUIRED';
  if (action === 'MONITOR' || action === 'NO_ACTION') return action;
  if (action === 'VIDEO' || action === 'SHORT_POST' || action === 'SAVE' || action === 'ARTICLE') {
    return 'SAVE';
  }
  return undefined;
}

/** Señales que el manager debe resolver primero. */
export function triageBucket(signal: Signal): RadarTriageBucket {
  const band = signal.priorityBand as PriorityBand | undefined;
  const disposition = effectiveDisposition(signal);

  if (band === 'CRITICAL' || band === 'HIGH') return 'DECIDE_NOW';
  if (disposition === 'RESEARCH_REQUIRED' && !signal.researchBrief) return 'DECIDE_NOW';
  if (
    disposition === 'OPPORTUNITY_CANDIDATE' ||
    disposition === 'SAVE' ||
    signal.recommendedOutputFormat === 'VIDEO' ||
    signal.recommendedOutputFormat === 'SHORT_POST'
  ) {
    return 'REVIEW';
  }
  if (band === 'MEDIUM') return 'REVIEW';
  return 'MONITOR';
}

export function groupSignalsForTriage(signals: Signal[]): RadarTriageGroups {
  const decideNow: Signal[] = [];
  const review: Signal[] = [];
  const monitor: Signal[] = [];

  for (const signal of signals) {
    if (signal.status === 'DISCARDED') continue;
    const bucket = triageBucket(signal);
    if (bucket === 'DECIDE_NOW') decideNow.push(signal);
    else if (bucket === 'REVIEW') review.push(signal);
    else monitor.push(signal);
  }

  const byScore = (a: Signal, b: Signal) => (b.relevanceScore || 0) - (a.relevanceScore || 0);
  decideNow.sort(byScore);
  review.sort(byScore);
  monitor.sort(byScore);

  return { decideNow, review, monitor };
}

/** @deprecated Strategic scoring paths must not auto-DISCARD from score (SPEC-002 Phase 4). */
export function shouldAutoDiscardScoredSignal(score: {
  totalScore: number;
  recommendedAction: RecommendedAction;
}): boolean {
  return score.recommendedAction === 'NO_ACTION' && score.totalScore < 40;
}

/** Prioridad para auto-investigación post-ingesta. */
export function shouldAutoResearchSignal(signal: Signal): boolean {
  if (signal.status === 'DISCARDED') return false;
  if (signal.researchBrief) return false;
  if (signal.recommendedAction !== 'RESEARCH_REQUIRED') return false;
  return signal.priorityBand === 'CRITICAL' || signal.priorityBand === 'HIGH';
}
