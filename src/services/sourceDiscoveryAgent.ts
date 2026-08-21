import { dbService } from './db';
import {
  buildProfileKeywords,
  DiscoveredSource,
  normalizeSourceUrl,
  pendingDiscoveries,
  ProfileKeywords,
} from './sourceDiscovery';
import { pendingExtendedSources, discoverExtendedSources } from './extendedSourceDiscovery';
import { enrichYoutubeDiscoverySources } from './youtubeDiscovery';
import { buildCuratedPresetsForProfile } from './industryPresets';
import { discoverViaTavily, getCachedTavilySources } from './tavilyDiscovery';
import type { Client, PositioningThesis } from '../types';
import { isSourceEligibleForIngest } from '../domain/sourceIngestCore';

export type SourceAgentPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SourceAgentRecommendation extends DiscoveredSource {
  score: number;
  priority: SourceAgentPriority;
  /** Explicación del agente para el manager (por qué activarla ahora). */
  agentRationale: string;
}

export interface SourceDiscoveryAgentRun {
  clientId: string;
  scannedAt: string;
  profileSignature: string;
  recommendations: SourceAgentRecommendation[];
  pendingCount: number;
  registeredCount: number;
  tavilyUsed?: boolean;
  tavilyFromCache?: boolean;
  tavilyError?: string;
  youtubeUsed?: boolean;
  youtubeError?: string;
}

const AGENT_STORAGE_KEY = 'postura_source_agent_v1';

function profileSignature(clientId: string, keywords: ProfileKeywords, thesis?: PositioningThesis): string {
  return [
    clientId,
    thesis?.id || 'no-thesis',
    thesis?.domain || '',
    [...keywords.coreEn, ...keywords.coreEs].join('|'),
    keywords.strong.join('|'),
  ].join('::');
}

function scoreCandidate(candidate: DiscoveredSource, keywords: ProfileKeywords): number {
  let score = candidate.kind === 'OFFICIAL' ? 28 : candidate.kind === 'ACADEMIC' ? 26 : candidate.kind === 'YOUTUBE' ? 22 : candidate.kind === 'TAVILY' ? 22 : candidate.kind === 'SOCIAL' ? 16 : 12;
  if (candidate.key.startsWith('curated_')) score += 24;
  if (candidate.type === 'REGULATORY') score += 18;
  if (candidate.type === 'ACADEMIC') score += 10;

  const haystack = normalizeSourceUrl(candidate.url) + ' ' + candidate.name + ' ' + candidate.rationale;
  const normalizedHaystack = haystack.toLowerCase();

  const phraseHits = [...keywords.coreEn, ...keywords.coreEs].filter((term) =>
    normalizedHaystack.includes(term.toLowerCase())
  ).length;
  const tokenHits = keywords.strong.filter((token) => normalizedHaystack.includes(token.toLowerCase())).length;
  const contextHits = keywords.context.filter((term) =>
    normalizedHaystack.includes(term.toLowerCase())
  ).length;

  score += phraseHits * 8 + tokenHits * 4 + Math.min(contextHits, 2) * 3;
  if (candidate.locale === 'EN_US') score += 4;
  if (candidate.locale === 'ES_MX') score += 4;
  return score;
}

function priorityFromScore(score: number): SourceAgentPriority {
  if (score >= 45) return 'HIGH';
  if (score >= 28) return 'MEDIUM';
  return 'LOW';
}

function buildAgentRationale(
  candidate: DiscoveredSource,
  keywords: ProfileKeywords,
  priority: SourceAgentPriority
): string {
  const terms = [...keywords.coreEn.slice(0, 2), ...keywords.coreEs.slice(0, 2)];
  const termHint = terms.length ? ` Alineada con ${terms.slice(0, 2).join(' y ')} del perfil.` : '';

  if (candidate.kind === 'OFFICIAL') {
    return priority === 'HIGH'
      ? `Fuente primaria verificada con alta autoridad para el radar.${termHint}`
      : `Organismo o medio especializado relevante al dominio.${termHint}`;
  }

  if (candidate.kind === 'YOUTUBE') {
    return priority === 'HIGH'
      ? `Canal o videos de YouTube alineados al dominio.${termHint}`
      : `Ampliar radar con contenido en video del sector.${termHint}`;
  }

  if (candidate.kind === 'SOCIAL') {
    return `Conversación social indexada (LinkedIn/X) sobre el dominio.${termHint}`;
  }

  if (candidate.kind === 'ACADEMIC') {
    return priority === 'HIGH'
      ? `Fuente académica o educativa para respaldar claims con evidencia.${termHint}`
      : `Investigación y preprints relevantes al perfil.${termHint}`;
  }

  if (candidate.kind === 'TAVILY') {
    return candidate.key.startsWith('curated_')
      ? `Preset curado de alta señal para el sector.${termHint}`
      : priority === 'HIGH'
        ? `Medio detectado en internet por Tavily con encaje en tu perfil.${termHint}`
        : `Fuente web sugerida por Tavily para ampliar cobertura.${termHint}`;
  }

  return priority === 'HIGH'
    ? `Consulta de noticias reciente (14 días) con fuerte encaje en la tesis.${termHint}`
    : `Ampliar cobertura del radar con señales del sector.${termHint}`;
}

function toRecommendations(
  pending: DiscoveredSource[],
  keywords: ProfileKeywords
): SourceAgentRecommendation[] {
  return pending
    .map((candidate) => {
      const score = scoreCandidate(candidate, keywords);
      const priority = priorityFromScore(score);
      return {
        ...candidate,
        score,
        priority,
        agentRationale: buildAgentRationale(candidate, keywords, priority),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function mergePendingSources(
  client: Client,
  thesis: PositioningThesis | undefined,
  extra: DiscoveredSource[],
  extendedSources?: DiscoveredSource[]
): DiscoveredSource[] {
  const keywords = buildProfileKeywords(client, thesis);
  const curated = buildCuratedPresetsForProfile(client, thesis, keywords);
  const cachedTavily = getCachedTavilySources(client, thesis);
  const extended = extendedSources ?? pendingExtendedSources(client, thesis);
  const existing = new Set(
    dbService.getSourcesByClient(client.id).map((s) => normalizeSourceUrl(s.url || ''))
  );
  const seenKeys = new Set<string>();
  const merged: DiscoveredSource[] = [];

  for (const candidate of [...curated, ...cachedTavily, ...pendingDiscoveries(client, thesis), ...extended, ...extra]) {
    if (existing.has(normalizeSourceUrl(candidate.url))) continue;
    if (seenKeys.has(candidate.key)) continue;
    seenKeys.add(candidate.key);
    merged.push(candidate);
  }

  return merged;
}

/** Resuelve una fuente descubierta por clave (curated, agent run, o baseline). */
export function resolveDiscoveryCandidate(
  client: Client,
  thesis: PositioningThesis | undefined,
  key: string
): DiscoveredSource | undefined {
  const keywords = buildProfileKeywords(client, thesis);
  const candidates: DiscoveredSource[] = [
    ...buildCuratedPresetsForProfile(client, thesis, keywords),
    ...mergePendingSources(client, thesis, []),
    ...(loadLastAgentRun(client.id)?.recommendations || []),
  ];
  return candidates.find((d) => d.key === key);
}

/**
 * Source Discovery Agent — escanea el perfil, genera consultas web (Google News RSS)
 * y feeds oficiales, y devuelve recomendaciones priorizadas que aún no están activas.
 */
export function runSourceDiscoveryAgent(
  client: Client,
  thesis?: PositioningThesis
): SourceDiscoveryAgentRun {
  const keywords = buildProfileKeywords(client, thesis);
  const pending = mergePendingSources(client, thesis, []);
  const registered = dbService.getSourcesByClient(client.id).filter((s) => s.status !== 'ARCHIVED').length;
  const recommendations = toRecommendations(pending, keywords);

  return {
    clientId: client.id,
    scannedAt: new Date().toISOString(),
    profileSignature: profileSignature(client.id, keywords, thesis),
    recommendations,
    pendingCount: recommendations.length,
    registeredCount: registered,
  };
}

/** Igual que runSourceDiscoveryAgent pero enriquece con búsqueda Tavily en internet. */
export async function runSourceDiscoveryAgentAsync(
  client: Client,
  thesis?: PositioningThesis,
  options?: { forceTavily?: boolean }
): Promise<SourceDiscoveryAgentRun> {
  const keywords = buildProfileKeywords(client, thesis);
  const registered = dbService.getSourcesByClient(client.id).filter((s) => s.status !== 'ARCHIVED').length;
  const profile = dbService.getMasterProfile(client.id);

  const tavily = await discoverViaTavily(client, thesis, { force: options?.forceTavily });
  const extendedBase = discoverExtendedSources(client, thesis);
  const youtubeEnriched = await enrichYoutubeDiscoverySources(extendedBase, keywords, profile || undefined);
  const pending = mergePendingSources(client, thesis, tavily.sources, youtubeEnriched.sources);
  const recommendations = toRecommendations(pending, keywords);

  return {
    clientId: client.id,
    scannedAt: new Date().toISOString(),
    profileSignature: profileSignature(client.id, keywords, thesis),
    recommendations,
    pendingCount: recommendations.length,
    registeredCount: registered,
    tavilyUsed: tavily.sources.length > 0,
    tavilyFromCache: tavily.fromCache,
    tavilyError: tavily.error,
    youtubeUsed: youtubeEnriched.usedApi,
    youtubeError: youtubeEnriched.error,
  };
}

export function isAgentRunCurrent(
  run: SourceDiscoveryAgentRun,
  client: Client,
  thesis?: PositioningThesis
): boolean {
  const keywords = buildProfileKeywords(client, thesis);
  return run.profileSignature === profileSignature(client.id, keywords, thesis);
}

export function loadLastAgentRun(clientId: string): SourceDiscoveryAgentRun | null {
  try {
    const raw = localStorage.getItem(AGENT_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, SourceDiscoveryAgentRun>;
    return map[clientId] || null;
  } catch {
    return null;
  }
}

export function saveAgentRun(run: SourceDiscoveryAgentRun): void {
  try {
    const raw = localStorage.getItem(AGENT_STORAGE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, SourceDiscoveryAgentRun>;
    map[run.clientId] = run;
    localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

/** True si el perfil cambió desde la última corrida del agente. */
export function profileChangedSinceLastRun(
  client: Client,
  thesis: PositioningThesis | undefined,
  lastRun: SourceDiscoveryAgentRun | null
): boolean {
  if (!lastRun) return true;
  const keywords = buildProfileKeywords(client, thesis);
  return profileSignature(client.id, keywords, thesis) !== lastRun.profileSignature;
}

export function sourcesDueForIngest(clientId: string, now = Date.now()): import('../types').Source[] {
  return dbService.getSourcesByClient(clientId).filter((source) => isSourceEligibleForIngest(source, now));
}
