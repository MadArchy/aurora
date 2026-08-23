import type {
  PositioningThesis,
  PriorityBand,
  RecommendedAction,
  Signal,
  StrategicScoreResult,
} from '../types';
import { filterEligibleThesesForStrategicRouting } from './thesisRoutingEligibility';

/**
 * Función de scoring inyectada. El core permanece puro: quien enruta decide qué
 * contexto (dossier, feedback) se aplica a cada tesis.
 */
export type ThesisScoreFn = (signal: Signal, thesis: PositioningThesis) => StrategicScoreResult;

/** SPEC-001 routing classification — distinct from decision source. */
export type SignalRoutingState = 'CLEAR' | 'CONTESTED' | 'UNROUTED';

/** SPEC-001 decision source — MANUAL is never implied by AI. */
export type SignalRoutingSource = 'AUTO' | 'MANUAL';

/** Frozen algorithm identity for explainability / history (SPEC-001 A10). */
export const ROUTING_ALGORITHM_VERSION = 'routing-v1' as const;

export type RoutingAlgorithmVersion = typeof ROUTING_ALGORITHM_VERSION;

/**
 * Material routing decision fields — sufficient for future history (Phase 3).
 * Not a persistence schema.
 */
export interface MaterialRoutingDecision {
  routingState: SignalRoutingState;
  selectedThesisId?: string;
  source: SignalRoutingSource;
  algorithmVersion: RoutingAlgorithmVersion;
  rationale: string;
}

/** Contract input for future OverrideSignalThesis (Phase 2) — domain-neutral. */
export interface ManualRoutingOverrideDraft {
  signalId: string;
  selectedThesisId: string;
  /** Neutral actor identity — not a Firebase User. */
  actorId?: string;
  previous?: MaterialRoutingDecision;
}

export interface ThesisRoutingScore {
  thesisId: string;
  thesisTitle: string;
  score: number;
  band: PriorityBand;
  recommendedAction: RecommendedAction;
  matchedTerritory?: string;
  matchedAudience?: string;
  /** Motivo por el que la tesis queda fuera, si aplica. */
  exclusionReason?: string;
}

export interface ThesisRoutingResult {
  signalId: string;
  /** Eligible ACTIVE theses that were scored (exclusions are score/limit based). */
  eligibleThesisCount: number;
  perThesis: ThesisRoutingScore[];
  routingState: SignalRoutingState;
  source: SignalRoutingSource;
  algorithmVersion: RoutingAlgorithmVersion;
  /**
   * Final strategic attribution — set only when routingState === CLEAR.
   * Absent for CONTESTED and UNROUTED (no silent first-thesis selection).
   */
  selectedThesisId?: string;
  /**
   * @deprecated Prefer selectedThesisId. Alias of selectedThesisId when CLEAR;
   * undefined when CONTESTED/UNROUTED.
   */
  primaryThesisId?: string;
  /** Leading competitor when contested or runner-up when CLEAR. */
  secondaryThesisId?: string;
  excludedThesisIds: string[];
  /** true when routingState === CONTESTED (compat). */
  contested: boolean;
  rationale: string;
  /** ISO timestamp when routing was computed (domain clock injectable via options later). */
  routedAt: string;
}

/** Por debajo de esto la señal no justifica trabajo bajo esa tesis. */
export const ROUTING_MIN_SCORE = 40;

/** Diferencia máxima para considerar que dos tesis empatan. */
export const ROUTING_CONTEST_MARGIN = 5;

function bandOf(score: number): PriorityBand {
  if (score >= 85) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score < 40) return 'LOW';
  return 'MEDIUM';
}

function emptyUnrouted(signalId: string, rationale: string, routedAt: string): ThesisRoutingResult {
  return {
    signalId,
    eligibleThesisCount: 0,
    perThesis: [],
    routingState: 'UNROUTED',
    source: 'AUTO',
    algorithmVersion: ROUTING_ALGORITHM_VERSION,
    excludedThesisIds: [],
    contested: false,
    rationale,
    routedAt,
  };
}

/**
 * Puntúa la señal contra todas las tesis ACTIVE elegibles y clasifica el enrutado.
 * Filtra elegibilidad en dominio (ACTIVE-only). No usa índice [0] como atribución estratégica.
 * CONTESTED no asigna selectedThesisId.
 */
export function routeSignalAcrossTheses(
  signal: Signal,
  theses: PositioningThesis[],
  scoreFn: ThesisScoreFn,
  options?: { now?: string }
): ThesisRoutingResult {
  const routedAt = options?.now ?? new Date().toISOString();
  const signalId = signal.id;
  const eligibleTheses = filterEligibleThesesForStrategicRouting(theses);

  if (!eligibleTheses.length) {
    return emptyUnrouted(
      signalId,
      'El cliente no tiene tesis ACTIVE elegibles: la señal no se puede enrutar.',
      routedAt
    );
  }

  const priorityOf = new Map(eligibleTheses.map((t) => [t.id, t.priority ?? 0]));

  const perThesis: ThesisRoutingScore[] = eligibleTheses.map((thesis) => {
    const result = scoreFn(signal, thesis);
    const exclusionReason = result.blockedByLimit
      ? `Límite duro: ${result.blockedByLimit}`
      : result.totalScore < ROUTING_MIN_SCORE
        ? `Score ${result.totalScore} por debajo del mínimo ${ROUTING_MIN_SCORE}`
        : undefined;

    return {
      thesisId: thesis.id,
      thesisTitle: thesis.title,
      score: result.totalScore,
      band: bandOf(result.totalScore),
      recommendedAction: result.recommendedAction,
      matchedTerritory: result.matchedTerritory,
      matchedAudience: result.matchedAudience,
      exclusionReason,
    };
  });

  // Deterministic sort: score desc, then declared thesis priority — never input array order.
  const sorted = perThesis.slice().sort((a, b) => {
    const byScore = b.score - a.score;
    if (byScore !== 0) return byScore;
    const byPriority =
      (priorityOf.get(b.thesisId) ?? 0) - (priorityOf.get(a.thesisId) ?? 0);
    if (byPriority !== 0) return byPriority;
    return a.thesisId.localeCompare(b.thesisId);
  });

  const scoreEligible = sorted.filter((entry) => !entry.exclusionReason);
  const excludedThesisIds = sorted
    .filter((entry) => entry.exclusionReason)
    .map((entry) => entry.thesisId);

  if (!scoreEligible.length) {
    const blocked = perThesis.filter((entry) =>
      entry.exclusionReason?.startsWith('Límite duro')
    ).length;
    return {
      signalId,
      eligibleThesisCount: eligibleTheses.length,
      perThesis: sorted,
      routingState: 'UNROUTED',
      source: 'AUTO',
      algorithmVersion: ROUTING_ALGORITHM_VERSION,
      excludedThesisIds,
      contested: false,
      rationale: blocked
        ? `Ninguna tesis puede tomar esta señal: ${blocked} bloqueada${blocked === 1 ? '' : 's'} por límites duros.`
        : 'Ninguna tesis alcanza el mínimo de score para esta señal.',
      routedAt,
    };
  }

  const leader = scoreEligible[0];
  const runnerUp = scoreEligible[1];
  const scoreDiff = runnerUp ? leader.score - runnerUp.score : Number.POSITIVE_INFINITY;
  const leaderPriority = priorityOf.get(leader.thesisId) ?? 0;
  const runnerPriority = runnerUp ? priorityOf.get(runnerUp.thesisId) ?? 0 : 0;
  /**
   * Near-score competition → CONTESTED (no silent attribution).
   * Exact score ties with unequal declared priority → CLEAR via priority (deterministic).
   * Exact score ties with equal priority → CONTESTED.
   */
  const contested = Boolean(
    runnerUp &&
      scoreDiff <= ROUTING_CONTEST_MARGIN &&
      !(scoreDiff === 0 && leaderPriority !== runnerPriority)
  );

  if (contested) {
    const parts = [
      `${leader.thesisTitle} y ${runnerUp!.thesisTitle} compiten (${leader.score} vs ${runnerUp!.score}): decide el manager.`,
    ];
    if (excludedThesisIds.length) {
      parts.push(`Excluidas ${excludedThesisIds.length} por score o límite.`);
    }
    return {
      signalId,
      eligibleThesisCount: eligibleTheses.length,
      perThesis: sorted,
      routingState: 'CONTESTED',
      source: 'AUTO',
      algorithmVersion: ROUTING_ALGORITHM_VERSION,
      // No selectedThesisId / primaryThesisId — contest unresolved.
      secondaryThesisId: runnerUp!.thesisId,
      excludedThesisIds,
      contested: true,
      rationale: parts.join(' '),
      routedAt,
    };
  }

  const parts = [
    `${leader.thesisTitle} reclama la señal con ${leader.score}${leader.matchedTerritory ? ` vía ${leader.matchedTerritory}` : ''}.`,
  ];
  if (runnerUp) {
    parts.push(`${runnerUp.thesisTitle} queda como secundaria con ${runnerUp.score}.`);
  }
  if (excludedThesisIds.length) {
    const blocked = sorted.filter((entry) =>
      entry.exclusionReason?.startsWith('Límite duro')
    );
    parts.push(
      blocked.length
        ? `Excluidas ${excludedThesisIds.length}, ${blocked.length} por límite duro.`
        : `Excluidas ${excludedThesisIds.length} por score bajo.`
    );
  }

  return {
    signalId,
    eligibleThesisCount: eligibleTheses.length,
    perThesis: sorted,
    routingState: 'CLEAR',
    source: 'AUTO',
    algorithmVersion: ROUTING_ALGORITHM_VERSION,
    selectedThesisId: leader.thesisId,
    primaryThesisId: leader.thesisId,
    secondaryThesisId: runnerUp?.thesisId,
    excludedThesisIds,
    contested: false,
    rationale: parts.join(' '),
    routedAt,
  };
}

/** Campos de la señal que se derivan del enrutado, listos para persistir. */
export function routingSignalPatch(
  routing: ThesisRoutingResult
): Pick<Signal, 'thesisId' | 'thesisScores'> {
  return {
    // Only CLEAR attributions write thesisId; CONTESTED/UNROUTED leave unset.
    thesisId: routing.selectedThesisId,
    thesisScores: routing.perThesis.map((entry) => ({
      thesisId: entry.thesisId,
      score: entry.score,
      band: entry.band,
    })),
  };
}

/** Project material decision fields for future history (Phase 3). */
export function toMaterialRoutingDecision(
  routing: ThesisRoutingResult
): MaterialRoutingDecision {
  return {
    routingState: routing.routingState,
    selectedThesisId: routing.selectedThesisId,
    source: routing.source,
    algorithmVersion: routing.algorithmVersion,
    rationale: routing.rationale,
  };
}
