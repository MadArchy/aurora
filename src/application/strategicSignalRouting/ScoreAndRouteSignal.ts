import type { Signal, StrategicScoreResult } from '../../types';
import {
  routeSignalAcrossTheses,
  routingSignalPatch,
  toMaterialRoutingDecision,
  type MaterialRoutingDecision,
  type ThesisRoutingResult,
} from '../../domain/thesisRoutingCore';
import {
  ROUTING_SYSTEM_ACTOR_ID,
  createRoutingHistoryEntry,
  isMaterialRoutingChange,
  toRoutingHistorySnapshot,
} from '../../domain/routingHistoryCore';
import { StrategicRoutingError } from './errors';
import { previousMaterialFromSignal } from './previousMaterial';
import { toPersistedRoutingDecision } from './persistedRoutingDecision';
import type { SignalReadPort } from './ports/SignalReadPort';
import type { SignalWritePort } from './ports/SignalWritePort';
import type { StrategicScoringPort } from './ports/StrategicScoringPort';
import type { ThesisQueryPort } from './ports/ThesisQueryPort';

export interface ScoreAndRouteSignalInput {
  signalId: string;
  clientId: string;
  /** Trusted organizationId from app/auth boundary — never invented. */
  organizationId: string;
  /** Optional clock for deterministic tests. */
  now?: string;
}

export interface ScoreAndRouteSignalResult {
  routing: ThesisRoutingResult;
  materialDecision: MaterialRoutingDecision;
  scoreResult: StrategicScoreResult;
  historyWritten: boolean;
}

export interface ScoreAndRouteSignalDeps {
  signals: SignalReadPort;
  theses: ThesisQueryPort;
  writer: SignalWritePort;
  scoring: StrategicScoringPort;
}

function assertTenant(signal: Signal, input: ScoreAndRouteSignalInput): void {
  if (signal.clientId !== input.clientId) {
    throw new StrategicRoutingError(
      'TENANT_CONTEXT_INVALID',
      'Signal clientId does not match routing context.'
    );
  }
  if (
    signal.organizationId &&
    input.organizationId &&
    signal.organizationId !== input.organizationId
  ) {
    throw new StrategicRoutingError(
      'TENANT_CONTEXT_INVALID',
      'Signal organizationId does not match routing context.'
    );
  }
}

/**
 * Build UI score snapshot from routing without strategic [0] attribution.
 * CLEAR → selected thesis score; CONTESTED → leading scored thesis for display only.
 */
function scoreSnapshotForRouting(
  signal: Signal,
  clientId: string,
  routing: ThesisRoutingResult,
  scoring: StrategicScoringPort,
  thesesById: Map<string, import('../../types').PositioningThesis>
): StrategicScoreResult {
  if (routing.routingState === 'CLEAR' && routing.selectedThesisId) {
    const thesis = thesesById.get(routing.selectedThesisId);
    if (thesis) {
      const score = scoring.scoreThesis(signal, thesis, clientId);
      if (routing.eligibleThesisCount > 1) {
        score.strategicRationale = `${score.strategicRationale} · ${routing.rationale}`;
      }
      return score;
    }
  }

  const leaderId = routing.perThesis[0]?.thesisId;
  const leader = leaderId ? thesesById.get(leaderId) : undefined;
  if (leader) {
    const score = scoring.scoreThesis(signal, leader, clientId);
    score.strategicRationale = `${score.strategicRationale} · ${routing.rationale}`;
    return score;
  }

  return {
    totalScore: 0,
    priorityBand: 'LOW',
    factors: {
      thesisMatch: 0,
      audienceMatch: 0,
      timeliness: 0,
      authorityFit: 0,
      differentiation: 0,
      strategicPotential: 0,
      commercialPotential: 0,
      sourceQuality: 0,
    },
    penalties: { evidenceGap: 0, risk: 0, staleness: 0, conflict: 0 },
    strategicRationale: routing.rationale,
    recommendedAction: 'NO_ACTION',
    scoringStatus: 'SCORED',
    calculatedAt: routing.routedAt,
  };
}

export function createScoreAndRouteSignal(deps: ScoreAndRouteSignalDeps) {
  return function scoreAndRouteSignal(
    input: ScoreAndRouteSignalInput
  ): ScoreAndRouteSignalResult {
    if (!input.clientId || !input.organizationId) {
      throw new StrategicRoutingError(
        'TENANT_CONTEXT_INVALID',
        'Trusted clientId and organizationId are required.'
      );
    }

    const signal = deps.signals.getSignalById(input.signalId);
    if (!signal) {
      throw new StrategicRoutingError('SIGNAL_NOT_FOUND', `Signal not found: ${input.signalId}`);
    }
    assertTenant(signal, input);

    const previous = previousMaterialFromSignal(signal);
    const theses = deps.theses.getThesesForClient(input.clientId);
    const scoreFn = deps.scoring.createScoreFn(input.clientId, signal);
    const routing = routeSignalAcrossTheses(signal, theses, scoreFn, {
      now: input.now,
    });

    const thesesById = new Map(theses.map((t) => [t.id, t]));
    const scoreResult = scoreSnapshotForRouting(
      signal,
      input.clientId,
      routing,
      deps.scoring,
      thesesById
    );

    const patch = routingSignalPatch(routing);
    const whyNow = deps.scoring.computeWhyNow(input.clientId, signal);
    const materialDecision = toMaterialRoutingDecision(routing);

    const routingDecision = toPersistedRoutingDecision({ ...routing, source: 'AUTO' });

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
        actorId: ROUTING_SYSTEM_ACTOR_ID,
        changedAt: routing.routedAt,
        rationale: routing.rationale,
      });
      historyWritten = true;
    }

    try {
      deps.writer.persistStrategicRouting({
        signalId: signal.id,
        clientId: input.clientId,
        organizationId: input.organizationId,
        routing,
        thesisId: patch.thesisId,
        thesisScores: patch.thesisScores ?? [],
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
        err instanceof Error ? err.message : 'Failed to persist strategic routing.'
      );
    }

    return {
      routing,
      materialDecision,
      scoreResult,
      historyWritten,
    };
  };
}
