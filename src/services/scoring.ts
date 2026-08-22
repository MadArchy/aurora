import {
  AudienceTier,
  PositioningThesis,
  Signal,
  SourceQuality,
  StrategicScoreResult,
  ThesisAudience,
  ThesisTerritory,
} from '../types';
import { buildScoreBreakdown } from '../domain/scoreExplainCore';
import { matchedTerms, normalizeText, tokenize as sharedTokenize } from '../domain/textMatchCore';
import { normalizeThesis } from '../domain/thesisModelCore';

export { buildScoreBreakdown } from '../domain/scoreExplainCore';
export type { ScoreBreakdownView, ScoreFactorRow, ScorePenaltyRow } from '../domain/scoreExplainCore';

/**
 * Contexto opcional derivado del perfil y del dossier. Permite puntuar contenido
 * en un idioma distinto al de la tesis, que era la causa de scores artificialmente bajos.
 */
export interface ScoringContext {
  /** Términos del dominio en ambos idiomas. */
  bilingualTerms?: string[];
  /** Temas que el cliente debe dominar, desde el dossier. */
  ownedTopics?: string[];
  /** Framings a evitar: restan puntos, no descartan. */
  avoidedFramings?: string[];
  /**
   * Resultado de `computeWhyNow`. Cuando está presente sustituye a la heurística
   * por tipo de fuente en el factor `timeliness`.
   */
  whyNow?: { score: number; reason: string };
  /**
   * Authority Score 0-100 de la tesis (Evidence Vault). Cuando está presente
   * sustituye el proxy basado en número de proof points.
   */
  authorityScore?: number;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

/** Minúsculas sin acentos: "regulación" y "regulacion" deben coincidir. */
function normalize(text: string): string {
  return normalizeText(text);
}

function tokenize(text: string): string[] {
  return sharedTokenize(text);
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

/** Una audiencia comercial vale más que una de amplificación con el mismo peso. */
const TIER_MULTIPLIER: Record<AudienceTier, number> = {
  COMMERCIAL: 1,
  INFLUENCE: 0.85,
  AMPLIFICATION: 0.7,
};

/**
 * Fracción del vocabulario de un bloque que aparece en la señal. A diferencia de
 * `tokenOverlap`, mide cobertura del concepto y no del texto de la señal.
 */
function conceptHit(haystack: string, name: string, keywords: string[]): number {
  const terms = [name, ...keywords].filter((term) => term && term.trim().length > 2);
  if (!terms.length) return 0;
  return matchedTerms(haystack, terms).length / terms.length;
}

/**
 * Mejor territorio alcanzado, escalado por su peso: una señal que solo toca un
 * territorio marginal no puede puntuar como si tocara el núcleo de la tesis.
 */
function bestTerritory(
  territories: ThesisTerritory[],
  haystack: string
): { score: number; name?: string } {
  let best = { score: 0, name: undefined as string | undefined };
  for (const territory of territories) {
    const hit = conceptHit(haystack, territory.name, territory.keywords);
    const scaled = hit * (Math.max(0, Math.min(100, territory.weight)) / 100);
    if (scaled > best.score) best = { score: scaled, name: territory.name };
  }
  return best;
}

function bestAudience(
  audiences: ThesisAudience[],
  haystack: string
): { score: number; name?: string } {
  let best = { score: 0, name: undefined as string | undefined };
  for (const audience of audiences) {
    const hit = conceptHit(haystack, audience.name, audience.keywords);
    const scaled =
      hit * (Math.max(0, Math.min(100, audience.weight)) / 100) * TIER_MULTIPLIER[audience.tier];
    if (scaled > best.score) best = { score: scaled, name: audience.name };
  }
  return best;
}

export function calculateStrategicScore(
  signal: Signal,
  thesis: PositioningThesis,
  context: ScoringContext = {}
): StrategicScoreResult {
  const haystack = `${signal.title} ${signal.contentSnippet} ${signal.targetDomain || ''}`;
  const normalizedHaystack = normalize(haystack);

  // Estructura declarada o derivada del texto libre: mismo camino para legacy y nuevo.
  const structured = normalizeThesis(thesis);
  const territories = structured.territories.length ? structured.territories : null;
  const audiences = structured.audiences.length ? structured.audiences : null;
  const businessObjective = structured.objectives.find((o) => o.kind === 'BUSINESS');

  const territoryMatch = territories ? bestTerritory(territories, haystack) : null;
  const audienceHit = audiences ? bestAudience(audiences, haystack) : null;

  // El match temático toma el mejor de tres señales: solapamiento con la tesis,
  // términos bilingües del perfil y temas propios del dossier.
  const thesisMatch = Math.max(
    0.35,
    territoryMatch ? territoryMatch.score : tokenOverlap(thesis.domain + ' ' + thesis.title, haystack),
    phraseHits(context.bilingualTerms, normalizedHaystack),
    phraseHits(context.ownedTopics, normalizedHaystack) * 0.9
  );
  const audienceMatch = Math.max(
    0.35,
    audienceHit ? audienceHit.score : tokenOverlap(thesis.targetAudience, haystack),
    phraseHits(context.bilingualTerms, normalizedHaystack) * 0.7
  );
  const timeliness = context.whyNow
    ? clamp(context.whyNow.score, 0, 1)
    : signal.sourceType === 'REGULATORY' ? 0.95 : signal.sourceType === 'NEWS_API' ? 0.78 : 0.62;
  const authorityFit =
    typeof context.authorityScore === 'number'
      ? clamp(context.authorityScore / 100, 0, 1)
      : Math.min(1, 0.55 + thesis.proofPoints.length * 0.07);
  const differentiation = thesis.differentiator ? 0.72 : 0.48;
  const strategicPotential = thesisMatch * 0.6 + audienceMatch * 0.4;
  const commercialPotential = businessObjective
    ? 0.3 + (Math.max(0, Math.min(100, businessObjective.weight)) / 100) * 0.6
    : /cliente|negocio|junta|general counsel|board/i.test(thesis.objective + thesis.targetAudience) ? 0.6 : 0.35;
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
  const softAvoid = [
    ...(context.avoidedFramings || []),
    ...structured.limits.softAvoid,
    ...(structured.voiceProfile.avoid || []),
  ];
  const conflict = Math.round(phraseHits(softAvoid, normalizedHaystack) * 8);
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

  // Los límites duros declarados (o derivados) sustituyen al split por comas.
  const hardBlocks = structured.limits.hardBlocks.length
    ? structured.limits.hardBlocks
    : normalize(thesis.complianceRules || '')
        .split(/[,;]/)
        .map((rule) => rule.trim())
        .filter((rule) => rule.length > 4);
  const blockedByLimit = hardBlocks.find((rule) => lower.includes(normalize(rule)));
  if (blockedByLimit) recommendedAction = 'NO_ACTION';

  const matchDetail = territoryMatch?.name
    ? ` Territorio: ${territoryMatch.name}.`
    : '';
  const whyNowDetail = context.whyNow ? ` Why now: ${context.whyNow.reason}.` : '';

  const result: StrategicScoreResult = {
    totalScore: finalScore,
    priorityBand,
    factors,
    penalties,
    strategicRationale: `Alineación con tesis "${thesis.title}": match temático ${Math.round(thesisMatch * 100)}%, audiencia ${Math.round(audienceMatch * 100)}%.${matchDetail}${whyNowDetail} Penalización de riesgo ${risk}, evidencia ${evidenceGap}${conflict ? `, framing ${conflict}` : ''}.`,
    recommendedAction,
    scoringStatus: 'SCORED',
    calculatedAt: new Date().toISOString(),
    matchedTerritory: territoryMatch?.name,
    matchedAudience: audienceHit?.name,
    blockedByLimit,
  };

  // Resumen más accionable para el manager (top factores).
  const breakdown = buildScoreBreakdown(result);
  result.strategicRationale = `${result.strategicRationale} · ${breakdown.summary}`;
  return result;
}
