import type {
  AudienceTier,
  PositioningThesis,
  PriorityBand,
  Signal,
  SourceQuality,
  StrategicScoreFactors,
  StrategicScorePenalties,
  StrategicScoreResult,
} from '../types';
import { deriveStrategicRecommendation } from './dispositionCore';
import type { OutputFormatRecommendation, StrategicDisposition } from '../types';
import { matchedTerms, normalizeText, tokenize as sharedTokenize } from './textMatchCore';
import { normalizeThesis } from './thesisModelCore';

/** Frozen baseline identity — SPEC-002 Phase 1. */
export const SCORING_VERSION = 'scoring-v1' as const;

export type ScoringVersion = typeof SCORING_VERSION;

/** Canonical factor weights — single source for scoring + explainability. */
export const SCORING_FACTOR_WEIGHTS: ReadonlyArray<{
  key: keyof StrategicScoreFactors;
  label: string;
  maxPoints: number;
}> = [
  { key: 'thesisMatch', label: 'Alineación con tesis', maxPoints: 25 },
  { key: 'audienceMatch', label: 'Audiencia objetivo', maxPoints: 20 },
  { key: 'timeliness', label: 'Oportunidad temporal', maxPoints: 15 },
  { key: 'authorityFit', label: 'Autoridad / prueba', maxPoints: 15 },
  { key: 'differentiation', label: 'Diferenciación', maxPoints: 10 },
  { key: 'strategicPotential', label: 'Potencial estratégico', maxPoints: 7.5 },
  { key: 'commercialPotential', label: 'Potencial comercial', maxPoints: 2.5 },
  { key: 'sourceQuality', label: 'Calidad de fuente', maxPoints: 5 },
] as const;

export const SCORING_FACTOR_WEIGHT_MAX_TOTAL = SCORING_FACTOR_WEIGHTS.reduce(
  (sum, row) => sum + row.maxPoints,
  0
);

/** Baseline v1 priority band thresholds. */
export const PRIORITY_BAND_THRESHOLDS = {
  CRITICAL_MIN: 85,
  HIGH_MIN: 70,
  LOW_MAX_EXCLUSIVE: 40,
} as const;

/**
 * Framework-neutral scoring context (no Firebase/db/AI).
 * Mirrors services/scoring ScoringContext for baseline parity.
 */
export interface StrategicScoringContextInput {
  bilingualTerms?: string[];
  ownedTopics?: string[];
  avoidedFramings?: string[];
  whyNow?: { score: number; reason: string };
  authorityScore?: number;
}

/** @deprecated Use StrategicScoringContextInput — kept for services/scoring compat export. */
export type ScoringContext = StrategicScoringContextInput;

export interface ComputeStrategicScoreInput {
  signal: Pick<
    Signal,
    'title' | 'contentSnippet' | 'targetDomain' | 'sourceType' | 'sourceQuality' | 'detectedAt'
  >;
  thesis: PositioningThesis;
  context?: StrategicScoringContextInput;
  /** Explicit clock for staleness — no Date.now() inside Domain core. */
  nowMs: number;
}

export interface CanonicalStrategicScoreMaterial {
  totalScore: number;
  priorityBand: PriorityBand;
  factors: StrategicScoreFactors;
  penalties: StrategicScorePenalties;
  baseScore100: number;
  strategicRationale: string;
  recommendedDisposition: StrategicDisposition;
  recommendedOutputFormat: OutputFormatRecommendation;
  recommendedAction: StrategicScoreResult['recommendedAction'];
  scoringVersion: ScoringVersion;
  scoringStatus: StrategicScoreResult['scoringStatus'];
  matchedTerritory?: string;
  matchedAudience?: string;
  blockedByLimit?: string;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

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
    case 'HIGH':
      return 1;
    case 'MEDIUM':
      return 0.7;
    case 'LOW':
      return 0.25;
    default:
      return 0.5;
  }
}

const TIER_MULTIPLIER: Record<AudienceTier, number> = {
  COMMERCIAL: 1,
  INFLUENCE: 0.85,
  AMPLIFICATION: 0.7,
};

function conceptHit(haystack: string, name: string, keywords: string[]): number {
  const terms = [name, ...keywords].filter((term) => term && term.trim().length > 2);
  if (!terms.length) return 0;
  return matchedTerms(haystack, terms).length / terms.length;
}

function bestTerritory(
  territories: PositioningThesis['territories'],
  haystack: string
): { score: number; name?: string } {
  let best = { score: 0, name: undefined as string | undefined };
  if (!territories?.length) return best;
  for (const territory of territories) {
    const hit = conceptHit(haystack, territory.name, territory.keywords);
    const scaled = hit * (Math.max(0, Math.min(100, territory.weight)) / 100);
    if (scaled > best.score) best = { score: scaled, name: territory.name };
  }
  return best;
}

function bestAudience(
  audiences: PositioningThesis['audiences'],
  haystack: string
): { score: number; name?: string } {
  let best = { score: 0, name: undefined as string | undefined };
  if (!audiences?.length) return best;
  for (const audience of audiences) {
    const hit = conceptHit(haystack, audience.name, audience.keywords);
    const scaled =
      hit * (Math.max(0, Math.min(100, audience.weight)) / 100) * TIER_MULTIPLIER[audience.tier];
    if (scaled > best.score) best = { score: scaled, name: audience.name };
  }
  return best;
}

/** Centralized priority band derivation — baseline v1. */
export function derivePriorityBand(finalScore: number): PriorityBand {
  if (finalScore >= PRIORITY_BAND_THRESHOLDS.CRITICAL_MIN) return 'CRITICAL';
  if (finalScore >= PRIORITY_BAND_THRESHOLDS.HIGH_MIN) return 'HIGH';
  if (finalScore < PRIORITY_BAND_THRESHOLDS.LOW_MAX_EXCLUSIVE) return 'LOW';
  return 'MEDIUM';
}

/**
 * Pure deterministic strategic score — baseline v1.
 * Does not mutate routing, persist, or perform terminal disposition.
 */
export function computeStrategicScoreMaterial(
  input: ComputeStrategicScoreInput
): CanonicalStrategicScoreMaterial {
  const context = input.context ?? {};
  const { signal, thesis, nowMs } = input;
  const haystack = `${signal.title} ${signal.contentSnippet} ${signal.targetDomain || ''}`;
  const normalizedHaystack = normalize(haystack);

  const structured = normalizeThesis(thesis);
  const territories = structured.territories.length ? structured.territories : null;
  const audiences = structured.audiences.length ? structured.audiences : null;
  const businessObjective = structured.objectives.find((o) => o.kind === 'BUSINESS');

  const territoryMatch = territories ? bestTerritory(territories, haystack) : null;
  const audienceHit = audiences ? bestAudience(audiences, haystack) : null;

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
    : signal.sourceType === 'REGULATORY'
      ? 0.95
      : signal.sourceType === 'NEWS_API'
        ? 0.78
        : 0.62;
  const authorityFit =
    typeof context.authorityScore === 'number'
      ? clamp(context.authorityScore / 100, 0, 1)
      : Math.min(1, 0.55 + thesis.proofPoints.length * 0.07);
  const differentiation = thesis.differentiator ? 0.72 : 0.48;
  const strategicPotential = thesisMatch * 0.6 + audienceMatch * 0.4;
  const commercialPotential = businessObjective
    ? 0.3 + (Math.max(0, Math.min(100, businessObjective.weight)) / 100) * 0.6
    : /cliente|negocio|junta|general counsel|board/i.test(thesis.objective + thesis.targetAudience)
      ? 0.6
      : 0.35;
  const sourceQuality = sourceQualityScore(signal.sourceQuality);

  const factors: StrategicScoreFactors = {
    thesisMatch,
    audienceMatch,
    timeliness,
    authorityFit,
    differentiation,
    strategicPotential,
    commercialPotential,
    sourceQuality,
  };

  const baseScore100 = SCORING_FACTOR_WEIGHTS.reduce(
    (sum, row) => sum + factors[row.key] * row.maxPoints,
    0
  );

  const lower = normalizedHaystack;
  const evidenceGap = thesis.proofPoints.length < 2 ? 7 : thesis.proofPoints.length < 4 ? 2 : 0;
  const risk = /fraude|sancion|escandalo|ilegal/i.test(lower)
    ? 15
    : /controversia|conflicto/i.test(lower)
      ? 5
      : 0;
  const captured = Date.parse(signal.detectedAt || '') || nowMs;
  const ageHours = (nowMs - captured) / 36e5;
  const staleness =
    ageHours > 24 * 21 ? 15 : ageHours > 24 * 7 ? 7 : ageHours > 48 ? 2 : 0;
  const softAvoid = [
    ...(context.avoidedFramings || []),
    ...structured.limits.softAvoid,
    ...(structured.voiceProfile.avoid || []),
  ];
  const conflict = Math.round(phraseHits(softAvoid, normalizedHaystack) * 8);
  const penalties: StrategicScorePenalties = { evidenceGap, risk, staleness, conflict };

  const finalScore = Math.round(
    clamp(baseScore100 - evidenceGap - risk - staleness - conflict)
  );
  const priorityBand = derivePriorityBand(finalScore);

  const hardBlocks = structured.limits.hardBlocks.length
    ? structured.limits.hardBlocks
    : normalize(thesis.complianceRules || '')
        .split(/[,;]/)
        .map((rule) => rule.trim())
        .filter((rule) => rule.length > 4);
  const blockedByLimit = hardBlocks.find((rule) => lower.includes(normalize(rule)));

  const recommendation = deriveStrategicRecommendation({
    finalScore,
    risk,
    evidenceGap,
    proofPointCount: thesis.proofPoints.length,
    blockedByLimit,
  });

  const matchDetail = territoryMatch?.name ? ` Territorio: ${territoryMatch.name}.` : '';
  const whyNowDetail = context.whyNow ? ` Why now: ${context.whyNow.reason}.` : '';

  let strategicRationale = `Alineación con tesis "${thesis.title}": match temático ${Math.round(thesisMatch * 100)}%, audiencia ${Math.round(audienceMatch * 100)}%.${matchDetail}${whyNowDetail} Penalización de riesgo ${risk}, evidencia ${evidenceGap}${conflict ? `, framing ${conflict}` : ''}.`;

  const factorRows = SCORING_FACTOR_WEIGHTS.map(({ key, label, maxPoints }) => ({
    label,
    weight: factors[key],
    points: Math.round(factors[key] * maxPoints * 10) / 10,
  })).sort((a, b) => b.points - a.points);
  const penaltySum = [evidenceGap, risk, staleness, conflict].filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const top = factorRows.slice(0, 2).map((f) => `${f.label} ${Math.round(f.weight * 100)}%`);
  const pen = penaltySum > 0 ? ` · −${penaltySum} pts` : '';
  strategicRationale = `${strategicRationale} · ${top.join(' · ')}${pen}`;

  return {
    totalScore: finalScore,
    priorityBand,
    factors,
    penalties,
    baseScore100,
    strategicRationale,
    recommendedDisposition: recommendation.recommendedDisposition,
    recommendedOutputFormat: recommendation.recommendedOutputFormat,
    recommendedAction: recommendation.legacyRecommendedAction,
    scoringVersion: SCORING_VERSION,
    scoringStatus: 'SCORED',
    matchedTerritory: territoryMatch?.name,
    matchedAudience: audienceHit?.name,
    blockedByLimit,
  };
}

/** Map material Domain output to public StrategicScoreResult (calculatedAt injected externally). */
export function toStrategicScoreResult(
  material: CanonicalStrategicScoreMaterial,
  calculatedAt: string
): StrategicScoreResult {
  return {
    totalScore: material.totalScore,
    priorityBand: material.priorityBand,
    factors: material.factors,
    penalties: material.penalties,
    strategicRationale: material.strategicRationale,
    recommendedAction: material.recommendedAction,
    recommendedDisposition: material.recommendedDisposition,
    recommendedOutputFormat: material.recommendedOutputFormat,
    scoringVersion: material.scoringVersion,
    scoringStatus: material.scoringStatus,
    calculatedAt,
    matchedTerritory: material.matchedTerritory,
    matchedAudience: material.matchedAudience,
    blockedByLimit: material.blockedByLimit,
  };
}
