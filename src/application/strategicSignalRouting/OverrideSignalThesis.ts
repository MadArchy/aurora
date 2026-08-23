import type { Signal, StrategicScoreResult, UserRole } from '../../types';
import {
  ROUTING_ALGORITHM_VERSION,
  toMaterialRoutingDecision,
  type MaterialRoutingDecision,
  type ThesisRoutingResult,
} from '../../domain/thesisRoutingCore';
import { isThesisEligibleForStrategicRouting } from '../../domain/thesisRoutingEligibility';
import {
  createRoutingHistoryEntry,
  isMaterialRoutingChange,
  toRoutingHistorySnapshot,
} from '../../domain/routingHistoryCore';
import { StrategicRoutingError } from './errors';
import { previousMaterialFromSignal } from './previousMaterial';
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
  historyWritten: boolean;
}

export interface OverrideSignalThesisDeps {
  signals: SignalReadPort;
  theses: ThesisQueryPort;
  writer: SignalWritePort;
  scoring: StrategicScoringPort;
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
    if (!input.actorId?.trim()) {
      throw new StrategicRoutingError(
        'UNAUTHORIZED_OVERRIDE',
        'Manual override requires a trusted actorId.'
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
    // Defense in depth — never trust a foreign thesis even if query port is poisoned.
    if (thesis.clientId && thesis.clientId !== input.clientId) {
      throw new StrategicRoutingError(
        'TENANT_CONTEXT_INVALID',
        'Thesis clientId does not match override context.'
      );
    }
    if (
      thesis.organizationId &&
      input.organizationId &&
      thesis.organizationId !== input.organizationId
    ) {
      throw new StrategicRoutingError(
        'TENANT_CONTEXT_INVALID',
        'Thesis organizationId does not match override context.'
      );
    }
    if (!isThesisEligibleForStrategicRouting(thesis)) {
      throw new StrategicRoutingError(
        'THESIS_NOT_ELIGIBLE',
        'Manual override may only select ACTIVE theses.'
      );
    }

    const previous = previousMaterialFromSignal(signal);
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

    const materialDecision = toMaterialRoutingDecision(routing);

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

    let historyEntry = undefined;
    let historyWritten = false;
    if (
      previous &&
      isMaterialRoutingChange(
        toRoutingHistorySnapshot(previous),
        toRoutingHistorySnapshot(materialDecision)
      )
    ) {
      historyEntry = createRoutingHistoryEntry({
        organizationId: input.organizationId,
        clientId: input.clientId,
        signalId: signal.id,
        previous: toRoutingHistorySnapshot(previous),
        next: toRoutingHistorySnapshot(materialDecision),
        actorId: input.actorId,
        changedAt: routedAt,
        rationale,
      });
      historyWritten = true;
    }

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
        historyEntry,
      });
    } catch (err) {
      if (err instanceof StrategicRoutingError) throw err;
      throw new StrategicRoutingError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to persist manual override.'
      );
    }

    return {
      routing,
      materialDecision,
      previous,
      scoreResult,
      historyWritten,
    };
  };
}
