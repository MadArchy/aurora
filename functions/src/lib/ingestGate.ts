/** Puerta de ingesta server-side (mantener alineado con src/services/ingestFilter.ts). */

export interface FeedItem {
  title: string;
  link?: string;
  snippet?: string;
  pubDate?: string;
}

export interface ProfileKeywords {
  coreEn: string[];
  coreEs: string[];
  strong: string[];
  context: string[];
  negative: string[];
}

export interface SourceLike {
  type: string;
  url?: string;
}

export interface GateResult {
  accepted: boolean;
  reason: string;
  matchedTerms: string[];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const HIGH_AUTHORITY = /(^|\.)(uspto\.gov|nist\.gov|federalregister\.gov|europa\.eu|arxiv\.org|ncbi\.nlm\.nih\.gov|pubmed|ssrn\.com|texasbar\.com|supremecourt\.gov|youtube\.com)$/i;
const MEDIUM_AUTHORITY = /(^|\.)(ipwatchdog\.com|law\.com|reuters\.com|bloomberg\.com|wsj\.com|ft\.com|nytimes\.com|linkedin\.com|\.edu)$/i;

export function assessSourceQuality(source: SourceLike, item: FeedItem): 'HIGH' | 'MEDIUM' | 'LOW' | 'UNASSESSED' {
  const host = (() => {
    try {
      return new URL(item.link || source.url || '').hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();

  if (HIGH_AUTHORITY.test(host)) return 'HIGH';
  if (MEDIUM_AUTHORITY.test(host)) return 'MEDIUM';
  if (source.type === 'REGULATORY' || source.type === 'ACADEMIC') return 'HIGH';
  if (source.type === 'VIDEO') return 'MEDIUM';
  if (source.type === 'SOCIAL') return 'MEDIUM';
  if (source.type === 'MEDIA') return 'MEDIUM';
  if (host.endsWith('.gov') || host.endsWith('.edu')) return 'HIGH';
  return 'MEDIUM';
}

export function gateItem(item: FeedItem, keywords: ProfileKeywords, source: SourceLike): GateResult {
  const title = (item.title || '').trim();
  if (title.length < 12) {
    return { accepted: false, reason: 'Título demasiado corto para evaluar', matchedTerms: [] };
  }

  const haystack = normalize(`${title} ${item.snippet || ''}`);
  const words = new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean));

  const matchedPhrases = [...keywords.coreEn, ...keywords.coreEs].filter((term) => haystack.includes(normalize(term)));
  const matchedStrong = keywords.strong.filter((token) => words.has(normalize(token)));
  const matchedContext = keywords.context.filter((term) => haystack.includes(normalize(term)));

  const matchedNegative = (keywords.negative || []).filter((term) => {
    const n = normalize(term);
    return n.length >= 4 && haystack.includes(n);
  });
  if (matchedNegative.length) {
    return {
      accepted: false,
      reason: `Tema a evitar según perfil: ${matchedNegative[0]}`,
      matchedTerms: matchedNegative,
    };
  }

  if ((source.url || '').includes('news.google.com/rss/search')) {
    if (matchedPhrases.length || matchedStrong.length) {
      return {
        accepted: true,
        reason: 'Consulta + match de perfil',
        matchedTerms: [...matchedPhrases, ...matchedStrong],
      };
    }
    return { accepted: false, reason: 'Consulta sin match de perfil', matchedTerms: [] };
  }

  if (matchedPhrases.length) {
    return { accepted: true, reason: `Coincide con el dominio: ${matchedPhrases[0]}`, matchedTerms: matchedPhrases };
  }
  if (matchedStrong.length) {
    return { accepted: true, reason: `Término clave del perfil: ${matchedStrong[0]}`, matchedTerms: matchedStrong };
  }
  if (matchedContext.length >= 2) {
    return { accepted: true, reason: 'Coincide con industrias objetivo', matchedTerms: matchedContext };
  }

  return { accepted: false, reason: 'Sin relación con la tesis ni las industrias objetivo', matchedTerms: [] };
}

export function signalFingerprint(title: string, sourceUrl?: string): string {
  const canonical = `${(sourceUrl || '').toLowerCase().split(/[?#]/)[0]}|${title.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
  return `fp_${canonical.substring(0, 64)}`;
}

export function newSignalId(): string {
  return `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
