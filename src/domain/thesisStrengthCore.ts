import type { EvidenceType, EvidenceVaultItem, PositioningThesis } from '../types';
import { hasAnyTerm, tokenize } from './textMatchCore';
import { normalizeThesis } from './thesisModelCore';

/**
 * Autoridad por defecto según el tipo de evidencia. Una patente concedida pesa
 * más que una mención en prensa, aunque el manager no lo declare.
 */
const TYPE_AUTHORITY: Record<EvidenceType, number> = {
  PATENT: 95,
  ACADEMIC_PAPER: 90,
  PUBLICATION: 85,
  AWARD: 80,
  CITATION: 80,
  CASE_STUDY: 75,
  CERTIFICATION: 70,
  EXPERIENCE: 70,
  CONFERENCE: 65,
  EDUCATION: 60,
  PROJECT: 60,
  METRIC: 55,
  MEDIA_MENTION: 55,
  MEDIA: 50,
  DOCUMENT: 40,
  OTHER: 35,
};

export type AuthorityBand = 'WEAK' | 'EMERGING' | 'SOLID' | 'DOMINANT';

export interface StrengthComponent {
  key: string;
  label: string;
  /** 0-100, el desempeño del componente. */
  score: number;
  /** Puntos que aporta al Authority Score final. */
  points: number;
  maxPoints: number;
  detail: string;
}

export interface ThesisStrength {
  authorityScore: number;
  band: AuthorityBand;
  evidenceCount: number;
  verifiedCount: number;
  /** Evidencia del cliente sin asignar a ninguna tesis: autoridad desperdiciada. */
  unassignedCount: number;
  components: StrengthComponent[];
  topEvidence: Array<{ id: string; title: string; authority: number; verified: boolean }>;
  summary: string;
}

const COMPONENT_WEIGHTS = {
  quality: 30,
  verification: 25,
  volume: 20,
  diversity: 15,
  coverage: 10,
} as const;

/** Autoridad efectiva de un ítem: la declarada, o la que corresponde a su tipo. */
export function evidenceAuthority(item: EvidenceVaultItem): number {
  const declared = item.authorityWeight;
  if (typeof declared === 'number' && Number.isFinite(declared)) {
    return Math.max(0, Math.min(100, declared));
  }
  return TYPE_AUTHORITY[item.type] ?? 40;
}

/** Texto donde buscar señales de qué sostiene una evidencia. */
function evidenceHaystack(item: EvidenceVaultItem): string {
  return [item.title, item.snippet, ...(item.supports || [])].filter(Boolean).join(' ');
}

function bandFor(score: number): AuthorityBand {
  if (score < 30) return 'WEAK';
  if (score < 55) return 'EMERGING';
  if (score < 80) return 'SOLID';
  return 'DOMINANT';
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Authority Score de una tesis: cuánta autoridad real sostiene su promesa.
 * Solo cuenta la evidencia asignada a la tesis; el resto se reporta como
 * `unassignedCount` para que el manager la conecte.
 */
export function computeThesisStrength(
  thesis: PositioningThesis,
  evidence: EvidenceVaultItem[]
): ThesisStrength {
  const assigned = evidence.filter((item) => item.associatedThesesIds?.includes(thesis.id));
  const unassignedCount = evidence.filter((item) => !item.associatedThesesIds?.length).length;
  const verified = assigned.filter((item) => item.verified);
  const { territories } = normalizeThesis(thesis);

  const authorities = assigned.map(evidenceAuthority);
  const avgAuthority = authorities.length
    ? authorities.reduce((acc, value) => acc + value, 0) / authorities.length
    : 0;
  const distinctTypes = new Set(assigned.map((item) => item.type)).size;

  const coveredTerritories = territories.filter((territory) =>
    assigned.some((item) =>
      hasAnyTerm(evidenceHaystack(item), [territory.name, ...territory.keywords])
    )
  );

  const scores = {
    quality: avgAuthority,
    verification: assigned.length ? (verified.length / assigned.length) * 100 : 0,
    volume: Math.min(100, (assigned.length / 6) * 100),
    diversity: Math.min(100, (distinctTypes / 4) * 100),
    coverage: territories.length ? (coveredTerritories.length / territories.length) * 100 : 0,
  };

  const components: StrengthComponent[] = [
    {
      key: 'quality',
      label: 'Calidad de la evidencia',
      score: Math.round(scores.quality),
      points: round((scores.quality / 100) * COMPONENT_WEIGHTS.quality),
      maxPoints: COMPONENT_WEIGHTS.quality,
      detail: assigned.length
        ? `Autoridad media ${Math.round(avgAuthority)}/100`
        : 'Sin evidencia asignada a esta tesis',
    },
    {
      key: 'verification',
      label: 'Verificación',
      score: Math.round(scores.verification),
      points: round((scores.verification / 100) * COMPONENT_WEIGHTS.verification),
      maxPoints: COMPONENT_WEIGHTS.verification,
      detail: `${verified.length} de ${assigned.length} verificadas`,
    },
    {
      key: 'volume',
      label: 'Volumen',
      score: Math.round(scores.volume),
      points: round((scores.volume / 100) * COMPONENT_WEIGHTS.volume),
      maxPoints: COMPONENT_WEIGHTS.volume,
      detail: `${assigned.length} piezas (6 saturan el factor)`,
    },
    {
      key: 'diversity',
      label: 'Diversidad de tipo',
      score: Math.round(scores.diversity),
      points: round((scores.diversity / 100) * COMPONENT_WEIGHTS.diversity),
      maxPoints: COMPONENT_WEIGHTS.diversity,
      detail: `${distinctTypes} tipo${distinctTypes === 1 ? '' : 's'} distinto${distinctTypes === 1 ? '' : 's'}`,
    },
    {
      key: 'coverage',
      label: 'Cobertura de territorios',
      score: Math.round(scores.coverage),
      points: round((scores.coverage / 100) * COMPONENT_WEIGHTS.coverage),
      maxPoints: COMPONENT_WEIGHTS.coverage,
      detail: territories.length
        ? `${coveredTerritories.length} de ${territories.length} territorios respaldados`
        : 'Sin territorios definidos',
    },
  ];

  const authorityScore = Math.round(components.reduce((acc, component) => acc + component.points, 0));
  const band = bandFor(authorityScore);

  const topEvidence = assigned
    .map((item) => ({
      id: item.id,
      title: item.title,
      authority: evidenceAuthority(item),
      verified: item.verified,
    }))
    .sort((a, b) => b.authority - a.authority)
    .slice(0, 5);

  const summary = assigned.length
    ? `${authorityScore}/100 con ${assigned.length} evidencia${assigned.length === 1 ? '' : 's'} asignada${assigned.length === 1 ? '' : 's'}${unassignedCount ? ` · ${unassignedCount} sin asignar` : ''}`
    : `Sin evidencia asignada${unassignedCount ? `: hay ${unassignedCount} pieza${unassignedCount === 1 ? '' : 's'} en el vault sin conectar` : ''}`;

  return {
    authorityScore,
    band,
    evidenceCount: assigned.length,
    verifiedCount: verified.length,
    unassignedCount,
    components,
    topEvidence,
    summary,
  };
}

/** Contenido publicado, reducido a lo que el core necesita para medir la brecha. */
export interface PublishedPiece {
  id?: string;
  title: string;
  body?: string;
}

export type GapKind = 'TERRITORY' | 'AUDIENCE' | 'PERCEPTION';
export type GapSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PositioningGapItem {
  key: string;
  kind: GapKind;
  label: string;
  severity: GapSeverity;
  detail: string;
  action: string;
  evidenceCount: number;
  contentCount: number;
}

export interface PositioningGap {
  /** 0-100. Cuánto de la promesa está realmente respaldado y publicado. */
  score: number;
  gaps: PositioningGapItem[];
  summary: string;
}

function countMatches(texts: string[], terms: string[]): number {
  return texts.filter((text) => hasAnyTerm(text, terms)).length;
}

/**
 * Compara la percepción objetivo con lo que la evidencia y el contenido publicado
 * realmente sostienen. Devuelve brechas concretas, no un porcentaje abstracto.
 */
export function computePositioningGap(
  thesis: PositioningThesis,
  evidence: EvidenceVaultItem[],
  publishedContent: PublishedPiece[]
): PositioningGap {
  const { territories, audiences, perceptionTarget } = normalizeThesis(thesis);
  const assigned = evidence.filter((item) => item.associatedThesesIds?.includes(thesis.id));
  const evidenceTexts = assigned.map(evidenceHaystack);
  const contentTexts = publishedContent.map((piece) => `${piece.title} ${piece.body || ''}`);

  const gaps: PositioningGapItem[] = [];
  let checks = 0;
  let covered = 0;

  for (const territory of territories) {
    const terms = [territory.name, ...territory.keywords];
    const evidenceCount = countMatches(evidenceTexts, terms);
    const contentCount = countMatches(contentTexts, terms);
    checks += 1;

    if (evidenceCount > 0 && contentCount > 0) {
      covered += 1;
      continue;
    }

    if (evidenceCount === 0 && contentCount > 0) {
      gaps.push({
        key: `territory:${territory.id}`,
        kind: 'TERRITORY',
        label: territory.name,
        severity: 'HIGH',
        detail: `${contentCount} pieza${contentCount === 1 ? '' : 's'} publicada${contentCount === 1 ? '' : 's'} sin evidencia que la respalde.`,
        action: 'Añadir evidencia al vault antes de seguir publicando aquí.',
        evidenceCount,
        contentCount,
      });
      continue;
    }

    if (evidenceCount > 0 && contentCount === 0) {
      covered += 0.5;
      gaps.push({
        key: `territory:${territory.id}`,
        kind: 'TERRITORY',
        label: territory.name,
        severity: 'MEDIUM',
        detail: `Hay ${evidenceCount} evidencia${evidenceCount === 1 ? '' : 's'} pero nada publicado: la autoridad existe y nadie la ve.`,
        action: 'Producir contenido sobre este territorio.',
        evidenceCount,
        contentCount,
      });
      continue;
    }

    gaps.push({
      key: `territory:${territory.id}`,
      kind: 'TERRITORY',
      label: territory.name,
      severity: territory.weight >= 70 ? 'HIGH' : 'LOW',
      detail: 'Sin evidencia ni contenido: el territorio es una declaración vacía.',
      action: 'Documentar evidencia y planificar contenido, o quitar el territorio de la tesis.',
      evidenceCount,
      contentCount,
    });
  }

  for (const audience of audiences) {
    const terms = [audience.name, ...audience.keywords];
    const contentCount = countMatches(contentTexts, terms);
    checks += 1;

    if (contentCount > 0) {
      covered += 1;
      continue;
    }

    gaps.push({
      key: `audience:${audience.id}`,
      kind: 'AUDIENCE',
      label: audience.name,
      severity: audience.weight >= 70 ? 'MEDIUM' : 'LOW',
      detail: 'Ninguna pieza publicada habla a esta audiencia.',
      action: 'Orientar la próxima pieza a esta audiencia.',
      evidenceCount: 0,
      contentCount,
    });
  }

  if (perceptionTarget) {
    const terms = tokenize(perceptionTarget).filter((token) => token.length > 4);
    const evidenceCount = countMatches(evidenceTexts, terms);
    const contentCount = countMatches(contentTexts, terms);
    checks += 1;

    if (evidenceCount > 0 || contentCount > 0) {
      covered += 1;
    } else {
      gaps.push({
        key: 'perception',
        kind: 'PERCEPTION',
        label: 'Percepción objetivo',
        severity: 'HIGH',
        detail: 'Ni la evidencia ni el contenido publicado apuntan a la percepción que se quiere construir.',
        action: 'Alinear la próxima ronda de contenido con la percepción objetivo.',
        evidenceCount,
        contentCount,
      });
    }
  }

  const score = checks ? Math.round((covered / checks) * 100) : 0;
  const high = gaps.filter((gap) => gap.severity === 'HIGH').length;

  return {
    score,
    gaps: gaps.sort((a, b) => {
      const rank: Record<GapSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return rank[a.severity] - rank[b.severity];
    }),
    summary: checks
      ? `${score}% de la promesa respaldada${high ? ` · ${high} brecha${high === 1 ? '' : 's'} crítica${high === 1 ? '' : 's'}` : ''}`
      : 'Tesis sin territorios ni audiencias: no hay nada que medir.',
  };
}
