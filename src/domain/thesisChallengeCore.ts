import type { EvidenceVaultItem, PositioningThesis } from '../types';
import {
  assertThesisReadyForReview,
  normalizeThesis,
  thesisCompleteness,
  THESIS_READINESS_MIN_SCORE,
} from './thesisModelCore';
import { computeThesisStrength } from './thesisStrengthCore';

/**
 * Decisión piloto (22 ago 2026): el Stress-test es recomendado, no bloqueante.
 * Enviar al cliente solo exige readiness ≥ THESIS_READINESS_MIN_SCORE.
 */
export const THESIS_CHALLENGE_REQUIRED_BEFORE_SUBMIT = false;

export type ThesisChallengeOutcome = 'READY' | 'REFINE' | 'SPLIT' | 'PAUSE' | 'REJECT';

export type ThesisChallengeAction = 'submit' | 'edit' | 'split' | 'vault' | 'close';

export interface ThesisChallengeFinding {
  kind: 'vague' | 'evidence' | 'audience' | 'contradiction' | 'saturation' | 'breadth';
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface ThesisChallengeResult {
  outcome: ThesisChallengeOutcome;
  riskScore: number;
  findings: ThesisChallengeFinding[];
  recommendations: string[];
  primaryAction: ThesisChallengeAction;
  splitHint?: string;
}

const OUTCOME_LABELS: Record<ThesisChallengeOutcome, string> = {
  READY: 'Lista para avanzar',
  REFINE: 'Refinar estructura',
  SPLIT: 'Considerar dividir',
  PAUSE: 'Pausar antes de publicar',
  REJECT: 'Replantear enfoque',
};

export function thesisChallengeOutcomeLabel(outcome: ThesisChallengeOutcome): string {
  return OUTCOME_LABELS[outcome];
}

/** Mapea respuestas legacy de IA al modelo de producto. */
export function mapLegacyChallengeStatus(
  status: 'SOLID' | 'VULNERABLE' | 'SATURATED'
): ThesisChallengeOutcome {
  if (status === 'SOLID') return 'READY';
  if (status === 'SATURATED') return 'SPLIT';
  return 'REFINE';
}

function audienceBreadthScore(audiences: ReturnType<typeof normalizeThesis>['audiences'], fallback: string): number {
  const names = audiences.length ? audiences.map((a) => a.name) : fallback.split(/[,;|]/);
  const tiers = new Set(audiences.map((a) => a.tier));
  return names.filter(Boolean).length + tiers.size;
}

function territorySpread(territories: ReturnType<typeof normalizeThesis>['territories']): number {
  if (territories.length < 2) return 0;
  const weights = territories.map((t) => t.weight);
  const max = Math.max(...weights);
  const min = Math.min(...weights);
  return territories.length + (max - min < 25 ? 2 : 0);
}

function actionFor(outcome: ThesisChallengeOutcome): ThesisChallengeAction {
  switch (outcome) {
    case 'READY':
      return 'submit';
    case 'SPLIT':
      return 'split';
    case 'REFINE':
    case 'REJECT':
      return 'edit';
    case 'PAUSE':
      return 'vault';
    default:
      return 'close';
  }
}

/**
 * Evaluación heurística del stress-test. El manager decide; no hay auto-rechazo.
 */
export function evaluateThesisChallenge(
  thesis: PositioningThesis,
  evidence: EvidenceVaultItem[]
): ThesisChallengeResult {
  const normalized = normalizeThesis(thesis);
  const completeness = thesisCompleteness(thesis);
  const readiness = assertThesisReadyForReview(thesis);
  const strength = computeThesisStrength(thesis, evidence);
  const findings: ThesisChallengeFinding[] = [];
  const recommendations: string[] = [];

  if (!thesis.expertIdentity?.trim() || thesis.expertIdentity.length < 24) {
    findings.push({
      kind: 'vague',
      severity: 'warning',
      message: 'La identidad experta es corta o genérica.',
    });
    recommendations.push('Afila la identidad experta con credencial + enfoque concreto.');
  }

  if ((thesis.proofPoints?.length || 0) < 2) {
    findings.push({
      kind: 'evidence',
      severity: 'critical',
      message: 'Menos de 2 proof points declarados.',
    });
    recommendations.push('Añade al menos dos respaldos verificables en el vault.');
  } else if (strength.verifiedCount < 2) {
    findings.push({
      kind: 'evidence',
      severity: 'warning',
      message: 'Pocos proof points tienen evidencia verificada en vault.',
    });
    recommendations.push('Vincula credenciales del muro de pruebas a esta tesis.');
  }

  const breadth = audienceBreadthScore(normalized.audiences, thesis.targetAudience || '');
  if (breadth >= 5) {
    findings.push({
      kind: 'breadth',
      severity: 'warning',
      message: 'La audiencia parece demasiado amplia para guiar el radar.',
    });
    recommendations.push('Separa compradores, influenciadores y amplificación con pesos.');
  }

  const spread = territorySpread(normalized.territories);
  const domainParts = (thesis.domain || '').split(/[·|,]/).filter((p) => p.trim().length > 3);
  if (spread >= 5 || domainParts.length >= 4) {
    findings.push({
      kind: 'saturation',
      severity: 'warning',
      message: 'Varios territorios compiten con peso similar — riesgo de dilución.',
    });
    recommendations.push('Considera una segunda tesis para la vía de práctica alternativa.');
  }

  if (normalized.territories.length >= 4 && normalized.audiences.length >= 3 && spread >= 4) {
    findings.push({
      kind: 'contradiction',
      severity: 'critical',
      message: 'Demasiados ejes estratégicos en una sola tesis.',
    });
  }

  if (completeness.score < 50) {
    findings.push({
      kind: 'vague',
      severity: 'critical',
      message: `Estructura incompleta (${completeness.score}/100).`,
    });
  }

  let outcome: ThesisChallengeOutcome = 'READY';
  let riskScore = Math.max(8, 100 - strength.authorityScore);

  if (findings.some((f) => f.kind === 'contradiction' && f.severity === 'critical')) {
    outcome = 'SPLIT';
    riskScore = Math.max(riskScore, 68);
  } else if (!readiness.ready || completeness.score < THESIS_READINESS_MIN_SCORE) {
    outcome = 'REFINE';
    riskScore = Math.max(riskScore, 100 - completeness.score);
  } else if (spread >= 5 || domainParts.length >= 4) {
    outcome = 'SPLIT';
    riskScore = Math.max(riskScore, 55);
  } else if (strength.band === 'WEAK') {
    outcome = 'PAUSE';
    riskScore = Math.max(riskScore, 72);
  } else if (findings.some((f) => f.severity === 'critical')) {
    outcome = 'REJECT';
    riskScore = Math.max(riskScore, 80);
  }

  if (outcome === 'READY' && recommendations.length === 0) {
    recommendations.push('La tesis tiene estructura y respaldo suficientes para solicitar revisión del cliente.');
  }

  const splitHint =
    outcome === 'SPLIT'
      ? `Segunda vía sugerida: ${domainParts.slice(-2).join(' · ') || 'práctica alternativa'}`
      : undefined;

  return {
    outcome,
    riskScore: Math.min(95, Math.round(riskScore)),
    findings,
    recommendations: [...new Set(recommendations)].slice(0, 6),
    primaryAction: actionFor(outcome),
    splitHint,
  };
}

export function mergeChallengeWithAi(
  base: ThesisChallengeResult,
  ai: { outcome?: ThesisChallengeOutcome; recommendations?: string[]; riskScore?: number }
): ThesisChallengeResult {
  const outcome = ai.outcome || base.outcome;
  return {
    ...base,
    outcome,
    riskScore: typeof ai.riskScore === 'number' ? ai.riskScore : base.riskScore,
    recommendations: ai.recommendations?.length
      ? [...new Set([...ai.recommendations, ...base.recommendations])].slice(0, 8)
      : base.recommendations,
    primaryAction: actionFor(outcome),
    splitHint: outcome === 'SPLIT' ? base.splitHint : base.splitHint,
  };
}
