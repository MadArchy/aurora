import type { ProfileKeywords } from '../services/sourceDiscovery';
import type { DiscoveredSource, DiscoveryLocale } from '../services/sourceDiscovery';
import { youtubeFeedUrlFromProfileUrl } from './youtubeUrlCore';

export { youtubeFeedUrlFromProfileUrl } from './youtubeUrlCore';

const LOCALE_EN: DiscoveryLocale = 'EN_US';

export interface ExtendedDiscoveryProfile {
  socialLinks?: {
    linkedin?: string;
    youtube?: string;
  };
}

function quoteTerms(terms: string[]): string {
  return terms.map((t) => (t.includes(' ') ? `"${t}"` : t)).join(' OR ');
}

function thesisFallback(keywords: ProfileKeywords): string {
  const t = keywords.coreEn[0] || keywords.coreEs[0] || 'industry news';
  return t.includes(' ') ? `"${t}"` : t;
}

function googleNewsSiteQuery(site: string, keywords: ProfileKeywords): string {
  const terms = quoteTerms([...keywords.coreEn.slice(0, 2), ...keywords.strong.slice(0, 2)]);
  const core = terms || thesisFallback(keywords);
  return `site:${site} (${core}) when:14d`;
}

function buildGoogleNewsFeedUrl(query: string, locale: DiscoveryLocale): string {
  const params = locale === 'EN_US' ? 'hl=en-US&gl=US&ceid=US:en' : 'hl=es-419&gl=MX&ceid=MX:es';
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${params}`;
}

function pubmedRssUrl(keywords: ProfileKeywords): string {
  const term = encodeURIComponent(
    [...keywords.coreEn.slice(0, 2), ...keywords.strong.slice(0, 2)].join(' ') || 'artificial intelligence'
  );
  return `https://pubmed.ncbi.nlm.nih.gov/rss/search/${term}/?limit=20`;
}

/** Fuentes sociales, YouTube y académicas (sin I/O). */
export function buildExtendedSources(
  keywords: ProfileKeywords,
  options?: { profile?: ExtendedDiscoveryProfile; domainBlob?: string }
): DiscoveredSource[] {
  const profile = options?.profile;
  const domainBlob = options?.domainBlob || '';
  const discovered: DiscoveredSource[] = [];

  const youtubeLink = profile?.socialLinks?.youtube;
  if (youtubeLink) {
    const feed = youtubeFeedUrlFromProfileUrl(youtubeLink);
    if (feed) {
      discovered.push({
        key: 'youtube_channel_profile',
        name: 'YouTube — canal del cliente (RSS)',
        type: 'VIDEO',
        url: feed,
        locale: 'ANY',
        rationale: 'Feed oficial del canal registrado en el perfil.',
        kind: 'YOUTUBE',
      });
    }
  }

  discovered.push({
    key: 'youtube_news_domain',
    name: 'YouTube — videos del dominio (Google News)',
    type: 'VIDEO',
    url: buildGoogleNewsFeedUrl(googleNewsSiteQuery('youtube.com', keywords), LOCALE_EN),
    locale: LOCALE_EN,
    rationale: 'Detecta videos y canales relevantes publicados en YouTube.',
    kind: 'YOUTUBE',
  });

  if (profile?.socialLinks?.linkedin) {
    discovered.push({
      key: 'social_linkedin_profile',
      name: 'LinkedIn — publicaciones del sector',
      type: 'SOCIAL',
      url: buildGoogleNewsFeedUrl(googleNewsSiteQuery('linkedin.com', keywords), LOCALE_EN),
      locale: LOCALE_EN,
      rationale: 'Monitorea artículos y posts indexados desde LinkedIn.',
      kind: 'SOCIAL',
    });
  }

  for (const platform of [
    { site: 'linkedin.com', label: 'LinkedIn — conversación del dominio', key: 'social_linkedin' },
    { site: 'x.com', label: 'X (Twitter) — conversación del dominio', key: 'social_x' },
  ] as const) {
    if (platform.key === 'social_linkedin' && profile?.socialLinks?.linkedin) continue;
    discovered.push({
      key: platform.key,
      name: platform.label,
      type: 'SOCIAL',
      url: buildGoogleNewsFeedUrl(googleNewsSiteQuery(platform.site, keywords), LOCALE_EN),
      locale: LOCALE_EN,
      rationale: `Radar social vía noticias indexadas en ${platform.site}.`,
      kind: 'SOCIAL',
    });
  }

  if (keywords.coreEn.length) {
    const arxivQuery = keywords.coreEn
      .slice(0, 3)
      .map((t) => `all:${t.includes(' ') ? `"${t}"` : t}`)
      .join('+AND+');
    discovered.push({
      key: 'academic_arxiv_extended',
      name: 'arXiv — preprints científicos',
      type: 'ACADEMIC',
      url: `https://export.arxiv.org/api/query?search_query=${arxivQuery}&sortBy=submittedDate&sortOrder=descending&max_results=25`,
      locale: LOCALE_EN,
      rationale: 'Artículos científicos recientes para respaldar claims técnicos.',
      kind: 'ACADEMIC',
    });
  }

  if (/health|medical|pharma|biotech|salud|dispositivo/i.test(domainBlob)) {
    discovered.push({
      key: 'academic_pubmed',
      name: 'PubMed — literatura biomédica',
      type: 'ACADEMIC',
      url: pubmedRssUrl(keywords),
      locale: LOCALE_EN,
      rationale: 'Literatura revisada por pares en salud y life sciences (NIH).',
      kind: 'ACADEMIC',
    });
  }

  discovered.push({
    key: 'academic_ssrn',
    name: 'SSRN — working papers',
    type: 'ACADEMIC',
    url: buildGoogleNewsFeedUrl(googleNewsSiteQuery('papers.ssrn.com', keywords), LOCALE_EN),
    locale: LOCALE_EN,
    rationale: 'Preprints en derecho, economía y tecnología.',
    kind: 'ACADEMIC',
  });

  discovered.push({
    key: 'academic_edu',
    name: 'Universidades (.edu) — investigación',
    type: 'ACADEMIC',
    url: buildGoogleNewsFeedUrl(
      `site:.edu (${quoteTerms(keywords.coreEn.slice(0, 3)) || thesisFallback(keywords)}) when:14d`,
      LOCALE_EN
    ),
    locale: LOCALE_EN,
    rationale: 'Noticias e investigación en dominios académicos.',
    kind: 'ACADEMIC',
  });

  discovered.push({
    key: 'academic_scholar',
    name: 'Google Scholar — publicaciones indexadas',
    type: 'ACADEMIC',
    url: buildGoogleNewsFeedUrl(
      `site:scholar.google.com (${quoteTerms(keywords.coreEn.slice(0, 2)) || thesisFallback(keywords)}) when:14d`,
      LOCALE_EN
    ),
    locale: LOCALE_EN,
    rationale: 'Rastro de papers citados en el ecosistema académico.',
    kind: 'ACADEMIC',
  });

  return discovered;
}
