import {
  buildGoogleNewsFeedUrl,
  buildProfileKeywords,
  type DiscoveredSource,
  type DiscoveryLocale,
  type ProfileKeywords,
} from './sourceDiscovery';
import {
  buildCuratedPresetsForIndustry,
  buildCuratedPresetsForProfile,
  detectIndustryPreset,
} from './industryPresets';
import type { Client, PositioningThesis } from '../types';

export interface TavilySearchResult {
  title: string;
  url: string;
  content?: string;
  score?: number;
}

export interface TavilyCacheEntry {
  profileSignature: string;
  scannedAt: string;
  sources: DiscoveredSource[];
}

const TAVILY_CACHE_KEY = 'postura_tavily_discoveries_v1';
const TAVILY_CACHE_TTL_MS = 60 * 60 * 1000;

const SKIP_DOMAINS =
  /(^|\.)google\.|facebook\.com|twitter\.com|x\.com|youtube\.com|linkedin\.com|wikipedia\.org|reddit\.com|instagram\.com/i;

/** Medios de entretenimiento/generalistas que suelen ser ruido para perfiles legales/IP. */
const LOW_VALUE_DOMAINS =
  /variety\.com|counterview\.|buzzfeed|tmz\.|people\.com|eonline\.|hollywoodreporter/i;

/** Dominios con alta señal para IP, legal tech y regulación. */
const TRUSTED_SECTOR_DOMAINS =
  /(^|\.)((law|legal)\.com|bloomberglaw|managingip|iam-media|ipwatchdog|uspto|nist|reuters|ft\.com|wsj|patently|juve|worldipreview)/i;

const FEED_PATH = /\/(feed|rss|atom)(\/|$|\.xml)/i;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matchesProfile(text: string, keywords: ProfileKeywords): boolean {
  const haystack = normalize(text);
  const words = new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean));
  if ([...keywords.coreEn, ...keywords.coreEs].some((term) => haystack.includes(normalize(term)))) {
    return true;
  }
  if (keywords.strong.filter((token) => words.has(normalize(token))).length >= 1) {
    return true;
  }
  return keywords.context.filter((term) => haystack.includes(normalize(term))).length >= 2;
}

function isRelevantTavilyResult(result: TavilySearchResult, hostname: string, keywords: ProfileKeywords): boolean {
  if (LOW_VALUE_DOMAINS.test(hostname)) return false;
  if (TRUSTED_SECTOR_DOMAINS.test(hostname)) return true;
  if (typeof result.score === 'number' && result.score >= 0.72) return true;
  const blob = `${result.title} ${result.content || ''}`;
  return matchesProfile(blob, keywords);
}

function profileSignature(clientId: string, keywords: ProfileKeywords, thesis?: PositioningThesis): string {
  return [
    clientId,
    thesis?.id || 'no-thesis',
    thesis?.domain || '',
    [...keywords.coreEn, ...keywords.coreEs].join('|'),
    keywords.strong.join('|'),
  ].join('::');
}

function loadTavilyCache(clientId: string): TavilyCacheEntry | null {
  try {
    const raw = localStorage.getItem(TAVILY_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, TavilyCacheEntry>;
    return map[clientId] || null;
  } catch {
    return null;
  }
}

function saveTavilyCache(clientId: string, entry: TavilyCacheEntry): void {
  try {
    const raw = localStorage.getItem(TAVILY_CACHE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, TavilyCacheEntry>;
    map[clientId] = entry;
    localStorage.setItem(TAVILY_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

/** Consulta de noticias para Tavily derivada del perfil del cliente. */
export function buildTavilySearchQuery(
  client: Client,
  thesis: PositioningThesis | undefined,
  keywords: ProfileKeywords
): string {
  const parts = [
    thesis?.domain,
    thesis?.title,
    client.profession,
    ...keywords.coreEn.slice(0, 3),
    ...keywords.coreEs.slice(0, 2),
    'patent intellectual property AI adoption legal news',
  ].filter(Boolean);
  return parts.join(' ').slice(0, 400);
}

/** Ordena y filtra resultados Tavily antes de convertirlos en fuentes. */
export function filterTavilyResults(
  results: TavilySearchResult[],
  keywords: ProfileKeywords
): TavilySearchResult[] {
  return [...results]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .filter((result) => {
      try {
        const hostname = new URL(result.url).hostname.replace(/^www\./, '');
        if (SKIP_DOMAINS.test(hostname)) return false;
        return isRelevantTavilyResult(result, hostname, keywords);
      } catch {
        return false;
      }
    });
}

/** Convierte resultados Tavily en fuentes registrables (feeds directos o Google News por sitio). */
export function mapTavilyResultsToSources(
  results: TavilySearchResult[],
  keywords: ProfileKeywords
): DiscoveredSource[] {
  const discovered: DiscoveredSource[] = [];
  const seenDomains = new Set<string>();
  const seenKeys = new Set<string>();

  for (const result of filterTavilyResults(results, keywords)) {
    let hostname: string;
    try {
      hostname = new URL(result.url).hostname.replace(/^www\./, '');
    } catch {
      continue;
    }

    if (SKIP_DOMAINS.test(hostname)) continue;

    const isFeed = FEED_PATH.test(result.url) || result.url.endsWith('.xml');

    if (isFeed) {
      const key = `tavily_feed_${hostname.replace(/[^a-z0-9]+/gi, '_')}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      discovered.push({
        key,
        name: `${hostname} — RSS (Tavily)`,
        type: 'RSS',
        url: result.url,
        locale: 'ANY',
        rationale: `Feed detectado en web: ${result.title.slice(0, 90)}`,
        kind: 'TAVILY',
      });
      continue;
    }

    if (seenDomains.has(hostname)) continue;
    seenDomains.add(hostname);

    const terms = [...keywords.coreEn.slice(0, 2), ...keywords.strong.slice(0, 2)].filter(Boolean);
    const quotedTerms = terms.map((t) => (t.includes(' ') ? `"${t}"` : t));
    const siteQuery = quotedTerms.length
      ? `site:${hostname} (${quotedTerms.join(' OR ')}) when:14d`
      : `site:${hostname} when:14d`;

    const key = `tavily_site_${hostname.replace(/[^a-z0-9]+/gi, '_')}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const locale: DiscoveryLocale = /\.mx$|\.es$|eluniversal|reforma|jornada/i.test(hostname)
      ? 'ES_MX'
      : 'EN_US';

    discovered.push({
      key,
      name: `${hostname} — noticias del sector`,
      type: 'MEDIA',
      url: buildGoogleNewsFeedUrl(siteQuery, locale),
      locale,
      rationale: `Medio encontrado por Tavily: «${result.title.slice(0, 80)}»`,
      kind: 'TAVILY',
    });
  }

  return discovered.slice(0, 5);
}

/** Top 3 medios IP + legal — ver industryPresets. */
export { getCuratedIpLegalMedia } from './industryPresets';

export function isIpLegalProfile(
  client: Client,
  thesis?: PositioningThesis,
  keywords?: ProfileKeywords
): boolean {
  const kw = keywords || buildProfileKeywords(client, thesis);
  return detectIndustryPreset(client, thesis, kw) === 'IP_LEGAL';
}

/** Preset curado según industria detectada (Top 3 medios por sitio). */
export function buildCuratedTopMediaPresets(keywords: ProfileKeywords): DiscoveredSource[] {
  return buildCuratedPresetsForIndustry('IP_LEGAL', keywords) as DiscoveredSource[];
}

export function buildCuratedPresetsForClient(
  client: Client,
  thesis: PositioningThesis | undefined,
  keywords: ProfileKeywords
): DiscoveredSource[] {
  return buildCuratedPresetsForProfile(client, thesis, keywords) as DiscoveredSource[];
}

export { detectIndustryPreset, getIndustryPresetMeta, getRecommendedStackForClient } from './industryPresets';
export type { IndustryPresetId } from './industryPresets';

export function getCachedTavilySources(client: Client, thesis?: PositioningThesis): DiscoveredSource[] {
  const keywords = buildProfileKeywords(client, thesis);
  const signature = profileSignature(client.id, keywords, thesis);
  const cached = loadTavilyCache(client.id);
  if (!cached || cached.profileSignature !== signature) return [];
  return cached.sources;
}

export async function fetchTavilyAvailability(): Promise<boolean> {
  const { fetchTavilyAvailable } = await import('./sourceApi');
  return fetchTavilyAvailable();
}

export async function searchTavilyWeb(
  query: string,
  options?: { max_results?: number; time_range?: 'day' | 'week' | 'month' | 'year'; topic?: 'news' | 'general' | 'finance' }
): Promise<{ results: TavilySearchResult[]; error?: string }> {
  const { tavilySearchUrl, sourceApiAuthHeaders } = await import('./sourceApi');
  const response = await fetch(tavilySearchUrl(), {
    method: 'POST',
    headers: await sourceApiAuthHeaders(true),
    body: JSON.stringify({
      query: query.slice(0, 400),
      topic: options?.topic || 'news',
      max_results: options?.max_results ?? 8,
      time_range: options?.time_range ?? 'month',
      search_depth: 'basic',
    }),
  });

  const data = (await response.json()) as { results?: TavilySearchResult[]; error?: string };
  if (!response.ok) {
    if (data.error === 'TAVILY_KEY_MISSING') return { results: [], error: 'TAVILY_KEY_MISSING' };
    return { results: [], error: data.error || 'TAVILY_FAILED' };
  }
  return { results: data.results || [] };
}

/** Busca medios y feeds en internet vía Tavily (cache 1 h por perfil). */
export async function discoverViaTavily(
  client: Client,
  thesis?: PositioningThesis,
  options?: { force?: boolean }
): Promise<{ sources: DiscoveredSource[]; fromCache: boolean; error?: string }> {
  const keywords = buildProfileKeywords(client, thesis);
  const signature = profileSignature(client.id, keywords, thesis);
  const cached = loadTavilyCache(client.id);

  if (
    !options?.force &&
    cached &&
    cached.profileSignature === signature &&
    Date.now() - new Date(cached.scannedAt).getTime() < TAVILY_CACHE_TTL_MS
  ) {
    return { sources: cached.sources, fromCache: true };
  }

  const query = buildTavilySearchQuery(client, thesis, keywords);
  const { tavilySearchUrl, sourceApiAuthHeaders } = await import('./sourceApi');
  const response = await fetch(tavilySearchUrl(), {
    method: 'POST',
    headers: await sourceApiAuthHeaders(true),
    body: JSON.stringify({
      query,
      topic: 'news',
      max_results: 10,
      time_range: 'week',
      search_depth: 'basic',
    }),
  });

  const data = (await response.json()) as {
    results?: TavilySearchResult[];
    error?: string;
  };

  if (!response.ok) {
    if (data.error === 'TAVILY_KEY_MISSING') {
      return { sources: [], fromCache: false, error: 'TAVILY_KEY_MISSING' };
    }
    return { sources: [], fromCache: false, error: data.error || 'TAVILY_FAILED' };
  }

  const sources = mapTavilyResultsToSources(data.results || [], keywords);
  saveTavilyCache(client.id, {
    profileSignature: signature,
    scannedAt: new Date().toISOString(),
    sources,
  });

  return { sources, fromCache: false };
}

export function clearTavilyCache(clientId?: string): void {
  try {
    if (!clientId) {
      localStorage.removeItem(TAVILY_CACHE_KEY);
      return;
    }
    const raw = localStorage.getItem(TAVILY_CACHE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, TavilyCacheEntry>;
    delete map[clientId];
    localStorage.setItem(TAVILY_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
