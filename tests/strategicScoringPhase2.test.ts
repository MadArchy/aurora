import { describe, expect, it, vi } from 'vitest';
import {
  createRecomputeSignalScore,
  createScoreSignalAgainstRoutedContext,
  StrategicScoringError,
  type PersistGovernedScoreParams,
  type SignalReadPort,
  type StrategicScoringPort,
  type StrategicScoreWritePort,
  type ThesisQueryPort,
} from '../src/application/strategicScoring';
import { SCORING_VERSION } from '../src/domain/scoringCore';
import { computeStrategicScoreMaterial, toStrategicScoreResult } from '../src/domain/scoringCore';
import type { PositioningThesis, Signal, StrategicScoreResult } from '../src/types';

const NOW = '2026-08-23T22:00:00.000Z';
const FIXED_NOW = Date.parse(NOW);

function makeThesis(overrides: Partial<PositioningThesis> = {}): PositioningThesis {
  return {
    id: 'thesis_a',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'AI Governance',
    expertIdentity: 'Attorney',
    targetAudience: 'General Counsel',
    domain: 'AI regulation NIST governance',
    objective: 'Corporate advisory',
    proofPoints: ['Brief A', 'Brief B', 'Brief C', 'Brief D'],
    differentiator: 'Preventive approach',
    complianceRules: 'No guarantees',
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
    title: 'NIST AI framework update',
    contentSnippet: 'Enterprise AI governance compliance guidance',
    sourceName: 'NIST',
    sourceType: 'REGULATORY',
    sourceQuality: 'HIGH',
    fingerprint: 'fp_1',
    status: 'NEW',
    aiStatus: 'PENDING',
    managerDecision: 'UNREVIEWED',
    detectedAt: NOW,
    ...overrides,
  } as Signal;
}

function stubScore(overrides: Partial<StrategicScoreResult> = {}): StrategicScoreResult {
  return {
    totalScore: 72,
    priorityBand: 'HIGH',
    factors: {
      thesisMatch: 0.8,
      audienceMatch: 0.7,
      timeliness: 0.9,
      authorityFit: 0.6,
      differentiation: 0.72,
      strategicPotential: 0.75,
      commercialPotential: 0.5,
      sourceQuality: 1,
    },
    penalties: { evidenceGap: 0, risk: 0, staleness: 0, conflict: 0 },
    strategicRationale: 'stub score',
    recommendedAction: 'VIDEO',
    recommendedDisposition: 'SAVE',
    recommendedOutputFormat: 'VIDEO',
    scoringVersion: SCORING_VERSION,
    scoringStatus: 'SCORED',
    calculatedAt: NOW,
    ...overrides,
  };
}

function buildHarness(opts: {
  signal: Signal;
  theses: PositioningThesis[];
  scoreFn?: StrategicScoringPort['scoreThesis'];
  writer?: StrategicScoreWritePort;
}) {
  const writes: PersistGovernedScoreParams[] = [];
  const signals: SignalReadPort = {
    getSignalById: (id) => (id === opts.signal.id ? { ...opts.signal } : undefined),
  };
  const theses: ThesisQueryPort = {
    getThesesForClient: () => opts.theses,
  };
  const scoring: StrategicScoringPort = {
    createScoreFn: () => () => stubScore(),
    computeWhyNow: () => ({ score: 0.8, band: 'NOW', reason: 'test' }),
    scoreThesis: opts.scoreFn ?? (() => stubScore()),
  };
  const writer: StrategicScoreWritePort = opts.writer ?? {
    persistGovernedScore: (params) => {
      writes.push(params);
    },
  };
  const deps = { signals, theses, scoring, writer };
  return {
    writes,
    score: createScoreSignalAgainstRoutedContext(deps),
    recompute: createRecomputeSignalScore(deps),
    deps,
  };
}

describe('SPEC-002 Phase 2 — ScoreSignalAgainstRoutedContext', () => {
  const thesisA = makeThesis({ id: 'thesis_a' });
  const thesisB = makeThesis({ id: 'thesis_b', clientId: 'client_other' });

  it('CLEAR — scores routed thesis with scoring-v1 and no routing mutation', () => {
    const signal = makeSignal({
      routingDecision: { routingState: 'CLEAR', source: 'AUTO' },
      thesisId: 'thesis_a',
    });
    let scoredThesisId: string | undefined;
    const h = buildHarness({
      signal,
      theses: [thesisA],
      scoreFn: (_s, thesis) => {
        scoredThesisId = thesis.id;
        return stubScore();
      },
    });

    const result = h.score({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
    });

    expect(scoredThesisId).toBe('thesis_a');
    expect(result.routingState).toBe('CLEAR');
    expect(result.thesisId).toBe('thesis_a');
    expect(result.scoringVersion).toBe('scoring-v1');
    expect(result.recommendedDisposition).toBe('SAVE');
    expect(result.recommendedOutputFormat).toBe('VIDEO');
    expect(h.writes).toHaveLength(0);
  });

  it('CLEAR missing selection — fails with ROUTING_CONTEXT_INVALID', () => {
    const signal = makeSignal({
      routingDecision: { routingState: 'CLEAR', source: 'AUTO' },
      thesisId: undefined,
    });
    const h = buildHarness({ signal, theses: [thesisA] });

    expect(() =>
      h.score({ signalId: 'sig_1', clientId: 'client_test', organizationId: 'org_test' })
    ).toThrow(StrategicScoringError);

    try {
      h.score({ signalId: 'sig_1', clientId: 'client_test', organizationId: 'org_test' });
    } catch (err) {
      expect(err).toBeInstanceOf(StrategicScoringError);
      expect((err as StrategicScoringError).code).toBe('ROUTING_CONTEXT_INVALID');
    }
    expect(h.writes).toHaveLength(0);
  });

  it('CONTESTED — ignores stale thesisId A and fails closed', () => {
    const signal = makeSignal({
      routingDecision: { routingState: 'CONTESTED', source: 'AUTO', contested: true },
      thesisId: 'thesis_a',
      thesisScores: [
        { thesisId: 'thesis_a', score: 90, band: 'CRITICAL' },
        { thesisId: 'thesis_b', score: 88, band: 'HIGH' },
      ],
    });
    const h = buildHarness({ signal, theses: [thesisA] });

    try {
      h.score({ signalId: 'sig_1', clientId: 'client_test', organizationId: 'org_test' });
      expect.fail('expected contested error');
    } catch (err) {
      expect((err as StrategicScoringError).code).toBe('ROUTING_CONTEXT_CONTESTED');
    }
    expect(h.writes).toHaveLength(0);
  });

  it('UNROUTED — ignores stale thesisId and requires routing context', () => {
    const signal = makeSignal({
      routingDecision: { routingState: 'UNROUTED', source: 'AUTO' },
      thesisId: 'thesis_a',
    });
    const h = buildHarness({ signal, theses: [thesisA] });

    try {
      h.score({ signalId: 'sig_1', clientId: 'client_test', organizationId: 'org_test' });
      expect.fail('expected unrouted error');
    } catch (err) {
      expect((err as StrategicScoringError).code).toBe('ROUTING_CONTEXT_REQUIRED');
    }
    expect(h.writes).toHaveLength(0);
  });

  it('cross-client thesis — TENANT_CONTEXT_INVALID, no write', () => {
    const signal = makeSignal({
      routingDecision: { routingState: 'CLEAR', source: 'AUTO' },
      thesisId: 'thesis_b',
    });
    const h = buildHarness({ signal, theses: [thesisB] });

    try {
      h.score({ signalId: 'sig_1', clientId: 'client_test', organizationId: 'org_test' });
      expect.fail('expected tenant error');
    } catch (err) {
      expect((err as StrategicScoringError).code).toBe('TENANT_CONTEXT_INVALID');
    }
    expect(h.writes).toHaveLength(0);
  });

  it('stale thesisScores leader when CONTESTED — does not score implicit winner', () => {
    const signal = makeSignal({
      routingDecision: { routingState: 'CONTESTED', source: 'AUTO' },
      thesisId: 'thesis_a',
      thesisScores: [{ thesisId: 'thesis_a', score: 95, band: 'CRITICAL' }],
    });
    const scoreSpy = vi.fn(() => stubScore());
    const h = buildHarness({
      signal,
      theses: [thesisA],
      scoreFn: scoreSpy,
    });

    expect(() =>
      h.score({ signalId: 'sig_1', clientId: 'client_test', organizationId: 'org_test' })
    ).toThrow(StrategicScoringError);
    expect(scoreSpy).not.toHaveBeenCalled();
  });

  it('LOW score — returns recommendation without terminal DISCARD side effect', () => {
    const signal = makeSignal({
      routingDecision: { routingState: 'CLEAR', source: 'AUTO' },
      thesisId: 'thesis_a',
    });
    const h = buildHarness({
      signal,
      theses: [thesisA],
      scoreFn: () =>
        stubScore({
          totalScore: 15,
          priorityBand: 'LOW',
          recommendedAction: 'NO_ACTION',
          recommendedDisposition: 'NO_ACTION',
          recommendedOutputFormat: 'NONE',
        }),
    });

    const result = h.score({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      persist: true,
    });

    expect(result.scoreResult.priorityBand).toBe('LOW');
    expect(result.scoreResult.recommendedDisposition).toBe('NO_ACTION');
    expect(h.writes).toHaveLength(1);
    expect(h.writes[0].scoreResult.totalScore).toBe(15);
    expect(signal.status).toBe('NEW');
  });

  it('deterministic — identical material inputs produce identical governed result', () => {
    const signal = makeSignal({
      routingDecision: { routingState: 'CLEAR', source: 'AUTO' },
      thesisId: 'thesis_a',
    });
    const domainScore = () => {
      const material = computeStrategicScoreMaterial({
        signal,
        thesis: thesisA,
        context: { whyNow: { score: 0.9, reason: 'Regulatory window' } },
        nowMs: FIXED_NOW,
      });
      return toStrategicScoreResult(material, NOW);
    };
    const h = buildHarness({
      signal,
      theses: [thesisA],
      scoreFn: domainScore,
    });

    const a = h.score({ signalId: 'sig_1', clientId: 'client_test', organizationId: 'org_test' });
    const b = h.recompute({ signalId: 'sig_1', clientId: 'client_test', organizationId: 'org_test' });

    expect(b.scoreResult).toEqual(a.scoreResult);
    expect(b.scoringVersion).toBe('scoring-v1');
  });

  it('optional persist — writes only when persist=true and no write on failure paths', () => {
    const signal = makeSignal({
      routingDecision: { routingState: 'CLEAR', source: 'AUTO' },
      thesisId: 'thesis_a',
    });
    const h = buildHarness({ signal, theses: [thesisA] });

    h.score({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      persist: true,
    });
    expect(h.writes).toHaveLength(1);
    expect(h.writes[0].scoreResult.scoringVersion).toBe('scoring-v1');
  });

  it('persistence failure — surfaces PERSISTENCE_ERROR', () => {
    const signal = makeSignal({
      routingDecision: { routingState: 'CLEAR', source: 'AUTO' },
      thesisId: 'thesis_a',
    });
    const h = buildHarness({
      signal,
      theses: [thesisA],
      writer: {
        persistGovernedScore: () => {
          throw new Error('disk full');
        },
      },
    });

    try {
      h.score({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_test',
        persist: true,
      });
      expect.fail('expected persistence error');
    } catch (err) {
      expect((err as StrategicScoringError).code).toBe('PERSISTENCE_ERROR');
    }
  });

  it('SIGNAL_NOT_FOUND — controlled error', () => {
    const h = buildHarness({
      signal: makeSignal(),
      theses: [thesisA],
    });
    try {
      h.score({ signalId: 'missing', clientId: 'client_test', organizationId: 'org_test' });
      expect.fail('expected not found');
    } catch (err) {
      expect((err as StrategicScoringError).code).toBe('SIGNAL_NOT_FOUND');
    }
  });

  it('preserves separate disposition and output format in governed result', () => {
    const signal = makeSignal({
      routingDecision: { routingState: 'CLEAR', source: 'AUTO' },
      thesisId: 'thesis_a',
    });
    const h = buildHarness({
      signal,
      theses: [thesisA],
      scoreFn: () =>
        stubScore({
          recommendedDisposition: 'SAVE',
          recommendedOutputFormat: 'SHORT_POST',
          recommendedAction: 'SHORT_POST',
        }),
    });

    const result = h.score({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
    });

    expect(result.recommendedDisposition).toBe('SAVE');
    expect(result.recommendedOutputFormat).toBe('SHORT_POST');
  });
});
