import type {
  PositioningThesis,
  PriorityBand,
  RecommendedAction,
  Signal,
  StrategicScoreResult,
} from '../types';

/**
 * Función de scoring inyectada. El core permanece puro: quien enruta decide qué
 * contexto (dossier, feedback) se aplica a cada tesis.
 */
export type ThesisScoreFn = (signal: Signal, thesis: PositioningThesis) => StrategicScoreResult;

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
  perThesis: ThesisRoutingScore[];
  primaryThesisId?: string;
  secondaryThesisId?: string;
  excludedThesisIds: string[];
  /** true cuando dos tesis se pelean la señal con scores casi iguales. */
  contested: boolean;
  rationale: string;
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

/**
 * Puntúa la señal contra todas las tesis y decide cuál la reclama.
 * Excluye las bloqueadas por límites duros y las que no llegan al mínimo.
 */
export function routeSignalAcrossTheses(
  signal: Signal,
  theses: PositioningThesis[],
  scoreFn: ThesisScoreFn
): ThesisRoutingResult {
  if (!theses.length) {
    return {
      perThesis: [],
      excludedThesisIds: [],
      contested: false,
      rationale: 'El cliente no tiene tesis activas: la señal no se puede enrutar.',
    };
  }

  const priorityOf = new Map(theses.map((t) => [t.id, t.priority ?? 0]));

  const perThesis: ThesisRoutingScore[] = theses.map((thesis) => {
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

  const sorted = perThesis.slice().sort((a, b) => {
    const byScore = b.score - a.score;
    if (byScore !== 0) return byScore;
    return (priorityOf.get(b.thesisId) ?? 0) - (priorityOf.get(a.thesisId) ?? 0);
  });

  const eligible = sorted.filter((entry) => !entry.exclusionReason);
  const excludedThesisIds = sorted.filter((entry) => entry.exclusionReason).map((entry) => entry.thesisId);

  if (!eligible.length) {
    const blocked = perThesis.filter((entry) => entry.exclusionReason?.startsWith('Límite duro')).length;
    return {
      perThesis: sorted,
      excludedThesisIds,
      contested: false,
      rationale: blocked
        ? `Ninguna tesis puede tomar esta señal: ${blocked} bloqueada${blocked === 1 ? '' : 's'} por límites duros.`
        : 'Ninguna tesis alcanza el mínimo de score para esta señal.',
    };
  }

  const primary = eligible[0];
  const secondary = eligible[1];
  const contested = Boolean(secondary && primary.score - secondary.score <= ROUTING_CONTEST_MARGIN);

  const parts = [
    `${primary.thesisTitle} reclama la señal con ${primary.score}${primary.matchedTerritory ? ` vía ${primary.matchedTerritory}` : ''}.`,
  ];
  if (secondary) {
    parts.push(
      contested
        ? `${secondary.thesisTitle} empata con ${secondary.score}: decide el manager.`
        : `${secondary.thesisTitle} queda como secundaria con ${secondary.score}.`
    );
  }
  if (excludedThesisIds.length) {
    const blocked = sorted.filter((entry) => entry.exclusionReason?.startsWith('Límite duro'));
    parts.push(
      blocked.length
        ? `Excluidas ${excludedThesisIds.length}, ${blocked.length} por límite duro.`
        : `Excluidas ${excludedThesisIds.length} por score bajo.`
    );
  }

  return {
    perThesis: sorted,
    primaryThesisId: primary.thesisId,
    secondaryThesisId: secondary?.thesisId,
    excludedThesisIds,
    contested,
    rationale: parts.join(' '),
  };
}

/** Campos de la señal que se derivan del enrutado, listos para persistir. */
export function routingSignalPatch(
  routing: ThesisRoutingResult
): Pick<Signal, 'thesisId' | 'thesisScores'> {
  return {
    thesisId: routing.primaryThesisId,
    thesisScores: routing.perThesis.map((entry) => ({
      thesisId: entry.thesisId,
      score: entry.score,
      band: entry.band,
    })),
  };
}
