import type { Topic, TopicMomentum } from '../types';
import { buildTopics } from '../services/topics';
import type { Signal, PositioningThesis } from '../types';

export interface TopicAgentRankedItem {
  rank: number;
  topicKey: string;
  label: string;
  score: number;
  momentum: TopicMomentum;
  signalCount: number;
  rationale: string;
}

function thesisKeywordSet(thesis?: PositioningThesis): Set<string> {
  if (!thesis) return new Set();
  const text = [
    thesis.title,
    thesis.expertIdentity,
    thesis.domain,
    thesis.objective,
    thesis.differentiator || '',
    ...(thesis.proofPoints || []),
  ].join(' ').toLowerCase();
  return new Set(
    text.split(/[^a-záéíóúñü0-9]+/i).filter((t) => t.length > 4)
  );
}

function buildRationale(topic: Topic, thesis?: PositioningThesis): string {
  const thesisKeys = thesisKeywordSet(thesis);
  const overlap = topic.keywords.filter((k) => thesisKeys.has(k.toLowerCase()));
  const momentumText =
    topic.momentum === 'EMERGING' ? 'tema emergente esta semana'
      : topic.momentum === 'RISING' ? 'ganando tracción vs. semana anterior'
        : topic.momentum === 'FADING' ? 'pierde relevancia reciente'
          : 'mantiene presencia estable';

  if (overlap.length >= 2) {
    return `Encaja con ${overlap.slice(0, 2).join(' y ')} de la tesis activa; ${momentumText} (${topic.signalCount} señales, pico ${topic.topScore}).`;
  }
  if (topic.topScore >= 75) {
    return `Alta relevancia estratégica (${topic.topScore}); ${momentumText} con ${topic.signalCount} señales recientes.`;
  }
  return `${momentumText.charAt(0).toUpperCase()}${momentumText.slice(1)} — conviene monitorear antes de convertir en entrega.`;
}

/** Topic Agent v1 — ranking diario determinista con rationale (Oleada 7.5).
 * Accepts one thesis or many ACTIVE theses (client-wide; no primary collapse).
 */
export function rankDailyTopics(
  clientId: string,
  signals: Signal[],
  thesisOrTheses?: PositioningThesis | PositioningThesis[],
  limit = 5
): TopicAgentRankedItem[] {
  const theses = Array.isArray(thesisOrTheses)
    ? thesisOrTheses
    : thesisOrTheses
      ? [thesisOrTheses]
      : [];
  const topics = buildTopics(clientId, signals);
  return topics
    .sort((a, b) => {
      const scoreA = a.topScore + (a.momentum === 'RISING' ? 8 : a.momentum === 'EMERGING' ? 12 : 0);
      const scoreB = b.topScore + (b.momentum === 'RISING' ? 8 : b.momentum === 'EMERGING' ? 12 : 0);
      return scoreB - scoreA;
    })
    .slice(0, limit)
    .map((topic, index) => ({
      rank: index + 1,
      topicKey: topic.key,
      label: topic.label,
      score: topic.topScore,
      momentum: topic.momentum,
      signalCount: topic.signalCount,
      rationale: buildRationaleMulti(topic, theses),
    }));
}

function buildRationaleMulti(topic: Topic, theses: PositioningThesis[]): string {
  if (!theses.length) return buildRationale(topic, undefined);
  // Prefer the thesis with most keyword overlap; do not invent a "primary".
  let best: PositioningThesis | undefined;
  let bestOverlap = -1;
  for (const thesis of theses) {
    const keys = thesisKeywordSet(thesis);
    const overlap = topic.keywords.filter((k) => keys.has(k.toLowerCase())).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = thesis;
    }
  }
  return buildRationale(topic, best);
}
