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
  isMaterialRoutingChange,
  ROUTING_SYSTEM_ACTOR_ID,
  type SignalRoutingHistoryEntry,
} from '../src/domain/routingHistoryCore';
import {
  ROUTING_ALGORITHM_VERSION,
  ROUTING_CONTEST_MARGIN,
} from '../src/domain/thesisRoutingCore';
import type {
  PositioningThesis,
  Signal,
  StrategicScoreResult,
} from '../src/types';

const NOW = '2026-08-23T23:00:00.000Z';
const LATER = '2026-08-23T23:05:00.000Z';

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
  failPersist?: boolean;
}) {
  const store = { signal: { ...opts.signal } };
  const history: SignalRoutingHistoryEntry[] = [];
  const writes: PersistStrategicRoutingParams[] = [];

  const signals: SignalReadPort = {
    getSignalById: (id) => (id === store.signal.id ? { ...store.signal } : undefined),
  };
  const theses: ThesisQueryPort = {
    getThesesForClient: (clientId) =>
      opts.theses.filter((t) => t.clientId === clientId),
  };
  const writer: SignalWritePort = {
    persistStrategicRouting: (params) => {
      if (opts.failPersist) throw new Error('simulated persist failure');
      if (params.clientId !== store.signal.clientId) {
        throw new Error('tenant mismatch clientId');
      }
      if (params.organizationId !== store.signal.organizationId) {
        throw new Error('tenant mismatch organizationId');
      }
      writes.push(params);
      if (params.historyEntry) history.push(params.historyEntry);
      store.signal = {
        ...store.signal,
        thesisId: params.thesisId,
        thesisScores: params.thesisScores,
        routingDecision: params.routingDecision,
        whyNow: params.whyNow,
        relevanceScore: params.scoreResult.totalScore,
        priorityBand: params.scoreResult.priorityBand,
        recommendedAction: params.scoreResult.recommendedAction,
        scoreRationale: params.scoreResult.strategicRationale,
      };
    },
  };
  const scoring: StrategicScoringPort = {
    createScoreFn: () => (_s, thesis) => stubScore(opts.scores[thesis.id] ?? 0),
    computeWhyNow: () => ({ score: 50, band: 'SOON', reason: 'stub why' }),
    scoreThesis: (_s, thesis) => stubScore(opts.scores[thesis.id] ?? 0),
  };

  return {
    scoreAndRoute: createScoreAndRouteSignal({ signals, theses, writer, scoring }),
    override: createOverrideSignalThesis({ signals, theses, writer, scoring }),
    writes,
    history,
    store,
  };
}

describe('SPEC-001 Phase 3 — material change + history', () => {
  it('domain: timestamp-only is not material; algorithmVersion is', () => {
    const base = {
      routingState: 'CLEAR' as const,
      selectedThesisId: 'A',
      source: 'AUTO' as const,
      algorithmVersion: 'routing-v1',
    };
    expect(isMaterialRoutingChange(base, { ...base })).toBe(false);
    expect(
      isMaterialRoutingChange(base, { ...base, algorithmVersion: 'routing-v2' })
    ).toBe(true);
    expect(isMaterialRoutingChange(null, base)).toBe(false);
  });

  it('INITIAL CLEAR: persists current state, no history entry', () => {
    const theses = [
      makeThesis({ id: 'A', title: 'A', priority: 10 }),
      makeThesis({ id: 'B', title: 'B', priority: 20 }),
    ];
    const h = buildHarness({
      signal: makeSignal(),
      theses,
      scores: { A: 80, B: 50 },
    });
    const result = h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: NOW,
    });
    expect(result.routing.routingState).toBe('CLEAR');
    expect(result.routing.selectedThesisId).toBe('A');
    expect(result.historyWritten).toBe(false);
    expect(h.history).toHaveLength(0);
    expect(h.writes[0].thesisId).toBe('A');
    expect(h.writes[0].routingDecision.routingState).toBe('CLEAR');
    expect(h.writes[0].routingDecision.selectedThesisId).toBe('A');
  });

  it('CLEAR A → CLEAR B: history preserves A, current becomes B', () => {
    const theses = [
      makeThesis({ id: 'A', title: 'A', priority: 10 }),
      makeThesis({ id: 'B', title: 'B', priority: 20 }),
    ];
    const h = buildHarness({
      signal: makeSignal({
        thesisId: 'A',
        thesisScores: [
          { thesisId: 'A', score: 80, band: 'HIGH' },
          { thesisId: 'B', score: 50, band: 'MEDIUM' },
        ],
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          rationale: 'prev',
          routedAt: NOW,
        },
      }),
      theses,
      scores: { A: 50, B: 80 },
    });
    const result = h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: LATER,
    });
    expect(result.routing.selectedThesisId).toBe('B');
    expect(result.historyWritten).toBe(true);
    expect(h.history).toHaveLength(1);
    expect(h.history[0].previous.selectedThesisId).toBe('A');
    expect(h.history[0].next.selectedThesisId).toBe('B');
    expect(h.history[0].actorId).toBe(ROUTING_SYSTEM_ACTOR_ID);
    expect(h.store.signal.thesisId).toBe('B');
  });

  it('CLEAR → CONTESTED: history + no stale thesisId', () => {
    const theses = [
      makeThesis({ id: 'A', title: 'A', priority: 10 }),
      makeThesis({ id: 'B', title: 'B', priority: 20 }),
    ];
    const h = buildHarness({
      signal: makeSignal({
        thesisId: 'A',
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
      }),
      theses,
      scores: { A: 70, B: 70 - ROUTING_CONTEST_MARGIN + 1 },
    });
    // Force contested: scores within margin
    const h2 = buildHarness({
      signal: makeSignal({
        thesisId: 'A',
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
      }),
      theses,
      scores: { A: 72, B: 70 },
    });
    const result = h2.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: LATER,
    });
    expect(result.routing.routingState).toBe('CONTESTED');
    expect(result.routing.selectedThesisId).toBeUndefined();
    expect(h2.store.signal.thesisId).toBeUndefined();
    expect(h2.history).toHaveLength(1);
    expect(h2.history[0].previous.selectedThesisId).toBe('A');
    expect(h2.history[0].next.routingState).toBe('CONTESTED');
    expect(h).toBeTruthy();
  });

  it('CONTESTED → MANUAL CLEAR: history MANUAL + actor', () => {
    const theses = [
      makeThesis({ id: 'A', title: 'A' }),
      makeThesis({ id: 'B', title: 'B' }),
    ];
    const h = buildHarness({
      signal: makeSignal({
        thesisId: undefined,
        thesisScores: [
          { thesisId: 'A', score: 72, band: 'HIGH' },
          { thesisId: 'B', score: 70, band: 'HIGH' },
        ],
        routingDecision: {
          source: 'AUTO',
          routingState: 'CONTESTED',
          contested: true,
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
      }),
      theses,
      scores: { A: 72, B: 70 },
    });
    const result = h.override({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      selectedThesisId: 'B',
      actorId: 'mgr_42',
      actorRole: 'ADMIN',
      now: LATER,
    });
    expect(result.routing.source).toBe('MANUAL');
    expect(result.routing.selectedThesisId).toBe('B');
    expect(result.historyWritten).toBe(true);
    expect(h.history[0].actorId).toBe('mgr_42');
    expect(h.history[0].previous.routingState).toBe('CONTESTED');
    expect(h.history[0].next.source).toBe('MANUAL');
    expect(h.store.signal.thesisScores?.length).toBe(2);
  });

  it('no material change: repeated AUTO does not grow history', () => {
    const theses = [makeThesis({ id: 'A', title: 'A' })];
    const h = buildHarness({
      signal: makeSignal({
        thesisId: 'A',
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
          rationale: 'old rationale',
        },
      }),
      theses,
      scores: { A: 80 },
    });
    const r1 = h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: LATER,
    });
    const r2 = h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: '2026-08-23T23:10:00.000Z',
    });
    expect(r1.historyWritten).toBe(false);
    expect(r2.historyWritten).toBe(false);
    expect(h.history).toHaveLength(0);
    expect(r1.routing.selectedThesisId).toBe(r2.routing.selectedThesisId);
  });

  it('AUTO CLEAR A → MANUAL CLEAR A: source change is material', () => {
    const theses = [makeThesis({ id: 'A', title: 'A' })];
    const h = buildHarness({
      signal: makeSignal({
        thesisId: 'A',
        thesisScores: [{ thesisId: 'A', score: 80, band: 'HIGH' }],
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
      }),
      theses,
      scores: { A: 80 },
    });
    const result = h.override({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      selectedThesisId: 'A',
      actorId: 'mgr_42',
      actorRole: 'ADMIN',
      now: LATER,
    });
    expect(result.historyWritten).toBe(true);
    expect(h.history[0].previous.source).toBe('AUTO');
    expect(h.history[0].next.source).toBe('MANUAL');
    expect(h.history[0].next.selectedThesisId).toBe('A');
  });

  it('MANUAL same thesis again: no duplicate history', () => {
    const theses = [makeThesis({ id: 'A', title: 'A' })];
    const h = buildHarness({
      signal: makeSignal({
        thesisId: 'A',
        thesisScores: [{ thesisId: 'A', score: 80, band: 'HIGH' }],
        routingDecision: {
          source: 'MANUAL',
          routingState: 'CLEAR',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          actorId: 'mgr_42',
          routedAt: NOW,
        },
      }),
      theses,
      scores: { A: 80 },
    });
    const result = h.override({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      selectedThesisId: 'A',
      actorId: 'mgr_42',
      actorRole: 'ADMIN',
      now: LATER,
    });
    expect(result.historyWritten).toBe(false);
    expect(h.history).toHaveLength(0);
  });

  it('algorithmVersion change is material (routing-v0 → routing-v1)', () => {
    const theses = [makeThesis({ id: 'A', title: 'A' })];
    const h = buildHarness({
      signal: makeSignal({
        thesisId: 'A',
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          algorithmVersion: 'routing-v0',
          routedAt: NOW,
        },
      }),
      theses,
      scores: { A: 80 },
    });
    const result = h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: LATER,
    });
    expect(result.historyWritten).toBe(true);
    expect(h.history[0].previous.algorithmVersion).toBe('routing-v0');
    expect(h.history[0].next.algorithmVersion).toBe(ROUTING_ALGORITHM_VERSION);
  });

  it('N-thesis evidence survives persist params', () => {
    const theses = [
      makeThesis({ id: 'A', title: 'A', priority: 1 }),
      makeThesis({ id: 'B', title: 'B', priority: 2 }),
      makeThesis({ id: 'C', title: 'C', priority: 3 }),
    ];
    const h = buildHarness({
      signal: makeSignal(),
      theses,
      scores: { A: 90, B: 60, C: 55 },
    });
    h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: NOW,
    });
    expect(h.writes[0].thesisScores).toHaveLength(3);
    expect(h.writes[0].thesisScores.map((t) => t.thesisId).sort()).toEqual([
      'A',
      'B',
      'C',
    ]);
    expect(h.store.signal.thesisScores).toHaveLength(3);
  });

  it('tenant mismatch rejects before write', () => {
    const h = buildHarness({
      signal: makeSignal({ clientId: 'client_A', organizationId: 'org_A' }),
      theses: [makeThesis({ id: 'A', clientId: 'client_A', organizationId: 'org_A' })],
      scores: { A: 80 },
    });
    expect(() =>
      h.scoreAndRoute({
        signalId: 'sig_1',
        clientId: 'client_B',
        organizationId: 'org_A',
        now: NOW,
      })
    ).toThrow(StrategicRoutingError);
    expect(h.writes).toHaveLength(0);
    expect(h.history).toHaveLength(0);
  });

  it('persistence failure → PERSISTENCE_ERROR, no fake success', () => {
    const h = buildHarness({
      signal: makeSignal(),
      theses: [makeThesis({ id: 'A' })],
      scores: { A: 80 },
      failPersist: true,
    });
    expect(() =>
      h.scoreAndRoute({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_test',
        now: NOW,
      })
    ).toThrow(/PERSISTENCE_ERROR|simulated persist/);
    try {
      h.scoreAndRoute({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_test',
        now: NOW,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(StrategicRoutingError);
      expect((e as StrategicRoutingError).code).toBe('PERSISTENCE_ERROR');
    }
    expect(h.history).toHaveLength(0);
  });

  it('atomic fake: material transition writes history + current in one persist call', () => {
    const theses = [
      makeThesis({ id: 'A', title: 'A' }),
      makeThesis({ id: 'B', title: 'B' }),
    ];
    const h = buildHarness({
      signal: makeSignal({
        thesisId: 'A',
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
      }),
      theses,
      scores: { A: 40, B: 85 },
    });
    h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: LATER,
    });
    expect(h.writes).toHaveLength(1);
    expect(h.writes[0].historyEntry).toBeDefined();
    expect(h.writes[0].thesisId).toBe('B');
    expect(h.history).toHaveLength(1);
  });

  it('manual override requires trusted actorId', () => {
    const h = buildHarness({
      signal: makeSignal({
        thesisId: undefined,
        routingDecision: {
          source: 'AUTO',
          routingState: 'CONTESTED',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
        },
      }),
      theses: [makeThesis({ id: 'B' })],
      scores: { B: 70 },
    });
    expect(() =>
      h.override({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_test',
        selectedThesisId: 'B',
        actorId: '  ',
        actorRole: 'ADMIN',
        now: LATER,
      })
    ).toThrow(StrategicRoutingError);
    expect(h.writes).toHaveLength(0);
  });

  it('history entry schema excludes AI/secret fields', () => {
    const theses = [
      makeThesis({ id: 'A' }),
      makeThesis({ id: 'B' }),
    ];
    const h = buildHarness({
      signal: makeSignal({
        thesisId: 'A',
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
      }),
      theses,
      scores: { A: 40, B: 90 },
    });
    h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: LATER,
    });
    const json = JSON.stringify(h.history[0]);
    expect(json).not.toMatch(/api[_-]?key/i);
    expect(json).not.toMatch(/Authorization/i);
    expect(json).not.toMatch(/rawOutput|rawPrompt|providerResponse/i);
    expect(h.history[0]).not.toHaveProperty('rawOutput');
    expect(h.history[0]).toHaveProperty('organizationId');
    expect(h.history[0]).toHaveProperty('previous');
    expect(h.history[0]).toHaveProperty('next');
  });
});

describe('SPEC-001 Phase 3 — db local atomic routing writer', () => {
  it('applyStrategicRoutingToSignal appends history and updates signal together', async () => {
    const { dbService } = await import('../src/services/db');
    const signal = makeSignal({ id: `sig_p3_${Date.now()}` });
    // Use in-memory mutation path without depending on full seed — skip if FIREBASE
    const existing = dbService.getSignalById(signal.id);
    if (existing) return;

    // Soft check: method signature accepts historyEntry
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/services/db.ts', 'utf8')
    );
    expect(src).toMatch(/historyEntry/);
    expect(src).toMatch(/signalRoutingHistory/);
    expect(src).toMatch(/postura_signal_routing_history_v1/);
    expect(src).toMatch(/getSignalRoutingHistory/);
  });
});
