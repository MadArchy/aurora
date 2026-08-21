import type { Client, PositioningThesis } from '../types';

export type DiscoveryLocale = 'EN_US' | 'ES_MX';

export interface ProfileKeywords {
  coreEn: string[];
  coreEs: string[];
  strong: string[];
  context: string[];
  negative: string[];
}

export interface DiscoveredSourceLike {
  key: string;
  name: string;
  type: 'RSS' | 'MEDIA' | 'REGULATORY' | 'ACADEMIC';
  url: string;
  locale: DiscoveryLocale | 'ANY';
  rationale: string;
  kind: 'QUERY' | 'OFFICIAL' | 'TAVILY';
}

const LOCALE_PARAMS: Record<DiscoveryLocale, string> = {
  EN_US: 'hl=en-US&gl=US&ceid=US:en',
  ES_MX: 'hl=es-419&gl=MX&ceid=MX:es',
};

function buildGoogleNewsFeedUrl(query: string, locale: DiscoveryLocale): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${LOCALE_PARAMS[locale]}`;
}

export type IndustryPresetId = 'IP_LEGAL' | 'FINTECH' | 'HEALTHCARE' | 'CYBERSECURITY' | 'GENERAL_TECH';

export interface IndustryPresetMeta {
  id: IndustryPresetId;
  label: string;
  /** Medios curados (Google News por sitio). */
  media: Array<{ host: string; name: string; rationale: string }>;
  /** Stack demo documentado en UI. */
  recommendedStack: string[];
}

export const INDUSTRY_PRESETS: Record<IndustryPresetId, IndustryPresetMeta> = {
  IP_LEGAL: {
    id: 'IP_LEGAL',
    label: 'IP · Legal · AI Adoption',
    media: [
      {
        host: 'news.bloomberglaw.com',
        name: 'Bloomberg Law — patentes, IP y práctica legal',
        rationale: 'Litigio de patentes, secretos comerciales y disputas tech.',
      },
      {
        host: 'managingip.com',
        name: 'Managing IP — estrategia y litigio de patentes',
        rationale: 'Prensa especializada en IP internacional.',
      },
      {
        host: 'law.com',
        name: 'Law.com — sector legal en EE.UU.',
        rationale: 'Legaltech y adopción de IA en equipos jurídicos.',
      },
    ],
    recommendedStack: [
      'USPTO — noticias oficiales',
      'NIST — IA y ciberseguridad',
      'IPWatchdog — patentes',
      'Bloomberg Law (Top 3)',
      'Managing IP (Top 3)',
      'Law.com (Top 3)',
    ],
  },
  FINTECH: {
    id: 'FINTECH',
    label: 'Fintech · Pagos · Regulación',
    media: [
      {
        host: 'finextra.com',
        name: 'Finextra — noticias fintech',
        rationale: 'Pagos, open banking y bancos digitales.',
      },
      {
        host: 'americanbanker.com',
        name: 'American Banker — sector bancario',
        rationale: 'Regulación bancaria y transformación digital.',
      },
      {
        host: 'federalreserve.gov',
        name: 'Federal Reserve — comunicados',
        rationale: 'Política monetaria y supervisión financiera.',
      },
    ],
    recommendedStack: ['Finextra', 'American Banker', 'Federal Reserve (Top 3)'],
  },
  HEALTHCARE: {
    id: 'HEALTHCARE',
    label: 'Salud · MedTech · Regulación',
    media: [
      {
        host: 'fda.gov',
        name: 'FDA — comunicados',
        rationale: 'Dispositivos médicos y regulación sanitaria.',
      },
      {
        host: 'healthcareitnews.com',
        name: 'Healthcare IT News',
        rationale: 'IA clínica, interoperabilidad y digital health.',
      },
      {
        host: 'statnews.com',
        name: 'STAT — biotech y salud',
        rationale: 'Investigación y política sanitaria.',
      },
    ],
    recommendedStack: ['FDA', 'Healthcare IT News', 'STAT (Top 3)'],
  },
  CYBERSECURITY: {
    id: 'CYBERSECURITY',
    label: 'Ciberseguridad · Cumplimiento',
    media: [
      {
        host: 'cisa.gov',
        name: 'CISA — alertas y guías',
        rationale: 'Amenazas, incidentes y marco de cumplimiento.',
      },
      {
        host: 'krebsonsecurity.com',
        name: 'Krebs on Security',
        rationale: 'Investigación de fraude y brechas.',
      },
      {
        host: 'therecord.media',
        name: 'The Record — ciberinteligencia',
        rationale: 'APT, ransomware y geopolítica digital.',
      },
    ],
    recommendedStack: ['NIST', 'CISA', 'Krebs / The Record (Top 3)'],
  },
  GENERAL_TECH: {
    id: 'GENERAL_TECH',
    label: 'Tech · IA · Software',
    media: [
      {
        host: 'techcrunch.com',
        name: 'TechCrunch — startups y IA',
        rationale: 'Adopción enterprise y funding del sector.',
      },
      {
        host: 'theverge.com',
        name: 'The Verge — tecnología',
        rationale: 'Producto, política tech y tendencias.',
      },
      {
        host: 'arstechnica.com',
        name: 'Ars Technica — análisis profundo',
        rationale: 'Regulación, ciencia aplicada y software.',
      },
    ],
    recommendedStack: ['Google News (perfil)', 'arXiv', 'TechCrunch · Verge · Ars (Top 3)'],
  },
};

function buildSiteScopedSource(
  hostname: string,
  name: string,
  rationale: string,
  keywords: ProfileKeywords,
  keyPrefix: string
): DiscoveredSourceLike {
  const terms = [...keywords.coreEn.slice(0, 2), ...keywords.strong.slice(0, 2)].filter(Boolean);
  const quotedTerms = terms.map((t) => (t.includes(' ') ? `"${t}"` : t));
  const siteQuery = quotedTerms.length
    ? `site:${hostname} (${quotedTerms.join(' OR ')}) when:14d`
    : `site:${hostname} when:14d`;
  const locale: DiscoveryLocale = /\.mx$|\.es$|eluniversal|reforma|jornada/i.test(hostname)
    ? 'ES_MX'
    : 'EN_US';

  return {
    key: `${keyPrefix}_${hostname.replace(/[^a-z0-9]+/gi, '_')}`,
    name,
    type: 'MEDIA',
    url: buildGoogleNewsFeedUrl(siteQuery, locale),
    locale,
    rationale,
    kind: 'TAVILY',
  };
}

/** Detecta preset de industria desde perfil + tesis + keywords. */
export function detectIndustryPreset(
  client: Client,
  thesis?: PositioningThesis,
  keywords?: ProfileKeywords
): IndustryPresetId {
  const blob = [
    client.profession,
    thesis?.domain,
    thesis?.title,
    thesis?.expertIdentity,
    ...(keywords?.coreEn || []),
    ...(keywords?.coreEs || []),
    ...(keywords?.strong || []),
  ]
    .filter(Boolean)
    .join(' ');

  if (/patent|propiedad intelectual|intellectual property|\bip\b|legaltech|law firm|abogad|attorney|litig/i.test(blob)) {
    return 'IP_LEGAL';
  }
  if (/fintech|banking|payments|open banking|financial|banca|pagos/i.test(blob)) {
    return 'FINTECH';
  }
  if (/health|medical|pharma|biotech|device|salud|dispositivo/i.test(blob)) {
    return 'HEALTHCARE';
  }
  if (/cyber|ciberseguridad|security|cisa|ransomware/i.test(blob)) {
    return 'CYBERSECURITY';
  }
  return 'GENERAL_TECH';
}

export function getIndustryPresetMeta(presetId: IndustryPresetId): IndustryPresetMeta {
  return INDUSTRY_PRESETS[presetId];
}

export function buildCuratedPresetsForIndustry(
  presetId: IndustryPresetId,
  keywords: ProfileKeywords
): DiscoveredSourceLike[] {
  const meta = INDUSTRY_PRESETS[presetId];
  return meta.media.map(({ host, name, rationale }) =>
    buildSiteScopedSource(host, name, rationale, keywords, `curated_${presetId.toLowerCase()}`)
  );
}

export function buildCuratedPresetsForProfile(
  client: Client,
  thesis: PositioningThesis | undefined,
  keywords: ProfileKeywords
): DiscoveredSourceLike[] {
  const presetId = detectIndustryPreset(client, thesis, keywords);
  return buildCuratedPresetsForIndustry(presetId, keywords);
}

export function getRecommendedStackForPreset(presetId: IndustryPresetId): string[] {
  return INDUSTRY_PRESETS[presetId].recommendedStack;
}

export function getRecommendedStackForClient(
  client: Client,
  thesis?: PositioningThesis,
  keywords?: ProfileKeywords
): string[] {
  const presetId = detectIndustryPreset(client, thesis, keywords);
  return getRecommendedStackForPreset(presetId);
}

export function getCuratedIpLegalMedia() {
  return INDUSTRY_PRESETS.IP_LEGAL.media;
}
