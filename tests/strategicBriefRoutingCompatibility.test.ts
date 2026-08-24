import { describe, expect, it } from 'vitest';
import { StrategicBriefError } from '../src/application/strategicBrief';
import { composeStrategicBrief } from '../src/composition/strategicBrief/composeStrategicBrief';
import { createLocalStrategicBriefStore, LocalStrategicContextReader } from '../src/infrastructure/strategicBrief';
import type { Signal } from '../src/types';

const NOW = '2026-08-24T21:10:00.000Z';

const TRUSTED = {
  actorId: 'mgr_ana',
  actorRole: 'ADMIN' as const,
  organizationId: 'org_test',
  clientId: 'client_test',
  now: NOW,
};

function persistedClearSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig_compat_1',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'Governed CLEAR after SPEC-001 persist patch',
    sourceType: 'NEWS_API',
    sourceName: 'NIST',
    contentSnippet: 'Framework update',
    fingerprint: 'fp_compat',
    detectedAt: NOW,
    status: 'NEW',
    aiStatus: 'NOT_REQUIRED',
    managerDecision: 'UNREVIEWED',
    routingDecision: {
      source: 'AUTO',
      routingState: 'CLEAR',
      selectedThesisId: 'th_gov',
      algorithmVersion: 'routing-v1',
      routedAt: NOW,
    },
    scoringVersion: 'scoring-v1',
    relevanceScore: 82,
    priorityBand: 'HIGH',
    recommendedDisposition: 'SAVE',
    recommendedOutputFormat: 'ARTICLE',
    whyNow: { score: 15, band: 'NOW', reason: 'NIST update' },
    scoreRationale: 'governed score snapshot',
    ...overrides,
  };
}

function readerFor(signal: Signal, extra: Record<string, Signal> = {}): LocalStrategicContextReader {
  const signals: Record<string, Signal> = { [signal.id]: signal, ...extra };
  return new LocalStrategicContextReader({
    getSignalById: (id) => signals[id],
    getEvidenceById: () => undefined,
  });
}

function createWithSignal(signal: Signal): () => unknown {
  const store = createLocalStrategicBriefStore();
  store.resetForTest();
  const useCases = composeStrategicBrief({
    store,
    signals: {
      getSignalById: (id) => (id === signal.id ? signal : undefined),
      getEvidenceById: (id) =>
        id === 'ev_1' ? { id, organizationId: 'org_test', clientId: 'client_test' } : undefined,
    },
  });
  return () =>
    useCases.create({
      trusted: TRUSTED,
      briefId: 'brief_compat',
      signalIds: [signal.id],
      primaryAudience: 'General Counsel',
      geography: 'CO',
      territory: 'AI Governance',
      framework: 'Preventive narrative',
      strategicAngle: 'Board-ready NIST translation',
      supportingEvidenceIds: ['ev_1'],
      riskFlags: ['REGULATORY'],
      recommendedChannel: 'LINKEDIN',
      recommendedFormat: 'ARTICLE',
      CTA: 'Request diagnostic',
      authorizedAction: 'CREATE_CONTENT',
      decisionRationale: 'CLEAR thesis with timely signal.',
    });
}

describe('SPEC-003 compatibility — consume routingDecision.selectedThesisId exclusively', () => {
  it('CLEAR persisted selectedThesisId is governed thesis without signal.thesisId', () => {
    const signal = persistedClearSignal();
    delete signal.thesisId;
    const ctx = readerFor(signal).getSignalContext(signal.id);
    expect(ctx?.routingState).toBe('CLEAR');
    expect(ctx?.governedThesisId).toBe('th_gov');
    expect(signal.thesisId).toBeUndefined();
    const created = createWithSignal(signal)() as { created: boolean; brief: { thesisId: string } };
    expect(created.created).toBe(true);
    expect(created.brief.thesisId).toBe('th_gov');
  });

  it('routingDecision.selectedThesisId wins over a conflicting compatibility thesisId', () => {
    const signal = persistedClearSignal({ thesisId: 'th_legacy' });
    const ctx = readerFor(signal).getSignalContext(signal.id);
    expect(ctx?.governedThesisId).toBe('th_gov');
    expect(ctx?.governedThesisId).not.toBe(signal.thesisId);
    const created = createWithSignal(signal)() as { created: boolean; brief: { thesisId: string } };
    expect(created.brief.thesisId).toBe('th_gov');
    expect(created.brief.thesisId).not.toBe('th_legacy');
  });

  it('legacy CLEAR with only signal.thesisId fails closed — no governed thesis', () => {
    const signal = persistedClearSignal({
      thesisId: 'th_legacy',
      routingDecision: {
        source: 'AUTO',
        routingState: 'CLEAR',
        algorithmVersion: 'routing-v1',
        routedAt: NOW,
      },
    });
    const ctx = readerFor(signal).getSignalContext(signal.id);
    expect(ctx?.routingState).toBe('CLEAR');
    expect(ctx?.governedThesisId).toBeUndefined();
    try {
      createWithSignal(signal)();
      expect.fail('expected ROUTING_NOT_CLEAR');
    } catch (err) {
      expect(err).toBeInstanceOf(StrategicBriefError);
      expect((err as StrategicBriefError).code).toBe('ROUTING_NOT_CLEAR');
    }
  });

  it('CLEAR missing selectedThesisId with thesisScores winner fails closed', () => {
    const signal = persistedClearSignal({
      thesisId: 'th_winner',
      thesisScores: [
        { thesisId: 'th_winner', score: 91, band: 'HIGH' },
        { thesisId: 'th_other', score: 40, band: 'LOW' },
      ],
      routingDecision: {
        source: 'AUTO',
        routingState: 'CLEAR',
        algorithmVersion: 'routing-v1',
        routedAt: NOW,
      },
    });
    const ctx = readerFor(signal).getSignalContext(signal.id);
    expect(ctx?.governedThesisId).toBeUndefined();
    try {
      createWithSignal(signal)();
      expect.fail('expected ROUTING_NOT_CLEAR');
    } catch (err) {
      expect(err).toBeInstanceOf(StrategicBriefError);
      expect((err as StrategicBriefError).code).toBe('ROUTING_NOT_CLEAR');
    }
  });

  it('CONTESTED with legacy signal.thesisId yields no governed thesis', () => {
    const signal = persistedClearSignal({
      thesisId: 'th_stale',
      routingDecision: {
        source: 'AUTO',
        routingState: 'CONTESTED',
        contested: true,
        algorithmVersion: 'routing-v1',
        routedAt: NOW,
      },
    });
    const ctx = readerFor(signal).getSignalContext(signal.id);
    expect(ctx?.routingState).toBe('CONTESTED');
    expect(ctx?.governedThesisId).toBeUndefined();
  });

  it('UNROUTED with legacy signal.thesisId yields no governed thesis', () => {
    const signal = persistedClearSignal({
      thesisId: 'th_stale',
      routingDecision: {
        source: 'AUTO',
        routingState: 'UNROUTED',
        algorithmVersion: 'routing-v1',
        routedAt: NOW,
      },
    });
    const ctx = readerFor(signal).getSignalContext(signal.id);
    expect(ctx?.routingState).toBe('UNROUTED');
    expect(ctx?.governedThesisId).toBeUndefined();
  });
});
