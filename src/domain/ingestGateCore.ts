/**
 * Reglas de puerta de ingesta por canal.
 * Mantener alineado entre src/services/ingestFilter.ts y functions/src/lib/ingestGate.ts.
 */

export type GateChannel = 'VIDEO' | 'SOCIAL' | 'ACADEMIC' | 'REGULATORY' | 'DEFAULT';

export function resolveGateChannel(sourceType: string, sourceUrl?: string): GateChannel {
  const url = (sourceUrl || '').toLowerCase();
  if (sourceType === 'VIDEO' || url.startsWith('youtube-search:') || url.includes('youtube.com/feeds/videos.xml')) {
    return 'VIDEO';
  }
  if (sourceType === 'SOCIAL') return 'SOCIAL';
  if (sourceType === 'ACADEMIC' || url.includes('arxiv.org') || url.includes('pubmed') || url.includes('ssrn.com')) {
    return 'ACADEMIC';
  }
  if (sourceType === 'REGULATORY') return 'REGULATORY';
  return 'DEFAULT';
}

export interface ChannelMatchInput {
  channel: GateChannel;
  matchedPhrases: string[];
  matchedStrong: string[];
  matchedContext: string[];
  titleLength: number;
}

export interface ChannelGateDecision {
  accepted: boolean;
  reason: string;
  matchedTerms: string[];
}

/**
 * Aplica umbrales distintos por canal después del filtrado negativo.
 * null = usar la lógica genérica del caller.
 */
export function decideByChannel(input: ChannelMatchInput): ChannelGateDecision | null {
  const { channel, matchedPhrases, matchedStrong, matchedContext, titleLength } = input;

  if (channel === 'VIDEO') {
    if (titleLength < 16) {
      return { accepted: false, reason: 'Video: título demasiado corto', matchedTerms: [] };
    }
    if (matchedPhrases.length || matchedStrong.length) {
      return {
        accepted: true,
        reason: matchedPhrases.length
          ? `Video alineado al dominio: ${matchedPhrases[0]}`
          : `Video con término clave: ${matchedStrong[0]}`,
        matchedTerms: [...matchedPhrases, ...matchedStrong],
      };
    }
    return { accepted: false, reason: 'Video sin match fuerte de perfil (se exige frase o token clave)', matchedTerms: [] };
  }

  if (channel === 'SOCIAL') {
    if (matchedPhrases.length || matchedStrong.length >= 2) {
      return {
        accepted: true,
        reason: matchedPhrases.length
          ? `Social alineado: ${matchedPhrases[0]}`
          : `Social con tokens clave: ${matchedStrong.slice(0, 2).join(', ')}`,
        matchedTerms: [...matchedPhrases, ...matchedStrong],
      };
    }
    if (matchedStrong.length === 1 && matchedContext.length >= 1) {
      return {
        accepted: true,
        reason: `Social: token ${matchedStrong[0]} + contexto`,
        matchedTerms: [...matchedStrong, ...matchedContext],
      };
    }
    return { accepted: false, reason: 'Social demasiado genérico (se exige match fuerte)', matchedTerms: matchedContext };
  }

  if (channel === 'ACADEMIC') {
    if (matchedPhrases.length || matchedStrong.length || matchedContext.length >= 1) {
      return {
        accepted: true,
        reason: matchedPhrases.length
          ? `Académico: ${matchedPhrases[0]}`
          : matchedStrong.length
            ? `Académico token: ${matchedStrong[0]}`
            : `Académico contexto: ${matchedContext[0]}`,
        matchedTerms: [...matchedPhrases, ...matchedStrong, ...matchedContext],
      };
    }
    return { accepted: false, reason: 'Académico sin relación con el dominio', matchedTerms: [] };
  }

  if (channel === 'REGULATORY') {
    // Un poco más permisivo: un token fuerte basta en feeds oficiales.
    if (matchedPhrases.length || matchedStrong.length || matchedContext.length >= 1) {
      return {
        accepted: true,
        reason: matchedPhrases[0] || matchedStrong[0] || `Regulatorio contexto: ${matchedContext[0]}`,
        matchedTerms: [...matchedPhrases, ...matchedStrong, ...matchedContext],
      };
    }
    return { accepted: false, reason: 'Regulatorio sin match de perfil', matchedTerms: [] };
  }

  return null;
}
