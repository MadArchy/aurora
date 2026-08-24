import { describe, expect, it } from 'vitest';
import type { Signal, StrategicScoreResult } from '../src/types';
import { ROUTING_ALGORITHM_VERSION } from '../src/domain/thesisRoutingCore';

const NOW = '2026-08-24T21:00:00.000Z';

async function loadDb() {
  const { dbService } = await import('../src/services/db');
  return dbService;
}

function stubScore(): StrategicScoreResult {
  return {
    totalScore: 80,
    priorityBand: 'HIGH',
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
    strategicRationale: 'persist shape test',
    recommendedAction: 'SAVE',
    scoringStatus: 'SCORED',
    calculatedAt: NOW,
  };
}

function seedSignal(db: Awaited<ReturnType<typeof loadDb>>, title: string): Signal {
  const created = db.addSignal({
    organizationId: 'org_test',
    clientId: 'client_test',
    title,
    sourceType: 'REGULATORY',
    sourceName: 'PersistTest',
    contentSnippet: 'shape',
    status: 'NEW',
  });
  return created.signal;
}

describe('SPEC-001 compatibility — persist selectedThesisId on routingDecision', () => {
  it('CLEAR persist requires selectedThesisId and matching compatibility thesisId', async () => {
    const dbService = await loadDb();
    const signal = seedSignal(dbService, `clear-ok-${Date.now()}-${Math.random()}`);
    dbService.applyStrategicRoutingToSignal(signal.id, stubScore(), {
      thesisId: 'th_a',
      thesisScores: [{ thesisId: 'th_a', score: 80, band: 'HIGH' }],
      routingDecision: {
        source: 'AUTO',
        routingState: 'CLEAR',
        selectedThesisId: 'th_a',
        algorithmVersion: ROUTING_ALGORITHM_VERSION,
        routedAt: NOW,
      },
      organizationId: 'org_test',
      clientId: 'client_test',
    });
    const stored = dbService.getSignalById(signal.id);
    expect(stored?.routingDecision?.routingState).toBe('CLEAR');
    expect(stored?.routingDecision?.selectedThesisId).toBe('th_a');
    expect(stored?.thesisId).toBe('th_a');
  });

  it('malformed CLEAR without selectedThesisId fails closed', async () => {
    const dbService = await loadDb();
    const signal = seedSignal(dbService, `clear-missing-${Date.now()}-${Math.random()}`);
    expect(() =>
      dbService.applyStrategicRoutingToSignal(signal.id, stubScore(), {
        thesisId: 'th_a',
        thesisScores: [{ thesisId: 'th_a', score: 80, band: 'HIGH' }],
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
        organizationId: 'org_test',
        clientId: 'client_test',
      })
    ).toThrow(/selectedThesisId/);
    expect(dbService.getSignalById(signal.id)?.routingDecision).toBeUndefined();
    expect(dbService.getSignalById(signal.id)?.thesisId).toBeUndefined();
  });

  it('CLEAR conflict: top-level thesisId does not override routingDecision.selectedThesisId', async () => {
    const dbService = await loadDb();
    const signal = seedSignal(dbService, `clear-conflict-${Date.now()}-${Math.random()}`);
    expect(() =>
      dbService.applyStrategicRoutingToSignal(signal.id, stubScore(), {
        thesisId: 'th_b',
        thesisScores: [{ thesisId: 'th_a', score: 80, band: 'HIGH' }],
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          selectedThesisId: 'th_a',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
        organizationId: 'org_test',
        clientId: 'client_test',
      })
    ).toThrow(/must match/);
    expect(dbService.getSignalById(signal.id)?.routingDecision).toBeUndefined();
    expect(dbService.getSignalById(signal.id)?.thesisId).toBeUndefined();
  });

  it('CONTESTED persist rejects selectedThesisId', async () => {
    const dbService = await loadDb();
    const signal = seedSignal(dbService, `contested-${Date.now()}-${Math.random()}`);
    expect(() =>
      dbService.applyStrategicRoutingToSignal(signal.id, stubScore(), {
        thesisId: undefined,
        thesisScores: [
          { thesisId: 'th_a', score: 76, band: 'HIGH' },
          { thesisId: 'th_b', score: 74, band: 'HIGH' },
        ],
        routingDecision: {
          source: 'AUTO',
          routingState: 'CONTESTED',
          contested: true,
          selectedThesisId: 'th_a',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
        organizationId: 'org_test',
        clientId: 'client_test',
      })
    ).toThrow(/must not persist selectedThesisId/);
  });

  it('UNROUTED persist leaves selectedThesisId absent', async () => {
    const dbService = await loadDb();
    const signal = seedSignal(dbService, `unrouted-${Date.now()}-${Math.random()}`);
    dbService.applyStrategicRoutingToSignal(signal.id, stubScore(), {
      thesisId: undefined,
      thesisScores: [],
      routingDecision: {
        source: 'AUTO',
        routingState: 'UNROUTED',
        algorithmVersion: ROUTING_ALGORITHM_VERSION,
        routedAt: NOW,
      },
      organizationId: 'org_test',
      clientId: 'client_test',
    });
    const stored = dbService.getSignalById(signal.id);
    expect(stored?.routingDecision?.routingState).toBe('UNROUTED');
    expect(stored?.routingDecision?.selectedThesisId).toBeUndefined();
    expect(stored?.thesisId).toBeUndefined();
  });
});
