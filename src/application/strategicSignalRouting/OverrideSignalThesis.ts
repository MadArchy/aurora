import type { Signal, StrategicScoreResult, UserRole } from '../../types';
import {
  ROUTING_ALGORITHM_VERSION,
  toMaterialRoutingDecision,
  type MaterialRoutingDecision,
  type ThesisRoutingResult,
} from '../../domain/thesisRoutingCore';
import { isThesisEligibleForStrategicRouting } from '../../domain/thesisRoutingEligibility';
import { StrategicRoutingError } from './errors';
import type { SignalReadPort } from './ports/SignalReadPort';
import type { SignalWritePort } from './ports/SignalWritePort';
import type { StrategicScoringPort } from './ports/StrategicScoringPort';
import type { ThesisQueryPort } from './ports/ThesisQueryPort';

export interface OverrideSignalThesisInput {
  signalId: string;
  clientId: string;
  organizationId: string;
  selectedThesisId: string;
  /** Neutral actor id — not Firebase User. */
  actorId: string;
  /** Trusted role from auth boundary. */
  actorRole: UserRole;
  rationale?: string;
  now?: string;
}

export interface OverrideSignalThesisResult {
  routing: ThesisRoutingResult;
  materialDecision: MaterialRoutingDecision;
  previous?: MaterialRoutingDecision;
  scoreResult: StrategicScoreResult;
}

export interface OverrideSignalThesisDeps {
  signals: SignalReadPort;
  theses: ThesisQueryPort;
  writer: SignalWritePort;
  scoring: StrategicScoringPort;
}

function previousFromSignal(signal: Signal): MaterialRoutingDecision | undefined {
  const rd = signal.routingDecision;
  if (!rd?.routingState && !rd?.source && !signal.thesisId) return undefined;
  return {
    routingState: rd?.routingState ?? (signal.thesisId ? 'CLEAR' : 'UNROUTED'),
    selectedThesisId: signal.thesisId,
    source: rd?.source ?? 'AUTO',
    algorithmVersion: (rd?.algorithmVersion as typeof ROUTING_ALGORITHM_VERSION) || ROUTING_ALGORITHM_VERSION,
    rationale: rd?.rationale ?? signal.scoreRationale ?? '',
  };
}

/**
 * Manager MANUAL resolution of strategic attribution.
 * Eligible override targets: ACTIVE theses only (SPEC-001 production policy).
 */
export function createOverrideSignalThesis(deps: OverrideSignalThesisDeps) {
  return function overrideSignalThesis(
    input: OverrideSignalThesisInput
  ): OverrideSignalThesisResult {
    if (!input.clientId || !input.organizationId) {
      throw new StrategicRoutingError(
        'TENANT_CONTEXT_INVALID',
        'Trusted clientId and organizationId are required.'
      );
    }
    if (input.actorRole !== 'ADMIN') {
      throw new StrategicRoutingError(
        'UNAUTHORIZED_OVERRIDE',
        'Manual thesis override requires ADMIN role.'
      );
    }

    const signal = deps.signals.getSignalById(input.signalId);
    if (!signal) {
      throw new StrategicRoutingError('SIGNAL_NOT_FOUND', `Signal not found: ${input.signalId}`);
    }
    if (signal.clientId !== input.clientId) {
      throw new StrategicRoutingError(
        'TENANT_CONTEXT_INVALID',
        'Signal clientId does not match override context.'
      );
    }
    if (signal.organizationId && signal.organizationId !== input.organizationId) {
      throw new StrategicRoutingError(
        'TENANT_CONTEXT_INVALID',
        'Signal organizationId does not match override context.'
      );
    }

    const theses = deps.theses.getThesesForClient(input.clientId);
    const thesis = theses.find((t) => t.id === input.selectedThesisId);
    if (!thesis) {
      throw new StrategicRoutingError(
        'THESIS_NOT_FOUND',
        `Thesis not found for client: ${input.selectedThesisId}`
      );
    }
    if (!isThesisEligibleForStrategicRouting(thesis)) {
      throw new StrategicRoutingError(
        'THESIS_NOT_ELIGIBLE',
        'Manual override may only select ACTIVE theses.'
      );
    }

    const previous = previousFromSignal(signal);
    const routedAt = input.now ?? new Date().toISOString();
    const scoreResult = deps.scoring.scoreThesis(signal, thesis, input.clientId);
    const whyNow = deps.scoring.computeWhyNow(input.clientId, signal);

    const rationale =
      input.rationale?.trim() ||
      `Override manual: señal asignada a «${thesis.title}» por ${input.actorId}.`;

    // Preserve prior multi-thesis evidence; do not erase perThesis scores.
    const thesisScores =
      signal.thesisScores && signal.thesisScores.length > 0
        ? signal.thesisScores
        : [{ thesisId: thesis.id, score: scoreResult.totalScore, band: scoreResult.priorityBand }];

    const routing: ThesisRoutingResult = {
      signalId: signal.id,
      eligibleThesisCount: theses.filter(isThesisEligibleForStrategicRouting).length,
      perThesis: thesisScores.map((entry) => ({
        thesisId: entry.thesisId,
        thesisTitle:
          theses.find((t) => t.id === entry.thesisId)?.title || entry.thesisId,
        score: entry.score,
        band: entry.band,
        recommendedAction: scoreResult.recommendedAction,
      })),
      routingState: 'CLEAR',
      source: 'MANUAL',
      algorithmVersion: ROUTING_ALGORITHM_VERSION,
      selectedThesisId: thesis.id,
      primaryThesisId: thesis.id,
      secondaryThesisId: signal.routingDecision?.secondaryThesisId,
      excludedThesisIds: [],
      contested: false,
      rationale,
      routedAt,
    };

    const routingDecision: NonNullable<Signal['routingDecision']> = {
      contested: false,
      secondaryThesisId: routing.secondaryThesisId,
      source: 'MANUAL',
      routingState: 'CLEAR',
      algorithmVersion: ROUTING_ALGORITHM_VERSION,
      rationale,
      actorId: input.actorId,
      routedAt,
    };

    try {
      deps.writer.persistStrategicRouting({
        signalId: signal.id,
        clientId: input.clientId,
        organizationId: input.organizationId,
        routing,
        thesisId: thesis.id,
        thesisScores,
        routingDecision,
        whyNow: {
          score: whyNow.score,
          band: whyNow.band,
          reason: whyNow.reason,
        },
        scoreResult,
      });
    } catch (err) {
      throw new StrategicRoutingError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to persist manual override.'
      );
    }

    return {
      routing,
      materialDecision: toMaterialRoutingDecision(routing),
      previous,
      scoreResult,
    };
  };
}
