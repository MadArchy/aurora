import type {
  PersistStrategicRoutingParams,
  RoutingHistoryPort,
  SignalReadPort,
  SignalWritePort,
  StrategicScoringPort,
  ThesisQueryPort,
  WhyNowSnapshot,
} from '../../application/strategicSignalRouting';
import type { ThesisScoreFn } from '../../domain/thesisRoutingCore';
import { clusterForSignal, clusterSimilarSignals, titleSimilarity } from '../../domain/signalClusterCore';
import { computeThesisStrength } from '../../domain/thesisStrengthCore';
import { computeWhyNow } from '../../domain/whyNowCore';
import { feedbackScoringHints } from '../../domain/radarFeedbackCore';
import { buildProfileKeywords } from '../../services/sourceDiscovery';
import { calculateStrategicScore, type ScoringContext } from '../../services/scoring';
import { dbService } from '../../services/db';
import type { PositioningThesis, Signal, StrategicScoreResult } from '../../types';

type DbFacade = typeof dbService;

/**
 * Transitional strangler adapter: Application sees only ports.
 * Concrete dbService stays behind this infrastructure boundary.
 *
 * Phase 3: current routing state syncs with Signal docs (existing SPEC-009 path).
 * Routing history is local-authoritative (`postura_signal_routing_history_v1`)
 * until SPEC-009 covers clients/{clientId}/signals/{signalId}/routingHistory/*.
 */
export function createDbStrategicSignalRoutingPorts(db: DbFacade = dbService): {
  signals: SignalReadPort;
  theses: ThesisQueryPort;
  writer: SignalWritePort;
  scoring: StrategicScoringPort;
  history: RoutingHistoryPort;
} {
  const signals: SignalReadPort = {
    getSignalById: (signalId) => db.getSignalById(signalId),
  };

  const theses: ThesisQueryPort = {
    /** Full client thesis set — Domain ACTIVE-only filter is authoritative. */
    getThesesForClient: (clientId) => db.getThesesByClient(clientId),
  };

  const writer: SignalWritePort = {
    persistStrategicRouting: (params: PersistStrategicRoutingParams) => {
      db.applyStrategicRoutingToSignal(params.signalId, params.scoreResult, {
        thesisId: params.thesisId,
        thesisScores: params.thesisScores,
        whyNow: params.whyNow,
        routingDecision: params.routingDecision,
        organizationId: params.organizationId,
        clientId: params.clientId,
        historyEntry: params.historyEntry,
      });
    },
  };

  const history: RoutingHistoryPort = {
    listHistoryForSignal: (signalId) => db.getSignalRoutingHistory(signalId),
  };

  function buildScoringContext(clientId: string): ScoringContext {
    const client = db.getClientById(clientId);
    if (!client) return {};
    // Merge keywords across ACTIVE theses — no strategic primary-thesis shortcut.
    const active = db.getActiveTheses(clientId);
    const keywordSets = active.length
      ? active.map((thesis) => buildProfileKeywords(client, thesis))
      : [buildProfileKeywords(client, undefined)];
    const coreEn = [...new Set(keywordSets.flatMap((k) => k.coreEn))];
    const coreEs = [...new Set(keywordSets.flatMap((k) => k.coreEs))];
    const dossier = db.getMasterDossier(clientId);
    const hints = feedbackScoringHints(
      db.getSignalsByClient(clientId),
      db.getSignalOutcomes(clientId)
    );
    return {
      bilingualTerms: [...coreEn, ...coreEs, ...hints.boostTerms],
      ownedTopics: dossier?.topicsToOwn,
      avoidedFramings: [...(dossier?.topicsToAvoid || []), ...hints.avoidTerms],
    };
  }

  function whyNowFor(signal: Signal, clientId: string): WhyNowSnapshot {
    const siblings = db.getSignalsByClient(clientId);
    const cluster = clusterForSignal(signal.id, clusterSimilarSignals(siblings));
    const clusterIds = new Set(cluster?.members.map((m) => m.signalId) || []);
    const priorCoverageCount = siblings.filter(
      (s) =>
        s.id !== signal.id &&
        clusterIds.has(s.id) &&
        (s.managerDecision === 'CONVERTED' || s.status === 'CONVERTED')
    ).length;
    const ownPublishedOnTopic = db
      .getContentByClient(clientId)
      .filter(
        (item) =>
          item.status === 'PUBLISHED' && titleSimilarity(item.title, signal.title) >= 0.25
      ).length;
    const result = computeWhyNow(signal, cluster, { ownPublishedOnTopic, priorCoverageCount });
    return { score: result.score, band: result.band, reason: result.reason };
  }

  function contextFor(
    clientId: string,
    signal: Signal,
    thesis: PositioningThesis
  ): ScoringContext {
    const whyNow = whyNowFor(signal, clientId);
    const evidence = db.getEvidenceVaultByClient(clientId);
    return {
      ...buildScoringContext(clientId),
      whyNow: { score: whyNow.score, reason: whyNow.reason },
      authorityScore: computeThesisStrength(thesis, evidence).authorityScore,
    };
  }

  const scoring: StrategicScoringPort = {
    createScoreFn(clientId: string, signal: Signal): ThesisScoreFn {
      return (s, thesis) =>
        calculateStrategicScore(s, thesis, contextFor(clientId, signal, thesis));
    },
    computeWhyNow(clientId: string, signal: Signal): WhyNowSnapshot {
      return whyNowFor(signal, clientId);
    },
    scoreThesis(
      signal: Signal,
      thesis: PositioningThesis,
      clientId: string
    ): StrategicScoreResult {
      return calculateStrategicScore(signal, thesis, contextFor(clientId, signal, thesis));
    },
  };

  return { signals, theses, writer, scoring, history };
}
