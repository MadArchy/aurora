import type { Signal } from '../types';

const STOPWORDS = new Set([
  'para', 'como', 'sobre', 'entre', 'desde', 'hasta', 'este', 'esta', 'estos', 'estas',
  'que', 'los', 'las', 'del', 'con', 'por', 'una', 'unos', 'unas', 'sus', 'más', 'mas',
  'ante', 'tras', 'según', 'segun', 'nuevo', 'nueva', 'the', 'and', 'for', 'with', 'from',
  'this', 'that', 'will', 'have', 'about', 'after', 'into', 'over', 'under', 'says', 'said',
]);

export interface SignalClusterMember {
  signalId: string;
  sourceName: string;
  sourceUrl?: string;
  relevanceScore?: number;
}

export interface SignalCluster {
  /** Id estable del cluster (canonical signal id). */
  id: string;
  /** Señal representante (mejor score / mejor autoridad). */
  canonicalSignalId: string;
  title: string;
  members: SignalClusterMember[];
  memberCount: number;
  /** Nombres de medios adicionales (sin el canónico). */
  alsoIn: string[];
  topScore: number;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Tokens significativos del titular (para similitud de “misma noticia”). */
export function titleTokens(title: string): string[] {
  return Array.from(
    new Set(
      normalize(title)
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 3 && !STOPWORDS.has(t))
    )
  );
}

/** Jaccard sobre tokens del título. */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  const shared = ta.filter((t) => setB.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return shared / Math.max(1, union);
}

function pickCanonical(members: Signal[]): Signal {
  return members.reduce((best, cur) => {
    const scoreB = best.relevanceScore || 0;
    const scoreC = cur.relevanceScore || 0;
    if (scoreC !== scoreB) return scoreC > scoreB ? cur : best;
    const authRank = (s: Signal) =>
      s.sourceQuality === 'HIGH' ? 3 : s.sourceQuality === 'MEDIUM' ? 2 : s.sourceType === 'REGULATORY' ? 3 : 1;
    if (authRank(cur) !== authRank(best)) return authRank(cur) > authRank(best) ? cur : best;
    return Date.parse(cur.detectedAt) > Date.parse(best.detectedAt) ? cur : best;
  });
}

/**
 * Agrupa señales que son la “misma historia” en distintos medios.
 * Umbral alto (0.45 Jaccard) para evitar fusionar temas distintos.
 */
export function clusterSimilarSignals(signals: Signal[], minSimilarity = 0.45): SignalCluster[] {
  const active = signals.filter((s) => s.status !== 'DISCARDED');
  const used = new Set<string>();
  const clusters: SignalCluster[] = [];

  for (let i = 0; i < active.length; i += 1) {
    const seed = active[i];
    if (used.has(seed.id)) continue;

    const members: Signal[] = [seed];
    used.add(seed.id);

    for (let j = i + 1; j < active.length; j += 1) {
      const candidate = active[j];
      if (used.has(candidate.id)) continue;
      if (titleSimilarity(seed.title, candidate.title) >= minSimilarity) {
        members.push(candidate);
        used.add(candidate.id);
      }
    }

    // Segunda pasada: unir candidatos similares a cualquier miembro (cadena corta).
    let grew = true;
    while (grew) {
      grew = false;
      for (const candidate of active) {
        if (used.has(candidate.id)) continue;
        const hit = members.some((m) => titleSimilarity(m.title, candidate.title) >= minSimilarity);
        if (hit) {
          members.push(candidate);
          used.add(candidate.id);
          grew = true;
        }
      }
    }

    const canonical = pickCanonical(members);
    const alsoIn = members
      .filter((m) => m.id !== canonical.id)
      .map((m) => m.sourceName)
      .filter((name, idx, arr) => arr.indexOf(name) === idx);

    clusters.push({
      id: `cluster_${canonical.id}`,
      canonicalSignalId: canonical.id,
      title: canonical.title,
      members: members.map((m) => ({
        signalId: m.id,
        sourceName: m.sourceName,
        sourceUrl: m.sourceUrl,
        relevanceScore: m.relevanceScore,
      })),
      memberCount: members.length,
      alsoIn,
      topScore: Math.max(...members.map((m) => m.relevanceScore || 0)),
    });
  }

  return clusters.sort((a, b) => b.topScore - a.topScore || b.memberCount - a.memberCount);
}

/** Reduce lista de señales a representantes canónicos (para triage/lista sin ruido). */
export function canonicalSignalsFromClusters(signals: Signal[], clusters?: SignalCluster[]): Signal[] {
  const grouped = clusters || clusterSimilarSignals(signals);
  const byId = new Map(signals.map((s) => [s.id, s]));
  return grouped
    .map((c) => byId.get(c.canonicalSignalId))
    .filter((s): s is Signal => Boolean(s));
}

export function clusterForSignal(signalId: string, clusters: SignalCluster[]): SignalCluster | undefined {
  return clusters.find((c) => c.members.some((m) => m.signalId === signalId));
}
