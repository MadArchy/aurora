import type { StrategicScoreFactors, StrategicScorePenalties, StrategicScoreResult } from '../types';
import { SCORING_FACTOR_WEIGHTS } from './scoringCore';

export interface ScoreFactorRow {
  key: string;
  label: string;
  /** Contribución aproximada en puntos (0–25). */
  points: number;
  /** Valor crudo 0–1 del factor. */
  weight: number;
}

export interface ScorePenaltyRow {
  key: string;
  label: string;
  points: number;
}

export interface ScoreBreakdownView {
  totalScore: number;
  factors: ScoreFactorRow[];
  penalties: ScorePenaltyRow[];
  summary: string;
}

const PENALTY_LABELS: Record<keyof StrategicScorePenalties, string> = {
  evidenceGap: 'Gap de evidencia',
  risk: 'Riesgo / controversia',
  staleness: 'Antigüedad',
  conflict: 'Framing a evitar',
};

export function buildScoreBreakdown(score: StrategicScoreResult): ScoreBreakdownView {
  const factors: ScoreFactorRow[] = SCORING_FACTOR_WEIGHTS.map(({ key, label, maxPoints }) => ({
    key,
    label,
    weight: score.factors[key],
    points: Math.round(score.factors[key] * maxPoints * 10) / 10,
  })).sort((a, b) => b.points - a.points);

  const penalties: ScorePenaltyRow[] = (Object.keys(score.penalties) as Array<keyof StrategicScorePenalties>)
    .filter((key) => score.penalties[key] > 0)
    .map((key) => ({
      key,
      label: PENALTY_LABELS[key],
      points: score.penalties[key],
    }))
    .sort((a, b) => b.points - a.points);

  const top = factors.slice(0, 2).map((f) => `${f.label} ${Math.round(f.weight * 100)}%`);
  const pen = penalties.length ? ` · −${penalties.map((p) => p.points).reduce((a, b) => a + b, 0)} pts` : '';

  return {
    totalScore: score.totalScore,
    factors,
    penalties,
    summary: `${top.join(' · ')}${pen}`,
  };
}

/** Serializa breakdown compacto para persistir en la señal. */
export function serializeScoreBreakdown(score: StrategicScoreResult): ScoreBreakdownView {
  return buildScoreBreakdown(score);
}

/** Reconstruct pre-clamp base from factor weights (explainability contract). */
export function reconstructBaseScore100(factors: StrategicScoreFactors): number {
  return SCORING_FACTOR_WEIGHTS.reduce((sum, row) => sum + factors[row.key] * row.maxPoints, 0);
}

/** Penalty sum applied before clamp/round. */
export function totalPenaltyPoints(penalties: StrategicScorePenalties): number {
  return penalties.evidenceGap + penalties.risk + penalties.staleness + penalties.conflict;
}
