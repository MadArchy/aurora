import { describe, expect, it } from 'vitest';
import {
  ROUTING_ALGORITHM_VERSION,
  ROUTING_MIN_SCORE,
  routeSignalAcrossTheses,
  routingSignalPatch,
  toMaterialRoutingDecision,
  type ThesisScoreFn,
} from '../src/domain/thesisRoutingCore';
import {
  filterEligibleThesesForStrategicRouting,
  isThesisEligibleForStrategicRouting,
} from '../src/domain/thesisRoutingEligibility';
import { calculateStrategicScore } from '../src/services/scoring';
import type { PositioningThesis, Signal, StrategicScoreResult, ThesisStatus } from '../src/types';

function makeThesis(overrides: Partial<PositioningThesis>): PositioningThesis {
  return {
    id: 'thesis_x',
    organizationId: 'org_aurora_01',
    clientId: 'client_juan_001',
    title: 'Tesis',
    expertIdentity: 'Attorney',
    targetAudience: 'General Counsel',
    domain: 'Legal',
    objective: 'Desarrollo de negocio',
    proofPoints: ['Registered Patent Attorney', 'Chair Emerging Technology Committee'],
    voiceAndTone: 'Preciso',
    complianceRules: '',
    status: 'ACTIVE',
    clientApprovalStatus: 'APPROVED',
    createdAt: '2026-08-01T00:00:00Z',
    createdBy: 'system',
    updatedAt: '2026-08-01T00:00:00Z',
    updatedBy: 'system',
    ...overrides,
  };
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig_uspto',
    organizationId: 'org_aurora_01',
    clientId: 'client_juan_001',
    title: 'USPTO publishes new patent examination guidance for AI-assisted inventions',
    contentSnippet:
      'The patent office clarifies inventorship for AI-assisted inventions, affecting patent strategy and prosecution for general counsel.',
    sourceName: 'USPTO',
    sourceType: 'REGULATORY',
    sourceQuality: 'HIGH',
    fingerprint: 'fp_uspto',
    status: 'NEW',
    aiStatus: 'PENDING',
    managerDecision: 'UNREVIEWED',
    detectedAt: new Date().toISOString(),
    ...overrides,
  } as Signal;
}

/** Scorer de laboratorio: devuelve el score fijado por tesis. */
function stubScorer(
  scores: Record<string, number>,
  blocked: Record<string, string> = {}
): ThesisScoreFn {
  return (_signal, thesis): StrategicScoreResult => ({
    totalScore: scores[thesis.id] ?? 0,
    priorityBand: 'MEDIUM',
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
    strategicRationale: 'stub',
    recommendedAction: 'SAVE',
    scoringStatus: 'SCORED',
    calculatedAt: '2026-08-01T00:00:00Z',
    blockedByLimit: blocked[thesis.id],
  });
}

const patentThesis = makeThesis({
  id: 'thesis_patent',
  title: 'Patent Strategy',
  priority: 90,
  territories: [
    {
      id: 'terr_patent',
      name: 'Patent Strategy',
      weight: 100,
      keywords: ['patent', 'uspto', 'inventorship', 'prosecution'],
    },
  ],
  audiences: [
    { id: 'aud_gc', name: 'General Counsel', tier: 'COMMERCIAL', weight: 95, keywords: ['counsel', 'general'] },
  ],
  objectives: [{ id: 'obj_business', kind: 'BUSINESS', weight: 100 }],
});

const aiIpThesis = makeThesis({
  id: 'thesis_ai_ip',
  title: 'AI x IP',
  priority: 70,
  territories: [
    { id: 'terr_ai_ip', name: 'AI and IP', weight: 70, keywords: ['patent', 'inventions'] },
  ],
  audiences: [
    { id: 'aud_cto', name: 'CTO', tier: 'COMMERCIAL', weight: 70, keywords: ['engineering'] },
  ],
  objectives: [{ id: 'obj_thought', kind: 'THOUGHT_LEADERSHIP', weight: 100 }],
});

const governanceThesis = makeThesis({
  id: 'thesis_governance',
  title: 'AI Governance',
  priority: 50,
  territories: [
    {
      id: 'terr_gov',
      name: 'AI Governance',
      weight: 90,
      keywords: ['governance', 'nist', 'compliance', 'audit'],
    },
  ],
  audiences: [
    { id: 'aud_ciso', name: 'CISO', tier: 'COMMERCIAL', weight: 80, keywords: ['security'] },
  ],
  objectives: [{ id: 'obj_business', kind: 'BUSINESS', weight: 100 }],
  limits: { hardBlocks: ['inventorship'], softAvoid: [] },
});

const FIXED_NOW = '2026-08-23T21:00:00.000Z';

describe('SPEC-001 eligibility', () => {
  const statuses: ThesisStatus[] = [
    'DRAFT',
    'UNDER_REVIEW',
    'ACTIVE',
    'PAUSED',
    'ARCHIVED',
    'LEGACY',
  ];

  it.each(statuses)('ACTIVE-only: status %s', (status) => {
    const thesis = makeThesis({ status });
    expect(isThesisEligibleForStrategicRouting(thesis)).toBe(status === 'ACTIVE');
  });

  it('filterEligibleThesesForStrategicRouting keeps only ACTIVE and preserves order', () => {
    const mixed = [
      makeThesis({ id: 'd', status: 'DRAFT' }),
      makeThesis({ id: 'a1', status: 'ACTIVE' }),
      makeThesis({ id: 'l', status: 'LEGACY' }),
      makeThesis({ id: 'a2', status: 'ACTIVE' }),
      makeThesis({ id: 'p', status: 'PAUSED' }),
    ];
    const eligible = filterEligibleThesesForStrategicRouting(mixed);
    expect(eligible.map((t) => t.id)).toEqual(['a1', 'a2']);
  });
});

describe('routeSignalAcrossTheses', () => {
  it('UNROUTED when the client has no theses', () => {
    const routing = routeSignalAcrossTheses(makeSignal(), [], stubScorer({}), { now: FIXED_NOW });

    expect(routing.routingState).toBe('UNROUTED');
    expect(routing.selectedThesisId).toBeUndefined();
    expect(routing.primaryThesisId).toBeUndefined();
    expect(routing.perThesis).toEqual([]);
    expect(routing.algorithmVersion).toBe(ROUTING_ALGORITHM_VERSION);
    expect(routing.routedAt).toBe(FIXED_NOW);
    expect(routing.rationale).toContain('ACTIVE');
  });

  it('UNROUTED when only inactive theses are supplied (eligibility filter)', () => {
    const routing = routeSignalAcrossTheses(
      makeSignal(),
      [
        makeThesis({ id: 'draft', status: 'DRAFT' }),
        makeThesis({ id: 'legacy', status: 'LEGACY' }),
        makeThesis({ id: 'paused', status: 'PAUSED' }),
      ],
      stubScorer({ draft: 99, legacy: 99, paused: 99 }),
      { now: FIXED_NOW }
    );

    expect(routing.routingState).toBe('UNROUTED');
    expect(routing.eligibleThesisCount).toBe(0);
    expect(routing.perThesis).toEqual([]);
    expect(routing.selectedThesisId).toBeUndefined();
  });

  it('evaluates only the ACTIVE thesis when mixed with inactive (N=1 eligible)', () => {
    const routing = routeSignalAcrossTheses(
      makeSignal(),
      [
        makeThesis({ id: 'draft', status: 'DRAFT' }),
        patentThesis,
        makeThesis({ id: 'archived', status: 'ARCHIVED' }),
      ],
      stubScorer({ thesis_patent: 88, draft: 99, archived: 99 }),
      { now: FIXED_NOW }
    );

    expect(routing.routingState).toBe('CLEAR');
    expect(routing.eligibleThesisCount).toBe(1);
    expect(routing.perThesis).toHaveLength(1);
    expect(routing.perThesis[0].thesisId).toBe('thesis_patent');
    expect(routing.selectedThesisId).toBe('thesis_patent');
    expect(routing.source).toBe('AUTO');
  });

  it('CLEAR: highest scoring thesis as selected; runner-up secondary', () => {
    const routing = routeSignalAcrossTheses(
      makeSignal(),
      [aiIpThesis, patentThesis, governanceThesis],
      stubScorer({ thesis_patent: 88, thesis_ai_ip: 61, thesis_governance: 44 }),
      { now: FIXED_NOW }
    );

    expect(routing.routingState).toBe('CLEAR');
    expect(routing.selectedThesisId).toBe('thesis_patent');
    expect(routing.primaryThesisId).toBe('thesis_patent');
    expect(routing.secondaryThesisId).toBe('thesis_ai_ip');
    expect(routing.excludedThesisIds).toEqual([]);
    expect(routing.contested).toBe(false);
    expect(routing.eligibleThesisCount).toBe(3);
    expect(routing.perThesis).toHaveLength(3);
  });

  it('excludes theses below the minimum score', () => {
    const routing = routeSignalAcrossTheses(
      makeSignal(),
      [patentThesis, governanceThesis],
      stubScorer({ thesis_patent: 80, thesis_governance: ROUTING_MIN_SCORE - 1 }),
      { now: FIXED_NOW }
    );

    expect(routing.excludedThesisIds).toEqual(['thesis_governance']);
    expect(
      routing.perThesis.find((e) => e.thesisId === 'thesis_governance')?.exclusionReason
    ).toContain('por debajo del mínimo');
    expect(routing.rationale).toContain('score bajo');
  });

  it('excludes a thesis blocked by a hard limit even with a high score', () => {
    const routing = routeSignalAcrossTheses(
      makeSignal(),
      [patentThesis, governanceThesis],
      stubScorer({ thesis_patent: 70, thesis_governance: 95 }, { thesis_governance: 'inventorship' }),
      { now: FIXED_NOW }
    );

    expect(routing.routingState).toBe('CLEAR');
    expect(routing.selectedThesisId).toBe('thesis_patent');
    expect(routing.excludedThesisIds).toContain('thesis_governance');
    expect(routing.rationale).toContain('límite duro');
  });

  it('CONTESTED: no selectedThesisId / no primary fallback', () => {
    const routing = routeSignalAcrossTheses(
      makeSignal(),
      [patentThesis, aiIpThesis],
      stubScorer({ thesis_patent: 76, thesis_ai_ip: 73 }),
      { now: FIXED_NOW }
    );

    expect(routing.routingState).toBe('CONTESTED');
    expect(routing.contested).toBe(true);
    expect(routing.selectedThesisId).toBeUndefined();
    expect(routing.primaryThesisId).toBeUndefined();
    expect(routing.secondaryThesisId).toBeDefined();
    expect(routing.rationale).toContain('decide el manager');
    expect(routing.perThesis).toHaveLength(2);
  });

  it('breaks score ties using declared thesis priority (not input order)', () => {
    const routing = routeSignalAcrossTheses(
      makeSignal(),
      [aiIpThesis, patentThesis],
      stubScorer({ thesis_patent: 72, thesis_ai_ip: 72 }),
      { now: FIXED_NOW }
    );

    expect(routing.routingState).toBe('CLEAR');
    expect(routing.selectedThesisId).toBe('thesis_patent');
  });

  it('UNROUTED when every scored thesis is excluded', () => {
    const routing = routeSignalAcrossTheses(
      makeSignal(),
      [patentThesis, governanceThesis],
      stubScorer({ thesis_patent: 10, thesis_governance: 12 }),
      { now: FIXED_NOW }
    );

    expect(routing.routingState).toBe('UNROUTED');
    expect(routing.selectedThesisId).toBeUndefined();
    expect(routing.excludedThesisIds).toHaveLength(2);
    expect(routing.rationale).toContain('Ninguna tesis alcanza');
  });

  it('order independence: reverse input order yields same CLEAR winner', () => {
    const scorer = stubScorer({
      thesis_patent: 88,
      thesis_ai_ip: 61,
      thesis_governance: 44,
    });
    const a = routeSignalAcrossTheses(
      makeSignal(),
      [aiIpThesis, patentThesis, governanceThesis],
      scorer,
      { now: FIXED_NOW }
    );
    const b = routeSignalAcrossTheses(
      makeSignal(),
      [governanceThesis, patentThesis, aiIpThesis],
      scorer,
      { now: FIXED_NOW }
    );

    expect(a.routingState).toBe('CLEAR');
    expect(b.routingState).toBe(a.routingState);
    expect(b.selectedThesisId).toBe(a.selectedThesisId);
    expect(b.secondaryThesisId).toBe(a.secondaryThesisId);
  });

  it('order independence: contested remains unresolved regardless of input order', () => {
    const scorer = stubScorer({ thesis_patent: 76, thesis_ai_ip: 73 });
    const a = routeSignalAcrossTheses(makeSignal(), [patentThesis, aiIpThesis], scorer, {
      now: FIXED_NOW,
    });
    const b = routeSignalAcrossTheses(makeSignal(), [aiIpThesis, patentThesis], scorer, {
      now: FIXED_NOW,
    });

    expect(a.routingState).toBe('CONTESTED');
    expect(b.routingState).toBe('CONTESTED');
    expect(a.selectedThesisId).toBeUndefined();
    expect(b.selectedThesisId).toBeUndefined();
  });

  it('carries algorithmVersion on every result', () => {
    const routing = routeSignalAcrossTheses(
      makeSignal(),
      [patentThesis],
      stubScorer({ thesis_patent: 80 }),
      { now: FIXED_NOW }
    );
    expect(routing.algorithmVersion).toBe('routing-v1');
    expect(toMaterialRoutingDecision(routing).algorithmVersion).toBe(ROUTING_ALGORITHM_VERSION);
  });
});

describe('routeSignalAcrossTheses with the real scoring engine', () => {
  it('routes a USPTO signal to Patent Strategy over AI x IP and drops AI Governance', () => {
    const routing = routeSignalAcrossTheses(
      makeSignal(),
      [governanceThesis, aiIpThesis, patentThesis],
      (signal, thesis) => calculateStrategicScore(signal, thesis, {}),
      { now: FIXED_NOW }
    );

    expect(routing.routingState).toBe('CLEAR');
    expect(routing.selectedThesisId).toBe('thesis_patent');
    expect(routing.excludedThesisIds).toContain('thesis_governance');

    const patent = routing.perThesis.find((e) => e.thesisId === 'thesis_patent');
    const aiIp = routing.perThesis.find((e) => e.thesisId === 'thesis_ai_ip');
    expect(patent!.score).toBeGreaterThan(aiIp!.score);
    expect(patent!.matchedTerritory).toBe('Patent Strategy');
    expect(patent!.matchedAudience).toBe('General Counsel');
  });
});

describe('routingSignalPatch', () => {
  it('persists selected thesis only when CLEAR and scores for every evaluated thesis', () => {
    const routing = routeSignalAcrossTheses(
      makeSignal(),
      [patentThesis, aiIpThesis],
      stubScorer({ thesis_patent: 88, thesis_ai_ip: 55 }),
      { now: FIXED_NOW }
    );

    const patch = routingSignalPatch(routing);
    expect(patch.thesisId).toBe('thesis_patent');
    expect(patch.thesisScores).toEqual([
      { thesisId: 'thesis_patent', score: 88, band: 'CRITICAL' },
      { thesisId: 'thesis_ai_ip', score: 55, band: 'MEDIUM' },
    ]);
  });

  it('does not write thesisId when CONTESTED', () => {
    const routing = routeSignalAcrossTheses(
      makeSignal(),
      [patentThesis, aiIpThesis],
      stubScorer({ thesis_patent: 76, thesis_ai_ip: 73 }),
      { now: FIXED_NOW }
    );
    const patch = routingSignalPatch(routing);
    expect(patch.thesisId).toBeUndefined();
    expect(patch.thesisScores).toHaveLength(2);
  });
});
