import { Source, SourceQuality } from '../types';
import { ProfileKeywords } from './sourceDiscovery';
import { decideByChannel, resolveGateChannel } from '../domain/ingestGateCore';

export interface FeedItem {
  title: string;
  link?: string;
  snippet?: string;
  pubDate?: string;
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

/** Hosts cuya autoridad se conoce y no depende del contenido del item. */
const HIGH_AUTHORITY = /(^|\.)(uspto\.gov|nist\.gov|federalregister\.gov|europa\.eu|arxiv\.org|ncbi\.nlm\.nih\.gov|pubmed|ssrn\.com|texasbar\.com|supremecourt\.gov|youtube\.com)$/i;
const MEDIUM_AUTHORITY = /(^|\.)(ipwatchdog\.com|law\.com|reuters\.com|bloomberg\.com|wsj\.com|ft\.com|nytimes\.com|linkedin\.com|\.edu)$/i;

/**
 * Califica la fuente del item. Evita que todo entre como UNASSESSED,
 * que penalizaba el score incluso viniendo de organismos oficiales.
 */
export function assessSourceQuality(source: Source, item: FeedItem): SourceQuality {
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

/**
 * Puerta de entrada al radar: solo pasan items que tocan el dominio del cliente.
 * Umbrales más estrictos en VIDEO/SOCIAL; más permisivos en ACADEMIC/REGULATORY.
 */
export function gateItem(item: FeedItem, keywords: ProfileKeywords, source: Source): GateResult {
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

  const channel = resolveGateChannel(source.type, source.url);
  const channelDecision = decideByChannel({
    channel,
    matchedPhrases,
    matchedStrong,
    matchedContext,
    titleLength: title.length,
  });
  if (channelDecision) return channelDecision;

  // Los feeds de consulta vienen pre-filtrados, pero exigimos al menos un match de perfil.
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
