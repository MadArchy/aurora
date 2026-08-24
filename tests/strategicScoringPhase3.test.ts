import { describe, expect, it } from 'vitest';
import {
  createRecomputeSignalScore,
  createScoreSignalAgainstRoutedContext,
  StrategicScoringError,
  type PersistGovernedScoreParams,
  type ScoreHistoryPort,
  type SignalReadPort,
  type StrategicScoringPort,
  type StrategicScoreWritePort,
  type ThesisQueryPort,
} from '../src/application/strategicScoring';
import { SCORING_VERSION } from '../src/domain/scoringCore';
import type { SignalScoreHistoryEntry } from '../src/domain/scoreHistoryCore';
import type { PositioningThesis, Signal, StrategicScoreResult } from '../src/types';

const NOW = '2026-08-23T23:00:00.000Z';
const LATER = '2026-08-23T23:05:00.000Z';

function makeThesis(overrides: Partial<PositioningThesis> = {}): PositioningThesis {
  return {
    id: 'thesis_a',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'AI Governance',
    expertIdentity: 'Attorney',
    targetAudience: 'GC',
    domain: 'Legal AI',
    objective: 'Business',
    proofPoints: ['a', 'b', 'c', 'd'],
    status: 'ACTIVE',
    createdAt: NOW,
    createdBy: 'system',
    updatedAt: NOW,
    updatedBy: 'system',
    ...overrides,
  };
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig_1',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'Signal',
    contentSnippet: 'snippet',
    sourceName: 'Source',
    sourceType: 'REGULATORY',
    sourceQuality: 'HIGH',
    fingerprint: 'fp',
    status: 'NEW',
    aiStatus: 'PENDING',
    managerDecision: 'UNREVIEWED',
    detectedAt: NOW,
    routingDecision: { routingState: 'CLEAR', source: 'AUTO', algorithmVersion: 'routing-v1' },
    thesisId: 'thesis_a',
    ...overrides,
  } as Signal;
}

function score(total: number, overrides: Partial<StrategicScoreResult> = {}): StrategicScoreResult {
  return {
    totalScore: total,
    priorityBand: total >= 85 ? 'CRITICAL' : total >= 70 ? 'HIGH' : total >= 40 ? 'MEDIUM' : 'LOW',
    factors: {
      thesisMatch: 0.6,
      audienceMatch: 0.5,
      timeliness: 0.7,
      authorityFit: 0.5,
      differentiation: 0.72,
      strategicPotential: 0.55,
      commercialPotential: 0.4,
      sourceQuality: 0.8,
    },
    penalties: { evidenceGap: 0, risk: 0, staleness: 0, conflict: 0 },
    strategicRationale: `score ${total}`,
    recommendedAction: total < 40 ? 'NO_ACTION' : total >= 70 ? 'VIDEO' : 'MONITOR',
    recommendedDisposition: total < 40 ? 'NO_ACTION' : total >= 70 ? 'SAVE' : 'MONITOR',
    recommendedOutputFormat: total >= 70 ? 'VIDEO' : 'NONE',
    scoringVersion: SCORING_VERSION,
    scoringStatus: 'SCORED',
    calculatedAt: NOW,
    ...overrides,
  };
}

function buildHarness(opts: {
  signal: Signal;
  theses: PositioningThesis[];
  scores?: StrategicScoreResult[];
  failPersist?: boolean;
}) {
  const store = { signal: { ...opts.signal } };
  const history: SignalScoreHistoryEntry[] = [];
  const writes: PersistGovernedScoreParams[] = [];
  let scoreIdx = 0;
  const scoreQueue = opts.scores ?? [score(72)];

  const signals: SignalReadPort = {
    getSignalById: (id) => (id === store.signal.id ? { ...store.signal } : undefined),
  };
  const theses: ThesisQueryPort = {
    getThesesForClient: () => opts.theses,
  };
  const scoring: StrategicScoringPort = {
    createScoreFn: () => () => score(72),
    computeWhyNow: () => ({ score: 0.8, band: 'NOW', reason: 'test' }),
    scoreThesis: () => scoreQueue[Math.min(scoreIdx++, scoreQueue.length - 1)],
  };

  const writer: StrategicScoreWritePort = {
    persistGovernedScore: (params) => {
      if (opts.failPersist) throw new Error('simulated persist failure');
      if (params.clientId !== store.signal.clientId) {
        throw new Error('Governed score tenant mismatch: clientId');
      }
      if (params.organizationId !== store.signal.organizationId) {
        throw new Error('Governed score tenant mismatch: organizationId');
      }
      writes.push(params);
      if (params.historyEntry) history.push(params.historyEntry);
      const s = params.scoreResult;
      store.signal.relevanceScore = s.totalScore;
      store.signal.priorityBand = s.priorityBand;
      store.signal.scoringVersion = s.scoringVersion;
      store.signal.recommendedDisposition = s.recommendedDisposition;
      store.signal.recommendedOutputFormat = s.recommendedOutputFormat;
      store.signal.scoreFactors = { ...s.factors };
      store.signal.scorePenalties = { ...s.penalties };
      store.signal.scoredAt = params.changedAt;
      store.signal.scoreRoutedThesisId = params.routingContext.routedThesisId;
    },
  };

  const historyPort: ScoreHistoryPort = {
    listHistoryForSignal: (signalId) => history.filter((h) => h.signalId === signalId),
  };

  const deps = { signals, theses, scoring, writer };
  return {
    store,
    history,
    writes,
    score: createScoreSignalAgainstRoutedContext(deps),
    recompute: createRecomputeSignalScore(deps),
    historyPort,
  };
}

describe('SPEC-002 Phase 3 — governed score persistence', () => {
  const thesis = makeThesis();

  it('initial score persists current state without history (Policy A)', () => {
    const h = buildHarness({
      signal: makeSignal(),
      theses: [thesis],
      scores: [score(63)],
    });
    const result = h.score({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      persist: true,
      now: NOW,
    });
    expect(result.persisted).toBe(true);
    expect(result.historyWritten).toBe(false);
    expect(h.history).toHaveLength(0);
    expect(h.store.signal.relevanceScore).toBe(63);
    expect(h.store.signal.scoringVersion).toBe('scoring-v1');
    expect(h.store.signal.scoreRoutedThesisId).toBe('thesis_a');
  });

  it('score change 55 → 75 writes material history', () => {
    const h = buildHarness({
      signal: makeSignal({ relevanceScore: 55, priorityBand: 'MEDIUM', scoringVersion: SCORING_VERSION }),
      theses: [thesis],
      scores: [score(75)],
    });
    h.store.signal.scoreFactors = score(55).factors;
    h.store.signal.scorePenalties = score(55).penalties;
    h.store.signal.scoreRoutedThesisId = 'thesis_a';

    const result = h.score({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      persist: true,
      now: LATER,
    });

    expect(result.historyWritten).toBe(true);
    expect(h.history).toHaveLength(1);
    expect(h.history[0].previous.totalScore).toBe(55);
    expect(h.history[0].next.totalScore).toBe(75);
    expect(h.store.signal.relevanceScore).toBe(75);
  });

  it('band boundary 69 → 70 creates material history', () => {
    const h = buildHarness({
      signal: makeSignal({
        relevanceScore: 69,
        priorityBand: 'MEDIUM',
        scoringVersion: SCORING_VERSION,
        scoreFactors: score(69).factors,
        scorePenalties: score(69).penalties,
        scoreRoutedThesisId: 'thesis_a',
      }),
      theses: [thesis],
      scores: [score(70)],
    });

    h.score({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      persist: true,
      now: LATER,
    });

    expect(h.history[0].previous.priorityBand).toBe('MEDIUM');
    expect(h.history[0].next.priorityBand).toBe('HIGH');
  });

  it('timestamp-only equivalent rescore does not grow history', () => {
    const h = buildHarness({
      signal: makeSignal({
        relevanceScore: 63,
        priorityBand: 'MEDIUM',
        scoringVersion: SCORING_VERSION,
        recommendedDisposition: 'MONITOR',
        recommendedOutputFormat: 'NONE',
        scoreFactors: score(63).factors,
        scorePenalties: score(63).penalties,
        scoreRoutedThesisId: 'thesis_a',
        scoredAt: NOW,
      }),
      theses: [thesis],
      scores: [score(63)],
    });

    h.recompute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      persist: true,
      now: LATER,
    });

    expect(h.history).toHaveLength(0);
    expect(h.store.signal.scoredAt).toBe(LATER);
  });

  it('cross-client persist rejected — zero writes', () => {
    const h = buildHarness({
      signal: makeSignal({ clientId: 'client_A', organizationId: 'org_A', thesisId: 'thesis_b' }),
      theses: [makeThesis({ clientId: 'client_B', organizationId: 'org_B', id: 'thesis_b' })],
    });

    expect(() =>
      h.score({
        signalId: 'sig_1',
        clientId: 'client_B',
        organizationId: 'org_B',
        persist: true,
      })
    ).toThrow(StrategicScoringError);
    expect(h.writes).toHaveLength(0);
    expect(h.history).toHaveLength(0);
  });

  it('cross-org persist rejected', () => {
    const h = buildHarness({
      signal: makeSignal({ organizationId: 'org_A' }),
      theses: [thesis],
    });

    expect(() =>
      h.score({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_B',
        persist: true,
      })
    ).toThrow(StrategicScoringError);
    expect(h.writes).toHaveLength(0);
  });

  it('LOW score persists without DISCARD', () => {
    const h = buildHarness({
      signal: makeSignal(),
      theses: [thesis],
      scores: [score(15)],
    });
    h.score({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      persist: true,
      now: NOW,
    });
    expect(h.store.signal.status).toBe('NEW');
    expect(h.store.signal.managerDecision).toBe('UNREVIEWED');
    expect(h.store.signal.relevanceScore).toBe(15);
  });

  it('does not mutate routing fields on score persist', () => {
    const routingBefore = {
      routingState: 'CLEAR' as const,
      source: 'AUTO' as const,
      algorithmVersion: 'routing-v1',
    };
    const h = buildHarness({
      signal: makeSignal({ routingDecision: { ...routingBefore }, thesisId: 'thesis_a' }),
      theses: [thesis],
      scores: [score(80)],
    });

    h.score({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      persist: true,
      now: NOW,
    });

    expect(h.store.signal.routingDecision?.routingState).toBe(routingBefore.routingState);
    expect(h.store.signal.thesisId).toBe('thesis_a');
  });

  it('persistence failure surfaces PERSISTENCE_ERROR', () => {
    const h = buildHarness({
      signal: makeSignal(),
      theses: [thesis],
      failPersist: true,
    });
    expect(() =>
      h.score({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_test',
        persist: true,
      })
    ).toThrow(StrategicScoringError);
  });

  it('serialization round-trip preserves scoringVersion and factors', () => {
    const h = buildHarness({
      signal: makeSignal(),
      theses: [thesis],
      scores: [score(72)],
    });
    h.score({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      persist: true,
      now: NOW,
    });
    expect(h.store.signal.scoringVersion).toBe('scoring-v1');
    expect(h.store.signal.scoreFactors?.thesisMatch).toBe(0.6);
    expect(h.store.signal.recommendedDisposition).toBe('SAVE');
    expect(h.store.signal.recommendedOutputFormat).toBe('VIDEO');
  });
});

describe('SPEC-002 Phase 3 — db local atomic score writer', () => {
  it('applyGovernedScoreToSignal and score history storage exist', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/services/db.ts', 'utf8')
    );
    expect(src).toMatch(/applyGovernedScoreToSignal/);
    expect(src).toMatch(/signalScoreHistory/);
    expect(src).toMatch(/postura_signal_score_history_v1/);
    expect(src).toMatch(/getSignalScoreHistory/);
  });
});
