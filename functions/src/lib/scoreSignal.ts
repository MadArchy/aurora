/**
 * Scoring ligero server-side (alineado con src/services/scoring.ts).
 * Solo factores disponibles en Cloud Functions sin dossier completo.
 */

export interface CloudScoreInput {
  title: string;
  snippet: string;
  sourceType: string;
  sourceQuality?: string;
  detectedAt?: string;
  domain?: string;
  thesisTitle?: string;
  targetAudience?: string;
  proofPointCount?: number;
  bilingualTerms?: string[];
}

export interface CloudScoreResult {
  totalScore: number;
  priorityBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendedAction:
    | 'NO_ACTION'
    | 'MONITOR'
    | 'SAVE'
    | 'RESEARCH_REQUIRED'
    | 'CREATE_OPPORTUNITY'
    | 'SHORT_POST'
    | 'VIDEO';
  strategicRationale: string;
}

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

function phraseHits(phrases: string[] | undefined, haystack: string): number {
  if (!phrases?.length) return 0;
  const hits = phrases.filter((p) => {
    const needle = normalize(p);
    return needle.length > 3 && haystack.includes(needle);
  }).length;
  return Math.min(1, hits / Math.max(2, Math.min(phrases.length, 5)));
}

function qualityScore(quality?: string): number {
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

export function scoreSignalCloud(input: CloudScoreInput): CloudScoreResult {
  const haystack = `${input.title} ${input.snippet}`;
  const normalized = normalize(haystack);
  const domain = input.domain || '';
  const thesisTitle = input.thesisTitle || '';
  const audience = input.targetAudience || '';
  const proofCount = input.proofPointCount || 0;

  const thesisMatch = Math.max(
    0.35,
    tokenOverlap(`${domain} ${thesisTitle}`, haystack),
    phraseHits(input.bilingualTerms, normalized)
  );
  const audienceMatch = Math.max(0.35, tokenOverlap(audience, haystack), phraseHits(input.bilingualTerms, normalized) * 0.7);
  const timeliness =
    input.sourceType === 'REGULATORY' ? 0.95 : input.sourceType === 'NEWS_API' ? 0.78 : input.sourceType === 'VIDEO' ? 0.7 : 0.62;
  const authorityFit = Math.min(1, 0.55 + proofCount * 0.07);
  const sourceQuality = qualityScore(input.sourceQuality);

  const base =
    thesisMatch * 25 +
    audienceMatch * 20 +
    timeliness * 15 +
    authorityFit * 15 +
    0.72 * 10 +
    (thesisMatch * 0.6 + audienceMatch * 0.4) * 7.5 +
    0.35 * 2.5 +
    sourceQuality * 5;

  const evidenceGap = proofCount < 2 ? 7 : proofCount < 4 ? 2 : 0;
  const risk = /fraude|sancion|escandalo|ilegal/i.test(normalized) ? 15 : 0;
  const captured = Date.parse(input.detectedAt || '') || Date.now();
  const ageHours = (Date.now() - captured) / 36e5;
  const staleness = ageHours > 24 * 21 ? 15 : ageHours > 24 * 7 ? 7 : ageHours > 48 ? 2 : 0;

  const totalScore = Math.round(Math.max(0, Math.min(100, base - evidenceGap - risk - staleness)));

  let priorityBand: CloudScoreResult['priorityBand'] = 'MEDIUM';
  if (totalScore >= 85) priorityBand = 'CRITICAL';
  else if (totalScore >= 70) priorityBand = 'HIGH';
  else if (totalScore < 40) priorityBand = 'LOW';

  let recommendedAction: CloudScoreResult['recommendedAction'] = 'SAVE';
  if (risk >= 15 && totalScore < 70) recommendedAction = 'NO_ACTION';
  else if (evidenceGap >= 7 || proofCount === 0) recommendedAction = 'RESEARCH_REQUIRED';
  else if (totalScore >= 85) recommendedAction = 'CREATE_OPPORTUNITY';
  else if (totalScore >= 70) recommendedAction = 'VIDEO';
  else if (totalScore >= 50) recommendedAction = 'SHORT_POST';
  else if (totalScore >= 40) recommendedAction = 'MONITOR';
  else recommendedAction = 'NO_ACTION';

  return {
    totalScore,
    priorityBand,
    recommendedAction,
    strategicRationale: `Match tesis ${Math.round(thesisMatch * 100)}% · audiencia ${Math.round(audienceMatch * 100)}% · riesgo ${risk} · evidencia ${evidenceGap}`,
  };
}
