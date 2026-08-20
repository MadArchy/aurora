import { PositioningThesis, Signal, SourceQuality, StrategicScoreResult } from '../types';

/**
 * Contexto opcional derivado del perfil y del dossier. Permite puntuar contenido
 * en un idioma distinto al de la tesis, que era la causa de scores artificialmente bajos.
 */
export interface ScoringContext {
  /** Términos del dominio en ambos idiomas. */
  bilingualTerms?: string[];
  /** Temas que el cliente debe dominar, según el dossier. */
  ownedTopics?: string[];
  /** Framings a evitar: restan puntos, no descartan. */
  avoidedFramings?: string[];
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

/** Minúsculas sin acentos: "regulación" y "regulacion" deben coincidir. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 3);
}

function tokenOverlap(a: string, b: string): number {
  const at = new Set(tokenize(a));
  const bt = tokenize(b);
  if (!bt.length) return 0.4;
  const hits = bt.filter((t) => at.has(t)).length;
  return Math.min(1, hits / Math.max(4, Math.min(bt.length, 12)));
}

/** Proporción de frases del listado que aparecen literalmente en el texto. */
function phraseHits(phrases: string[] | undefined, haystackNormalized: string): number {
  if (!phrases?.length) return 0;
  const hits = phrases.filter((p) => {
    const needle = normalize(p);
    return needle.length > 3 && haystackNormalized.includes(needle);
  }).length;
  return Math.min(1, hits / Math.max(2, Math.min(phrases.length, 5)));
}

function sourceQualityScore(quality?: SourceQuality): number {
  switch (quality) {
    case 'HIGH': return 1;
    case 'MEDIUM': return 0.7;
    case 'LOW': return 0.25;
    default: return 0.5;
  }
}

export function calculateStrategicScore(
  signal: Signal,
  thesis: PositioningThesis,
  context: ScoringContext = {}
): StrategicScoreResult {
  const haystack = `${signal.title} ${signal.contentSnippet} ${signal.targetDomain || ''}`;
  const normalizedHaystack = normalize(haystack);

  // El match temático toma el mejor de tres señales: solapamiento con la tesis,
  // términos bilingües del perfil y temas propios del dossier.
  const thesisMatch = Math.max(
    0.35,
    tokenOverlap(thesis.domain + ' ' + thesis.title, haystack),
    phraseHits(context.bilingualTerms, normalizedHaystack),
    phraseHits(context.ownedTopics, normalizedHaystack) * 0.9
  );
  const audienceMatch = Math.max(
    0.35,
    tokenOverlap(thesis.targetAudience, haystack),
    phraseHits(context.bilingualTerms, normalizedHaystack) * 0.7
  );
  const timeliness = signal.sourceType === 'REGULATORY' ? 0.95 : signal.sourceType === 'NEWS_API' ? 0.78 : 0.62;
  const authorityFit = Math.min(1, 0.55 + thesis.proofPoints.length * 0.07);
  const differentiation = thesis.differentiator ? 0.72 : 0.48;
  const strategicPotential = thesisMatch * 0.6 + audienceMatch * 0.4;
  const commercialPotential = /cliente|negocio|junta|general counsel|board/i.test(thesis.objective + thesis.targetAudience) ? 0.6 : 0.35;
  const sourceQuality = sourceQualityScore(signal.sourceQuality);

  const factors = {
    thesisMatch,
    audienceMatch,
    timeliness,
    authorityFit,
    differentiation,
    strategicPotential,
    commercialPotential,
    sourceQuality,
  };

  const baseScore100 =
    factors.thesisMatch * 25 +
    factors.audienceMatch * 20 +
    factors.timeliness * 15 +
    factors.authorityFit * 15 +
    factors.differentiation * 10 +
    factors.strategicPotential * 7.5 +
    factors.commercialPotential * 2.5 +
    factors.sourceQuality * 5;

  const lower = normalizedHaystack;
  const evidenceGap = thesis.proofPoints.length < 2 ? 7 : thesis.proofPoints.length < 4 ? 2 : 0;
  const risk = /fraude|sancion|escandalo|ilegal/i.test(lower) ? 15 : /controversia|conflicto/i.test(lower) ? 5 : 0;
  const captured = Date.parse(signal.detectedAt || '') || Date.now();
  const ageHours = (Date.now() - captured) / 36e5;
  const staleness = ageHours > 24 * 21 ? 15 : ageHours > 24 * 7 ? 7 : ageHours > 48 ? 2 : 0;
  const conflict = Math.round(phraseHits(context.avoidedFramings, normalizedHaystack) * 8);
  const penalties = { evidenceGap, risk, staleness, conflict };

  const finalScore = Math.round(clamp(baseScore100 - evidenceGap - risk - staleness - conflict));

  let priorityBand: StrategicScoreResult['priorityBand'] = 'MEDIUM';
  if (finalScore >= 85) priorityBand = 'CRITICAL';
  else if (finalScore >= 70) priorityBand = 'HIGH';
  else if (finalScore < 40) priorityBand = 'LOW';

  let recommendedAction: StrategicScoreResult['recommendedAction'] = 'SAVE';
  if (risk >= 15 && finalScore < 70) recommendedAction = 'NO_ACTION';
  else if (evidenceGap >= 7 || thesis.proofPoints.length === 0) recommendedAction = 'RESEARCH_REQUIRED';
  else if (finalScore >= 85) recommendedAction = 'CREATE_OPPORTUNITY';
  else if (finalScore >= 70) recommendedAction = 'VIDEO';
  else if (finalScore >= 50) recommendedAction = 'SHORT_POST';
  else if (finalScore >= 40) recommendedAction = 'MONITOR';
  else recommendedAction = 'NO_ACTION';

  const restricted = normalize(thesis.complianceRules || '');
  const hardConstraint = restricted && restricted.split(/[,;]/).some((rule) => rule.trim().length > 4 && lower.includes(rule.trim()));
  if (hardConstraint) recommendedAction = 'NO_ACTION';

  return {
    totalScore: finalScore,
    priorityBand,
    factors,
    penalties,
    strategicRationale: `Alineación con tesis "${thesis.title}": match temático ${Math.round(thesisMatch * 100)}%, audiencia ${Math.round(audienceMatch * 100)}%. Penalización de riesgo ${risk}, evidencia ${evidenceGap}${conflict ? `, framing ${conflict}` : ''}.`,
    recommendedAction,
    scoringStatus: 'SCORED',
    calculatedAt: new Date().toISOString(),
  };
}
