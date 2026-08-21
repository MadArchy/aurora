import type { PositioningThesis, ResearchEvidenceItem, Signal } from '../types';
import type { ProfileKeywords } from '../services/sourceDiscovery';

const TRUSTED_EVIDENCE = /(^|\.)((uspto|nist)\.gov|reuters|bloomberg|law\.com|ft\.com|wsj|arxiv|ncbi\.nlm\.nih|ssrn|youtube|\.edu)/i;

export function buildResearchQuery(
  signal: Signal,
  thesis: PositioningThesis,
  keywords: ProfileKeywords
): string {
  const parts = [
    signal.title,
    thesis.domain,
    thesis.title,
    ...keywords.coreEn.slice(0, 2),
    ...keywords.strong.slice(0, 2),
    'report data evidence',
  ];
  return parts.filter(Boolean).join(' ').slice(0, 400);
}

export function synthesizeResearchSummary(
  signal: Signal,
  thesis: PositioningThesis,
  evidence: ResearchEvidenceItem[]
): { summary: string; suggestedNextStep: 'SAVE' | 'MONITOR' | 'SHORT_POST' } {
  if (!evidence.length) {
    return {
      summary: `Sin referencias claras para «${signal.title.slice(0, 80)}». Amplía proof points en la tesis o busca manualmente antes de publicar.`,
      suggestedNextStep: 'MONITOR',
    };
  }

  const trustedCount = evidence.filter((item) => {
    try {
      return TRUSTED_EVIDENCE.test(new URL(item.url).hostname);
    } catch {
      return false;
    }
  }).length;

  if (trustedCount >= 2) {
    return {
      summary: `${trustedCount} fuente(s) de alta autoridad respaldan el ángulo «${signal.title.slice(0, 70)}» dentro de «${thesis.title}».`,
      suggestedNextStep: 'SHORT_POST',
    };
  }

  if (evidence.length >= 3) {
    return {
      summary: `${evidence.length} referencias web relacionadas; valida citas antes de convertir en contenido.`,
      suggestedNextStep: 'SAVE',
    };
  }

  return {
    summary: `Evidencia parcial (${evidence.length} hit). Útil para monitorear, insuficiente para afirmación fuerte.`,
    suggestedNextStep: 'MONITOR',
  };
}
