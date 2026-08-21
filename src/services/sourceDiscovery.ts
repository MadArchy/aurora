import { dbService } from './db';
import { Client, PositioningThesis, Source } from '../types';

export type DiscoveryLocale = 'EN_US' | 'ES_MX';

export interface DiscoveredSource {
  /** Clave estable para detectar si ya está registrada. */
  key: string;
  name: string;
  type: Source['type'];
  url: string;
  locale: DiscoveryLocale | 'ANY';
  /** Por qué el sistema la propone, en lenguaje del manager. */
  rationale: string;
  /** Consulta generada desde el perfil vs. feed oficial vs. Tavily vs. social/YouTube/académico. */
  kind: 'QUERY' | 'OFFICIAL' | 'TAVILY' | 'SOCIAL' | 'YOUTUBE' | 'ACADEMIC';
}

export interface ProfileKeywords {
  /** Términos núcleo del dominio, en inglés. */
  coreEn: string[];
  /** Términos núcleo del dominio, en español. */
  coreEs: string[];
  /**
   * Tokens sueltos lo bastante específicos como para aceptar un item por sí solos.
   * Necesarios porque frases como "patent law" casi nunca aparecen literales.
   */
  strong: string[];
  /** Términos de contexto (industrias, audiencia). */
  context: string[];
  /** Términos que deben restar puntos si aparecen. */
  negative: string[];
}

const LOCALE_PARAMS: Record<DiscoveryLocale, string> = {
  EN_US: 'hl=en-US&gl=US&ceid=US:en',
  ES_MX: 'hl=es-419&gl=MX&ceid=MX:es',
};

const LOCALE_LABELS: Record<DiscoveryLocale, string> = {
  EN_US: 'EE.UU. / inglés',
  ES_MX: 'México / español',
};

/**
 * Glosario bilingüe por concepto. Se activa cuando el dominio o los temas del
 * dossier mencionan el concepto, y aporta los términos de búsqueda en ambos idiomas.
 */
const CONCEPT_GLOSSARY: Array<{
  match: RegExp;
  en: string[];
  es: string[];
  tokens: string[];
}> = [
  {
    match: /patent|patente/i,
    en: ['patent law', 'patent prosecution', 'freedom to operate'],
    es: ['patentes', 'propiedad industrial'],
    tokens: ['patent', 'patents', 'patente', 'patentes', 'uspto', 'patentability'],
  },
  {
    match: /propiedad intelectual|intellectual property|\bip\b/i,
    en: ['intellectual property', 'trade secrets'],
    es: ['propiedad intelectual', 'secretos comerciales'],
    tokens: ['intellectual', 'trademark', 'copyright', 'infringement', 'intelectual', 'marcas', 'secret', 'secrets', 'secreto', 'secretos', 'invention', 'inventor'],
  },
  {
    match: /adopc|adoption/i,
    en: ['AI adoption', 'AI readiness'],
    es: ['adopción de inteligencia artificial'],
    tokens: ['adoption', 'readiness', 'adopcion'],
  },
  {
    match: /gobernanza|governance|compliance|cumplimiento/i,
    en: ['AI governance', 'AI policy', 'NIST AI RMF'],
    es: ['gobernanza de inteligencia artificial', 'cumplimiento normativo IA'],
    tokens: ['governance', 'compliance', 'gobernanza', 'cumplimiento'],
  },
  {
    match: /ciberseguridad|cybersecurity|seguridad/i,
    en: ['cybersecurity regulation', 'data privacy'],
    es: ['ciberseguridad', 'privacidad de datos'],
    tokens: ['cybersecurity', 'ciberseguridad', 'privacy', 'privacidad'],
  },
  {
    match: /inteligencia artificial|artificial intelligence|\bia\b|\bai\b|machine learning/i,
    en: ['artificial intelligence', 'generative AI'],
    es: ['inteligencia artificial', 'IA generativa'],
    // 'ai' e 'ia' se comparan como palabra completa, así que no matchean dentro de otras palabras.
    tokens: ['artificial', 'chatgpt', 'copilot', 'algorithm', 'algoritmo', 'inteligencia', 'ai', 'ia', 'llm'],
  },
  {
    match: /regulaci|regulation|regulatorio|normativ/i,
    en: ['AI regulation', 'AI executive order'],
    es: ['regulación de IA', 'marco regulatorio IA'],
    tokens: ['regulation', 'regulatory', 'regulacion', 'normativa'],
  },
  {
    match: /semiconduct/i,
    en: ['semiconductor patents'],
    es: ['semiconductores'],
    tokens: ['semiconductor', 'semiconductores'],
  },
  {
    match: /dispositivo|medical device|salud|health/i,
    en: ['medical device patents', 'health AI regulation'],
    es: ['dispositivos médicos', 'regulación sanitaria IA'],
    tokens: ['biotech', 'biotecnologia'],
  },
  {
    match: /legaltech|profesión jurídica|legal profession|abogad|attorney|law firm/i,
    en: ['legal industry AI', 'law firm AI policy'],
    es: ['abogados inteligencia artificial', 'despachos IA'],
    tokens: ['legaltech', 'litigation', 'litigio', 'abogados', 'attorneys'],
  },
];

/** Feeds oficiales cuya disponibilidad fue verificada contra el proveedor real. */
const VERIFIED_OFFICIAL_FEEDS: Array<{
  key: string;
  name: string;
  type: Source['type'];
  url: string;
  match: RegExp;
  rationale: string;
}> = [
  {
    key: 'official_uspto',
    name: 'USPTO — noticias y avisos oficiales',
    type: 'REGULATORY',
    url: 'https://www.uspto.gov/rss.xml',
    match: /patent|patente|propiedad intelectual|intellectual property|\bip\b|marca/i,
    rationale: 'Fuente primaria de la oficina de patentes de EE.UU.',
  },
  {
    key: 'official_nist',
    name: 'NIST — noticias (IA, estándares y ciberseguridad)',
    type: 'REGULATORY',
    url: 'https://www.nist.gov/news-events/news/rss.xml',
    match: /inteligencia artificial|artificial intelligence|\bai\b|\bia\b|ciberseguridad|cybersecurity|nist|gobernanza|governance|est[áa]ndar/i,
    rationale: 'Organismo que publica el AI Risk Management Framework.',
  },
  {
    key: 'official_ipwatchdog',
    name: 'IPWatchdog — patentes, IP y práctica legal',
    type: 'MEDIA',
    url: 'https://ipwatchdog.com/feed/',
    match: /patent|patente|propiedad intelectual|intellectual property|\bip\b|litigio/i,
    rationale: 'Prensa especializada en patentes y práctica de IP.',
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

/**
 * Deriva los términos de búsqueda del cliente combinando tesis, perfil maestro
 * y dossier. El dossier tiene prioridad porque es la fuente de verdad curada.
 */
export function buildProfileKeywords(client: Client, thesis?: PositioningThesis): ProfileKeywords {
  const profile = dbService.getMasterProfile(client.id);
  const dossier = dbService.getMasterDossier(client.id);

  const conceptSource = normalize(
    [
      thesis?.domain,
      thesis?.title,
      thesis?.expertIdentity,
      client.profession,
      ...(dossier?.topicsToOwn || []),
      ...(profile?.career.industries || []),
    ]
      .filter(Boolean)
      .join(' ')
  );

  const coreEn: string[] = [];
  const coreEs: string[] = [];
  const strong: string[] = [];
  for (const concept of CONCEPT_GLOSSARY) {
    if (concept.match.test(conceptSource)) {
      coreEn.push(...concept.en);
      coreEs.push(...concept.es);
      strong.push(...concept.tokens);
    }
  }

  if (!coreEn.length && client.profession) coreEn.push(client.profession);
  if (!coreEs.length && thesis?.domain) coreEs.push(thesis.domain);

  const context = uniq([
    ...(profile?.audience.targetIndustries || []),
    ...(dossier?.identityDimensions || []).map((d) => d.label),
  ]);

  const negative = uniq([
    ...(profile?.voicePreferences.topicsToAvoid || []),
    ...(dossier?.topicsToAvoid || []),
  ]);

  return {
    coreEn: uniq(coreEn).slice(0, 8),
    coreEs: uniq(coreEs).slice(0, 8),
    strong: uniq(strong),
    context: context.slice(0, 8),
    negative,
  };
}

function googleNewsUrl(query: string, locale: DiscoveryLocale): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${LOCALE_PARAMS[locale]}`;
}

/** URL de feed Google News para una consulta y locale concretos. */
export function buildGoogleNewsFeedUrl(query: string, locale: DiscoveryLocale): string {
  return googleNewsUrl(query, locale);
}

/** Clave estable para comparar si una fuente descubierta ya está registrada. */
export function normalizeSourceUrl(url: string): string {
  if (url.startsWith('youtube-search:')) {
    return url.toLowerCase();
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('news.google.com')) {
      const q = parsed.searchParams.get('q') || '';
      return `news.google.com|${normalize(q)}`;
    }
    if (parsed.hostname.includes('youtube.com') && parsed.pathname.includes('/feeds/videos.xml')) {
      const channel = parsed.searchParams.get('channel_id') || parsed.searchParams.get('playlist_id') || '';
      return `youtube.com|feed|${channel.toLowerCase()}`;
    }
    if (parsed.hostname.includes('arxiv.org')) {
      return `arxiv.org|${(parsed.searchParams.get('search_query') || '').toLowerCase()}`;
    }
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}`.toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase().split('&hl=')[0];
  }
}

/** Agrupa términos en consultas booleanas de tamaño manejable. */
function buildQueries(terms: string[], anchor: string | undefined, locale: DiscoveryLocale): Array<{ label: string; query: string }> {
  if (!terms.length) return [];
  const queries: Array<{ label: string; query: string }> = [];
  const quoted = terms.map((t) => (t.includes(' ') ? `"${t}"` : t));

  for (let i = 0; i < quoted.length; i += 3) {
    const group = quoted.slice(i, i + 3);
    if (!group.length) continue;
    const anchored = anchor && i > 0 ? `(${group.join(' OR ')}) AND ${anchor}` : group.join(' OR ');
    queries.push({
      label: terms.slice(i, i + 3).join(' · '),
      query: `${anchored} when:14d`,
    });
  }

  return queries.slice(0, locale === 'EN_US' ? 3 : 2);
}

/**
 * Propone fuentes reales derivadas del perfil: consultas de noticias en ambos
 * idiomas más los feeds oficiales relevantes al dominio.
 */
export function discoverSources(client: Client, thesis?: PositioningThesis): DiscoveredSource[] {
  const keywords = buildProfileKeywords(client, thesis);
  const discovered: DiscoveredSource[] = [];

  const anchorEn = keywords.coreEn.find((t) => /intellectual property|patent/i.test(t));
  const anchorEs = keywords.coreEs.find((t) => /propiedad intelectual|patente/i.test(t));

  for (const { label, query } of buildQueries(keywords.coreEn, anchorEn ? `"${anchorEn}"` : undefined, 'EN_US')) {
    discovered.push({
      key: `query_en_${normalize(label).replace(/[^a-z0-9]+/g, '_')}`,
      name: `Noticias EE.UU. — ${label}`,
      type: 'RSS',
      url: googleNewsUrl(query, 'EN_US'),
      locale: 'EN_US',
      rationale: `Consulta generada desde la tesis y el dossier · ${LOCALE_LABELS.EN_US}`,
      kind: 'QUERY',
    });
  }

  for (const { label, query } of buildQueries(keywords.coreEs, anchorEs ? `"${anchorEs}"` : undefined, 'ES_MX')) {
    discovered.push({
      key: `query_es_${normalize(label).replace(/[^a-z0-9]+/g, '_')}`,
      name: `Noticias México — ${label}`,
      type: 'RSS',
      url: googleNewsUrl(query, 'ES_MX'),
      locale: 'ES_MX',
      rationale: `Consulta generada desde la tesis y el dossier · ${LOCALE_LABELS.ES_MX}`,
      kind: 'QUERY',
    });
  }

  const domainText = normalize(
    [thesis?.domain, thesis?.title, client.profession, ...(dbService.getMasterDossier(client.id)?.topicsToOwn || [])]
      .filter(Boolean)
      .join(' ')
  );

  for (const feed of VERIFIED_OFFICIAL_FEEDS) {
    if (!feed.match.test(domainText)) continue;
    discovered.push({
      key: feed.key,
      name: feed.name,
      type: feed.type,
      url: feed.url,
      locale: 'ANY',
      rationale: feed.rationale,
      kind: 'OFFICIAL',
    });
  }

  if (keywords.coreEn.length) {
    const arxivQuery = keywords.coreEn
      .slice(0, 3)
      .map((t) => `all:${t.includes(' ') ? `"${t}"` : t}`)
      .join('+AND+');
    discovered.push({
      key: 'official_arxiv',
      name: 'arXiv — preprints del dominio',
      type: 'ACADEMIC',
      url: `https://export.arxiv.org/api/query?search_query=${arxivQuery}&sortBy=submittedDate&sortOrder=descending&max_results=25`,
      locale: 'EN_US',
      rationale: 'Investigación reciente para sostener afirmaciones con evidencia.',
      kind: 'OFFICIAL',
    });
  }

  return discovered;
}

/** Fuentes propuestas que el cliente todavía no tiene registradas. */
export function pendingDiscoveries(client: Client, thesis?: PositioningThesis): DiscoveredSource[] {
  const existing = new Set(
    dbService.getSourcesByClient(client.id).map((s) => normalizeSourceUrl(s.url || ''))
  );
  return discoverSources(client, thesis).filter((d) => !existing.has(normalizeSourceUrl(d.url)));
}
