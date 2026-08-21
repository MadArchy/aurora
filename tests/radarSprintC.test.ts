import { describe, expect, it } from 'vitest';
import {
  computeConversionStats,
  feedbackScoringHints,
  signalsAwaitingOutcome,
} from '../src/domain/radarFeedbackCore';
import { buildPortfolioDigest } from '../src/domain/radarDigestCore';
import type { Client, Signal } from '../src/types';
import type { SignalOutcome } from '../src/domain/radarFeedbackCore';

function makeSignal(partial: Partial<Signal> & Pick<Signal, 'id' | 'title'>): Signal {
  return {
    organizationId: 'org',
    clientId: 'c1',
    sourceType: 'RSS',
    sourceName: 'Law.com',
    contentSnippet: 'snippet about AI patents',
    fingerprint: partial.id,
    detectedAt: new Date().toISOString(),
    status: 'NEW',
    aiStatus: 'PENDING_AI',
    managerDecision: 'UNREVIEWED',
    ...partial,
  };
}

describe('radar feedback loop', () => {
  it('tracks pending outcomes for converted/saved signals', () => {
    const signals = [
      makeSignal({ id: '1', title: 'A', status: 'CONVERTED', managerDecision: 'CONVERTED', relevanceScore: 80 }),
      makeSignal({ id: '2', title: 'B', managerDecision: 'SAVED', relevanceScore: 60 }),
      makeSignal({ id: '3', title: 'C', managerDecision: 'UNREVIEWED' }),
    ];
    const outcomes: SignalOutcome[] = [
      {
        id: 'o1',
        organizationId: 'org',
        clientId: 'c1',
        signalId: '1',
        kind: 'USEFUL',
        source: 'RADAR',
        actorUid: 'u1',
        createdAt: new Date().toISOString(),
      },
    ];
    expect(signalsAwaitingOutcome(signals, outcomes).map((s) => s.id)).toEqual(['2']);
    const stats = computeConversionStats(signals, outcomes);
    expect(stats.converted).toBe(1);
    expect(stats.useful).toBe(1);
    expect(stats.usefulRate).toBe(100);
    expect(stats.pendingFeedback).toBe(1);
  });

  it('builds scoring hints from useful/not useful outcomes', () => {
    const signals = [
      makeSignal({ id: '1', title: 'NIST AI governance framework update' }),
      makeSignal({ id: '2', title: 'Celebrity gossip about tech founders' }),
    ];
    const outcomes: SignalOutcome[] = [
      {
        id: 'o1',
        organizationId: 'org',
        clientId: 'c1',
        signalId: '1',
        kind: 'USEFUL',
        source: 'RADAR',
        actorUid: 'u1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'o2',
        organizationId: 'org',
        clientId: 'c1',
        signalId: '2',
        kind: 'NOT_USEFUL',
        source: 'RADAR',
        actorUid: 'u1',
        createdAt: new Date().toISOString(),
      },
    ];
    const hints = feedbackScoringHints(signals, outcomes);
    expect(hints.boostTerms.some((t) => t.includes('nist') || t.includes('governance'))).toBe(true);
    expect(hints.avoidTerms.some((t) => t.includes('celebrity') || t.includes('gossip'))).toBe(true);
  });
});

describe('portfolio digest', () => {
  it('aggregates decide-now stories across clients', () => {
    const clients: Client[] = [
      {
        id: 'c1',
        organizationId: 'org',
        displayName: 'Juan',
        profession: 'Patent Attorney',
        status: 'ACTIVE',
      } as Client,
      {
        id: 'c2',
        organizationId: 'org',
        displayName: 'Ana',
        profession: 'GC',
        status: 'ACTIVE',
      } as Client,
    ];

    const digest = buildPortfolioDigest(
      clients,
      (id) => {
        if (id === 'c1') {
          return [
            makeSignal({
              id: 's1',
              title: 'USPTO AI inventorship guidance released today',
              clientId: 'c1',
              priorityBand: 'CRITICAL',
              relevanceScore: 90,
              recommendedAction: 'CREATE_OPPORTUNITY',
            }),
          ];
        }
        return [
          makeSignal({
            id: 's2',
            title: 'Minor industry newsletter roundup',
            clientId: 'c2',
            priorityBand: 'LOW',
            relevanceScore: 30,
            recommendedAction: 'MONITOR',
          }),
        ];
      },
      []
    );

    expect(digest.decideNowTotal).toBeGreaterThanOrEqual(1);
    expect(digest.topItems.some((i) => i.clientName === 'Juan')).toBe(true);
    expect(digest.byClient[0]?.clientId).toBe('c1');
  });
});
