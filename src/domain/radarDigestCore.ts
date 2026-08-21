import type { Client, Signal } from '../types';
import { bandPriorityWeight, type SignalOutcome } from './radarFeedbackCore';
import { groupSignalsForTriage } from './radarTriageCore';
import { canonicalSignalsFromClusters, clusterSimilarSignals } from './signalClusterCore';

export interface DigestItem {
  clientId: string;
  clientName: string;
  signalId: string;
  title: string;
  score?: number;
  priorityBand?: string;
  sourceName: string;
  recommendedAction?: string;
  alsoInCount: number;
}

export interface PortfolioDigest {
  generatedAt: string;
  periodLabel: string;
  decideNowTotal: number;
  criticalTotal: number;
  converted7d: number;
  usefulRate: number | null;
  topItems: DigestItem[];
  byClient: Array<{
    clientId: string;
    clientName: string;
    decideNow: number;
    topTitle?: string;
  }>;
}

function sinceDays(days: number): Date {
  return new Date(Date.now() - days * 86400000);
}

/**
 * Digest de cartera: top historias "decidir ahora" por cliente (últimos 7 días).
 */
export function buildPortfolioDigest(
  clients: Client[],
  getSignals: (clientId: string) => Signal[],
  outcomes: SignalOutcome[],
  options?: { maxItems?: number; days?: number }
): PortfolioDigest {
  const days = options?.days ?? 7;
  const maxItems = options?.maxItems ?? 8;
  const since = sinceDays(days).toISOString();
  const topItems: DigestItem[] = [];
  const byClient: PortfolioDigest['byClient'] = [];

  let decideNowTotal = 0;
  let criticalTotal = 0;
  let converted7d = 0;

  for (const client of clients) {
    const all = getSignals(client.id);
    const recent = all.filter((s) => s.status !== 'DISCARDED' && s.detectedAt >= since);
    const clusters = clusterSimilarSignals(recent);
    const canonical = canonicalSignalsFromClusters(recent, clusters);
    const triage = groupSignalsForTriage(canonical);

    decideNowTotal += triage.decideNow.length;
    criticalTotal += canonical.filter((s) => s.priorityBand === 'CRITICAL').length;
    converted7d += all.filter(
      (s) => (s.status === 'CONVERTED' || s.managerDecision === 'CONVERTED') && s.detectedAt >= since
    ).length;

    byClient.push({
      clientId: client.id,
      clientName: client.displayName,
      decideNow: triage.decideNow.length,
      topTitle: triage.decideNow[0]?.title,
    });

    for (const signal of triage.decideNow.slice(0, 3)) {
      const cluster = clusters.find((c) => c.canonicalSignalId === signal.id);
      topItems.push({
        clientId: client.id,
        clientName: client.displayName,
        signalId: signal.id,
        title: signal.title,
        score: signal.relevanceScore,
        priorityBand: signal.priorityBand,
        sourceName: signal.sourceName,
        recommendedAction: signal.recommendedAction,
        alsoInCount: cluster ? Math.max(0, cluster.memberCount - 1) : 0,
      });
    }
  }

  topItems.sort((a, b) => {
    const bw = bandPriorityWeight(b.priorityBand as Signal['priorityBand']) - bandPriorityWeight(a.priorityBand as Signal['priorityBand']);
    if (bw !== 0) return bw;
    return (b.score || 0) - (a.score || 0);
  });

  const clientOutcomes = outcomes.filter((o) => o.createdAt >= since);
  const useful = clientOutcomes.filter((o) => o.kind === 'USEFUL').length;
  const rated = clientOutcomes.length;

  byClient.sort((a, b) => b.decideNow - a.decideNow);

  return {
    generatedAt: new Date().toISOString(),
    periodLabel: `Últimos ${days} días`,
    decideNowTotal,
    criticalTotal,
    converted7d,
    usefulRate: rated > 0 ? Math.round((useful / rated) * 100) : null,
    topItems: topItems.slice(0, maxItems),
    byClient: byClient.filter((c) => c.decideNow > 0).slice(0, 10),
  };
}
