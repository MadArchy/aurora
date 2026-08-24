import { describe, expect, it } from 'vitest';
import {
  createOverrideSignalThesis,
  createScoreAndRouteSignal,
  StrategicRoutingError,
  type PersistStrategicRoutingParams,
  type SignalReadPort,
  type SignalWritePort,
  type StrategicScoringPort,
  type ThesisQueryPort,
} from '../src/application/strategicSignalRouting';
import {
  ROUTING_ALGORITHM_VERSION,
  ROUTING_CONTEST_MARGIN,
} from '../src/domain/thesisRoutingCore';
import type {
  PositioningThesis,
  Signal,
  StrategicScoreResult,
  ThesisStatus,
} from '../src/types';

const NOW = '2026-08-23T22:00:00.000Z';

function makeThesis(overrides: Partial<PositioningThesis>): PositioningThesis {
  return {
    id: 'thesis_x',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'Tesis',
    expertIdentity: 'Attorney',
    targetAudience: 'GC',
    domain: 'Legal',
    objective: 'Business',
    proofPoints: [],
    voiceAndTone: '',
    complianceRules: '',
    status: 'ACTIVE',
    clientApprovalStatus: 'APPROVED',
    createdAt: NOW,
    createdBy: 'system',
    updatedAt: NOW,
    updatedBy: 'system',
    priority: 50,
    ...overrides,
  };
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig_1',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'Signal title',
    contentSnippet: 'snippet',
    sourceName: 'Source',
    sourceType: 'REGULATORY',
    sourceQuality: 'HIGH',
    fingerprint: 'fp',
    status: 'NEW',
    aiStatus: 'PENDING',
    managerDecision: 'UNREVIEWED',
    detectedAt: NOW,
    ...overrides,
  } as Signal;
}

function stubScore(total: number): StrategicScoreResult {
  return {
    totalScore: total,
    priorityBand: total >= 70 ? 'HIGH' : total < 40 ? 'LOW' : 'MEDIUM',
    factors: {
      thesisMatch: 0.5,
      audienceMatch: 0.5,
      timeliness: 0.5,
      authorityFit: 0.5,
      differentiation: 0.5,
      strategicPotential: 0.5,
      commercialPotential: 0.5,
      sourceQuality: 0.5,
    },
    penalties: { evidenceGap: 0, risk: 0, staleness: 0, conflict: 0 },
    strategicRationale: `score ${total}`,
    recommendedAction: total < 40 ? 'NO_ACTION' : 'SAVE',
    scoringStatus: 'SCORED',
    calculatedAt: NOW,
  };
}

function buildHarness(opts: {
  signal: Signal;
  theses: PositioningThesis[];
  scores: Record<string, number>;
}) {
  const writes: PersistStrategicRoutingParams[] = [];
  const signals: SignalReadPort = {
    getSignalById: (id) => (id === opts.signal.id ? { ...opts.signal } : undefined),
  };
  const theses: ThesisQueryPort = {
    getThesesForClient: (clientId) =>
      opts.theses.filter((t) => t.clientId === clientId),
  };
  const writer: SignalWritePort = {
    persistStrategicRouting: (params) => {
      writes.push(params);
    },
  };
  const scoring: StrategicScoringPort = {
    createScoreFn: () => (_s, thesis) => stubScore(opts.scores[thesis.id] ?? 0),
    computeWhyNow: () => ({ score: 50, band: 'SOON', reason: 'stub why' }),
    scoreThesis: (_s, thesis) => stubScore(opts.scores[thesis.id] ?? 0),
  };

  const scoreAndRoute = createScoreAndRouteSignal({ signals, theses, writer, scoring });
  const override = createOverrideSignalThesis({ signals, theses, writer, scoring });

  return { scoreAndRoute, override, writes, signals };
}

describe('SPEC-001 Phase 2 — ScoreAndRouteSignal', () => {
  const a = makeThesis({ id: 'thesis_a', title: 'A', priority: 90 });
  const b = makeThesis({ id: 'thesis_b', title: 'B', priority: 70 });

  it('CLEAR: selects from scores, persists CLEAR, no primary helper', () => {
    const { scoreAndRoute, writes } = buildHarness({
      signal: makeSignal(),
      theses: [b, a],
      scores: { thesis_a: 88, thesis_b: 61 },
    });

    const result = scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: NOW,
    });

    expect(result.routing.routingState).toBe('CLEAR');
    expect(result.routing.selectedThesisId).toBe('thesis_a');
    expect(writes).toHaveLength(1);
    expect(writes[0].thesisId).toBe('thesis_a');
    expect(writes[0].routingDecision.routingState).toBe('CLEAR');
    expect(writes[0].routingDecision.selectedThesisId).toBe('thesis_a');
    expect(writes[0].routingDecision.source).toBe('AUTO');
    expect(writes[0].scoreResult.recommendedAction).not.toBeUndefined();
  });

  it('CONTESTED: no selected thesis and no [0] attribution', () => {
    const { scoreAndRoute, writes } = buildHarness({
      signal: makeSignal(),
      theses: [a, b],
      scores: { thesis_a: 76, thesis_b: 76 - ROUTING_CONTEST_MARGIN },
    });

    const result = scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: NOW,
    });

    expect(result.routing.routingState).toBe('CONTESTED');
    expect(result.routing.selectedThesisId).toBeUndefined();
    expect(writes[0].thesisId).toBeUndefined();
    expect(writes[0].routingDecision.routingState).toBe('CONTESTED');
    expect(writes[0].routingDecision.selectedThesisId).toBeUndefined();
    expect(writes[0].thesisScores).toHaveLength(2);
  });

  it('UNROUTED: zero eligible ACTIVE — no selection, no throw', () => {
    const inactive: Array<[string, ThesisStatus]> = [
      ['d', 'DRAFT'],
      ['l', 'LEGACY'],
      ['p', 'PAUSED'],
    ];
    const { scoreAndRoute, writes } = buildHarness({
      signal: makeSignal(),
      theses: inactive.map(([id, status]) => makeThesis({ id, status })),
      scores: { d: 99, l: 99, p: 99 },
    });

    const result = scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: NOW,
    });

    expect(result.routing.routingState).toBe('UNROUTED');
    expect(result.routing.selectedThesisId).toBeUndefined();
    expect(writes[0].thesisId).toBeUndefined();
    expect(writes[0].routingDecision.routingState).toBe('UNROUTED');
    expect(writes[0].routingDecision.selectedThesisId).toBeUndefined();
  });

  it('evaluates only ACTIVE theses when query returns mixed statuses', () => {
    const theses = [
      makeThesis({ id: 'active_a', status: 'ACTIVE', priority: 80 }),
      makeThesis({ id: 'paused_b', status: 'PAUSED', priority: 99 }),
      makeThesis({ id: 'active_c', status: 'ACTIVE', priority: 60 }),
      makeThesis({ id: 'legacy_d', status: 'LEGACY', priority: 99 }),
    ];
    const { scoreAndRoute, writes } = buildHarness({
      signal: makeSignal(),
      theses,
      scores: { active_a: 70, paused_b: 99, active_c: 55, legacy_d: 99 },
    });

    const result = scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: NOW,
    });

    expect(result.routing.eligibleThesisCount).toBe(2);
    expect(result.routing.perThesis.map((p) => p.thesisId).sort()).toEqual([
      'active_a',
      'active_c',
    ]);
    expect(writes[0].thesisScores?.every((s) => s.thesisId !== 'paused_b')).toBe(true);
    expect(writes[0].thesisScores?.every((s) => s.thesisId !== 'legacy_d')).toBe(true);
  });

  it('low score does NOT persist terminal DISCARD from routing use case', () => {
    const { scoreAndRoute, writes } = buildHarness({
      signal: makeSignal(),
      theses: [a],
      scores: { thesis_a: 10 },
    });

    scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: NOW,
    });

    expect(writes[0].scoreResult.totalScore).toBe(10);
    expect(writes[0].scoreResult.recommendedAction).toBe('NO_ACTION');
    // Writer contract: no status/DISCARD fields — only routing payload.
    expect(Object.keys(writes[0])).not.toContain('status');
    expect(writes[0].routing.routingState).toBe('UNROUTED');
  });

  it('repeated execution yields same material routing fields', () => {
    const { scoreAndRoute } = buildHarness({
      signal: makeSignal(),
      theses: [a, b],
      scores: { thesis_a: 88, thesis_b: 50 },
    });
    const input = {
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: NOW,
    };
    const r1 = scoreAndRoute(input);
    const r2 = scoreAndRoute({ ...input, now: '2026-08-23T23:00:00.000Z' });

    expect(r2.routing.routingState).toBe(r1.routing.routingState);
    expect(r2.routing.selectedThesisId).toBe(r1.routing.selectedThesisId);
    expect(r2.routing.perThesis.map((p) => ({ id: p.thesisId, score: p.score }))).toEqual(
      r1.routing.perThesis.map((p) => ({ id: p.thesisId, score: p.score }))
    );
    expect(r2.routing.algorithmVersion).toBe(ROUTING_ALGORITHM_VERSION);
    expect(r1.routing.algorithmVersion).toBe(ROUTING_ALGORITHM_VERSION);
  });

  it('persistence failure becomes PERSISTENCE_ERROR — no fake success', () => {
    const signals: SignalReadPort = {
      getSignalById: () => makeSignal(),
    };
    const theses: ThesisQueryPort = {
      getThesesForClient: () => [a],
    };
    const writer: SignalWritePort = {
      persistStrategicRouting: () => {
        throw new Error('disk full');
      },
    };
    const scoring: StrategicScoringPort = {
      createScoreFn: () => () => stubScore(80),
      computeWhyNow: () => ({ score: 1, band: 'NOW', reason: 'x' }),
      scoreThesis: () => stubScore(80),
    };
    const scoreAndRoute = createScoreAndRouteSignal({ signals, theses, writer, scoring });

    expect(() =>
      scoreAndRoute({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_test',
        now: NOW,
      })
    ).toThrow(StrategicRoutingError);
  });
});

describe('SPEC-001 Phase 2 — OverrideSignalThesis', () => {
  const active = makeThesis({ id: 'thesis_active', title: 'Active', status: 'ACTIVE' });
  const legacy = makeThesis({ id: 'thesis_legacy', title: 'Legacy', status: 'LEGACY' });

  it('ADMIN MANUAL override selects ACTIVE thesis and preserves evidence', () => {
    const signal = makeSignal({
      thesisScores: [
        { thesisId: 'thesis_active', score: 70, band: 'HIGH' },
        { thesisId: 'thesis_other', score: 68, band: 'MEDIUM' },
      ],
      routingDecision: {
        source: 'AUTO',
        routingState: 'CONTESTED',
        contested: true,
        secondaryThesisId: 'thesis_other',
        algorithmVersion: ROUTING_ALGORITHM_VERSION,
      },
    });
    const { override, writes } = buildHarness({
      signal,
      theses: [active, legacy],
      scores: { thesis_active: 70, thesis_legacy: 90 },
    });

    const result = override({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      selectedThesisId: 'thesis_active',
      actorId: 'admin_1',
      actorRole: 'ADMIN',
      now: NOW,
    });

    expect(result.routing.source).toBe('MANUAL');
    expect(result.routing.selectedThesisId).toBe('thesis_active');
    expect(result.previous?.routingState).toBe('CONTESTED');
    expect(writes[0].routingDecision.source).toBe('MANUAL');
    expect(writes[0].routingDecision.actorId).toBe('admin_1');
    expect(writes[0].routingDecision.routingState).toBe('CLEAR');
    expect(writes[0].routingDecision.selectedThesisId).toBe('thesis_active');
    expect(writes[0].thesisId).toBe('thesis_active');
    expect(writes[0].thesisScores).toHaveLength(2);
  });

  it('rejects CLIENT role', () => {
    const { override, writes } = buildHarness({
      signal: makeSignal(),
      theses: [active],
      scores: { thesis_active: 80 },
    });

    expect(() =>
      override({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_test',
        selectedThesisId: 'thesis_active',
        actorId: 'client_1',
        actorRole: 'CLIENT',
        now: NOW,
      })
    ).toThrow(/ADMIN/);
    expect(writes).toHaveLength(0);
  });

  it('rejects missing / wrong-client / LEGACY thesis without persistence', () => {
    const { override, writes } = buildHarness({
      signal: makeSignal(),
      theses: [active, legacy],
      scores: { thesis_active: 80, thesis_legacy: 99 },
    });

    expect(() =>
      override({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_test',
        selectedThesisId: 'missing',
        actorId: 'admin_1',
        actorRole: 'ADMIN',
        now: NOW,
      })
    ).toThrow(StrategicRoutingError);

    expect(() =>
      override({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_test',
        selectedThesisId: 'thesis_legacy',
        actorId: 'admin_1',
        actorRole: 'ADMIN',
        now: NOW,
      })
    ).toThrow(/ACTIVE/);

    expect(writes).toHaveLength(0);
  });
});

describe('SPEC-001 Phase 2 — db applyStrategicRoutingToSignal no auto-discard', () => {
  it('writer port path documented: ScoreAndRouteSignal never calls applyScoreToSignal', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/application/strategicSignalRouting/ScoreAndRouteSignal.ts', 'utf8')
    );
    expect(src).not.toMatch(/applyScoreToSignal/);
    expect(src).toMatch(/persistStrategicRouting/);
  });
});
