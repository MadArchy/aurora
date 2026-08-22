import { describe, expect, it } from 'vitest';
import { computeWhyNow } from '../src/domain/whyNowCore';
import { clusterSimilarSignals } from '../src/domain/signalClusterCore';
import type { Signal } from '../src/types';

const NOW = Date.parse('2026-08-21T12:00:00Z');

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 36e5).toISOString();
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig_1',
    organizationId: 'org_aurora_01',
    clientId: 'client_juan_001',
    title: 'USPTO publishes examination guidance for AI-assisted inventions',
    contentSnippet: 'The office clarifies inventorship rules',
    sourceName: 'USPTO',
    sourceType: 'REGULATORY',
    sourceQuality: 'HIGH',
    fingerprint: 'fp_1',
    status: 'NEW',
    aiStatus: 'PENDING_AI',
    managerDecision: 'UNREVIEWED',
    detectedAt: hoursAgo(3),
    ...overrides,
  } as Signal;
}

describe('computeWhyNow novelty', () => {
  it('gives full novelty to something detected hours ago', () => {
    const result = computeWhyNow(makeSignal({ detectedAt: hoursAgo(2) }), undefined, { now: NOW });

    expect(result.drivers.find((d) => d.key === 'novelty')?.value).toBe(1);
    expect(result.reason).toContain('detectada hace 2 h');
  });

  it('decays novelty as the signal ages', () => {
    const fresh = computeWhyNow(makeSignal({ detectedAt: hoursAgo(3) }), undefined, { now: NOW });
    const week = computeWhyNow(makeSignal({ detectedAt: hoursAgo(24 * 5) }), undefined, { now: NOW });
    const month = computeWhyNow(makeSignal({ detectedAt: hoursAgo(24 * 40) }), undefined, { now: NOW });

    expect(fresh.score).toBeGreaterThan(week.score);
    expect(week.score).toBeGreaterThan(month.score);
    expect(week.reason).toContain('5 días');
  });

  it('treats a missing timestamp as very old instead of crashing', () => {
    const result = computeWhyNow(makeSignal({ detectedAt: '' }), undefined, { now: NOW });
    expect(result.drivers.find((d) => d.key === 'novelty')?.value).toBe(0.1);
  });
});

describe('computeWhyNow conversation velocity', () => {
  it('rewards a story that many sources pick up in a short window', () => {
    const signals = [
      makeSignal({ id: 'sig_a', sourceName: 'USPTO', detectedAt: hoursAgo(6) }),
      makeSignal({ id: 'sig_b', sourceName: 'Reuters', detectedAt: hoursAgo(5) }),
      makeSignal({ id: 'sig_c', sourceName: 'Law360', detectedAt: hoursAgo(4) }),
      makeSignal({ id: 'sig_d', sourceName: 'IPWatchdog', detectedAt: hoursAgo(3) }),
    ];
    const cluster = clusterSimilarSignals(signals)[0];

    const clustered = computeWhyNow(signals[0], cluster, { now: NOW });
    const alone = computeWhyNow(signals[0], undefined, { now: NOW });

    expect(cluster.memberCount).toBe(4);
    expect(clustered.drivers.find((d) => d.key === 'velocity')!.value).toBeGreaterThan(
      alone.drivers.find((d) => d.key === 'velocity')!.value
    );
    expect(clustered.drivers.find((d) => d.key === 'velocity')!.phrase).toBe('4 fuentes en 6 h');
    expect(clustered.score).toBeGreaterThan(alone.score);
  });

  it('keeps velocity low for a single-source story', () => {
    const cluster = clusterSimilarSignals([makeSignal()])[0];
    const result = computeWhyNow(makeSignal(), cluster, { now: NOW });

    expect(result.drivers.find((d) => d.key === 'velocity')?.value).toBe(0.15);
  });
});

describe('computeWhyNow regulatory pressure', () => {
  it('maxes out for a regulator as the source', () => {
    const result = computeWhyNow(makeSignal({ sourceType: 'REGULATORY' }), undefined, { now: NOW });

    expect(result.drivers.find((d) => d.key === 'regulatory')?.value).toBe(1);
    expect(result.reason).toContain('publicada por un regulador');
  });

  it('detects a normative change in the text of a non-regulatory source', () => {
    const result = computeWhyNow(
      makeSignal({
        sourceType: 'NEWS_API',
        title: 'Final rule on AI disclosure takes effect in January',
        contentSnippet: 'The compliance deadline forces enterprises to adapt',
      }),
      undefined,
      { now: NOW }
    );

    expect(result.drivers.find((d) => d.key === 'regulatory')?.value).toBe(0.7);
  });

  it('stays low when nothing normative changed', () => {
    const result = computeWhyNow(
      makeSignal({
        sourceType: 'RSS',
        title: 'Startup raises funding for a chatbot',
        contentSnippet: 'A consumer product launch',
      }),
      undefined,
      { now: NOW }
    );

    expect(result.drivers.find((d) => d.key === 'regulatory')?.value).toBe(0.15);
  });
});

describe('computeWhyNow media window and saturation', () => {
  it('grows with the number of additional outlets covering the story', () => {
    const signals = [
      makeSignal({ id: 'sig_a', sourceName: 'USPTO' }),
      makeSignal({ id: 'sig_b', sourceName: 'Reuters' }),
      makeSignal({ id: 'sig_c', sourceName: 'Law360' }),
      makeSignal({ id: 'sig_d', sourceName: 'IPWatchdog' }),
      makeSignal({ id: 'sig_e', sourceName: 'Bloomberg Law' }),
    ];
    const cluster = clusterSimilarSignals(signals)[0];
    const result = computeWhyNow(signals[0], cluster, { now: NOW });

    expect(result.drivers.find((d) => d.key === 'mediaWindow')?.value).toBe(1);
    expect(result.drivers.find((d) => d.key === 'mediaWindow')?.phrase).toContain('4 medios adicionales');
  });

  it('discounts the score when the client already published on the angle', () => {
    const plain = computeWhyNow(makeSignal(), undefined, { now: NOW });
    const saturated = computeWhyNow(makeSignal(), undefined, {
      now: NOW,
      ownPublishedOnTopic: 3,
    });

    expect(saturated.saturation).toBe(1);
    expect(saturated.score).toBeLessThan(plain.score);
    expect(saturated.reason).toContain('saturado');
  });

  it('counts prior coverage at half weight', () => {
    const result = computeWhyNow(makeSignal(), undefined, { now: NOW, priorCoverageCount: 3 });
    expect(result.saturation).toBe(0.5);
  });
});

describe('computeWhyNow bands', () => {
  it('bands a fresh regulatory story as NOW', () => {
    const signals = [
      makeSignal({ id: 'sig_a', sourceName: 'USPTO', detectedAt: hoursAgo(2) }),
      makeSignal({ id: 'sig_b', sourceName: 'Reuters', detectedAt: hoursAgo(1) }),
      makeSignal({ id: 'sig_c', sourceName: 'Law360', detectedAt: hoursAgo(1) }),
      makeSignal({ id: 'sig_d', sourceName: 'IPWatchdog', detectedAt: hoursAgo(1) }),
    ];
    const cluster = clusterSimilarSignals(signals)[0];

    expect(computeWhyNow(signals[0], cluster, { now: NOW }).band).toBe('NOW');
  });

  it('bands an old single-source non-regulatory story as STALE', () => {
    const result = computeWhyNow(
      makeSignal({
        sourceType: 'RSS',
        title: 'Opinion piece about productivity tools',
        contentSnippet: 'A general commentary',
        detectedAt: hoursAgo(24 * 40),
      }),
      undefined,
      { now: NOW }
    );

    expect(result.band).toBe('STALE');
    expect(result.score100).toBeLessThan(45);
  });
});
