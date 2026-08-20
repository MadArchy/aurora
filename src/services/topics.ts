import { PriorityBand, Signal, Topic, TopicMomentum } from '../types';
import { dbService } from './db';

const STOPWORDS = new Set([
  'para', 'como', 'sobre', 'entre', 'desde', 'hasta', 'este', 'esta', 'estos', 'estas',
  'que', 'los', 'las', 'del', 'con', 'por', 'una', 'unos', 'unas', 'sus', 'más', 'mas',
  'ante', 'tras', 'según', 'segun', 'nuevo', 'nueva', 'nuevos', 'nuevas', 'gran',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'will', 'have', 'about',
]);

function keywordsOf(signal: Signal): string[] {
  const text = `${signal.title} ${signal.targetDomain || ''}`.toLowerCase();
  return Array.from(
    new Set(
      text
        .split(/[^a-záéíóúñü0-9]+/i)
        .filter((t) => t.length > 4 && !STOPWORDS.has(t))
    )
  );
}

function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const shared = a.filter((t) => setB.has(t)).length;
  return shared / Math.min(a.length, b.length);
}

function bandOf(score: number): PriorityBand {
  if (score >= 85) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

function momentumOf(recent: number, previous: number, total: number): TopicMomentum {
  if (previous === 0 && recent > 0) return total <= 2 ? 'EMERGING' : 'RISING';
  if (recent > previous) return 'RISING';
  if (recent < previous) return 'FADING';
  return 'STEADY';
}

/**
 * Agrupa las señales de un cliente en temas por solapamiento de palabras clave.
 * Los temas son derivados: solo los pines se persisten.
 */
export function buildTopics(clientId: string, signals: Signal[], minSimilarity = 0.34): Topic[] {
  const pins = dbService.getTopicPins();
  const relevant = signals.filter((s) => s.status !== 'DISCARDED');

  const clusters: Array<{ keywords: string[]; signals: Signal[] }> = [];

  for (const signal of relevant) {
    const keys = keywordsOf(signal);
    if (!keys.length) continue;

    let best: { cluster: (typeof clusters)[number]; score: number } | null = null;
    for (const cluster of clusters) {
      const score = similarity(keys, cluster.keywords);
      if (score >= minSimilarity && (!best || score > best.score)) {
        best = { cluster, score };
      }
    }

    if (best) {
      best.cluster.signals.push(signal);
      for (const k of keys) {
        if (!best.cluster.keywords.includes(k)) best.cluster.keywords.push(k);
      }
    } else {
      clusters.push({ keywords: keys, signals: [signal] });
    }
  }

  const now = Date.now();
  const weekMs = 7 * 86400000;

  return clusters
    .map(({ keywords, signals: members }) => {
      const scores = members.map((s) => s.relevanceScore || 0);
      const topScore = Math.max(...scores, 0);
      const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / members.length);
      const times = members.map((s) => Date.parse(s.detectedAt) || now);
      const recentCount = times.filter((t) => now - t <= weekMs).length;
      const previousCount = times.filter((t) => now - t > weekMs && now - t <= weekMs * 2).length;
      const topSignal = members.reduce((a, b) => ((b.relevanceScore || 0) > (a.relevanceScore || 0) ? b : a));
      const key = `topic_${keywords.slice(0, 3).sort().join('_')}`;

      const topic: Topic = {
        key,
        label: topSignal.targetDomain || keywords.slice(0, 3).join(' · '),
        keywords: keywords.slice(0, 8),
        clientId,
        signalIds: members.map((s) => s.id),
        signalCount: members.length,
        avgScore,
        topScore,
        topSignalId: topSignal.id,
        priorityBand: bandOf(topScore),
        firstSeenAt: new Date(Math.min(...times)).toISOString(),
        lastSeenAt: new Date(Math.max(...times)).toISOString(),
        recentCount,
        previousCount,
        momentum: momentumOf(recentCount, previousCount, members.length),
        pinned: pins.includes(key),
      };
      return topic;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.topScore - a.topScore;
    });
}

export function momentumLabel(momentum: TopicMomentum): string {
  switch (momentum) {
    case 'EMERGING': return 'Emergente';
    case 'RISING': return 'Al alza';
    case 'FADING': return 'Perdiendo fuerza';
    default: return 'Estable';
  }
}
