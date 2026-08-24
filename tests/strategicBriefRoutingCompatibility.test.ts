import { describe, expect, it } from 'vitest';
import { LocalStrategicContextReader } from '../src/infrastructure/strategicBrief';
import type { Signal } from '../src/types';

const NOW = '2026-08-24T21:10:00.000Z';

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
    ...overrides,
  };
}

describe('SPEC-003 compatibility — consume routingDecision.selectedThesisId', () => {
  it('CLEAR persisted selectedThesisId is governed thesis without signal.thesisId', () => {
    const signal = persistedClearSignal();
    delete signal.thesisId;
    const reader = new LocalStrategicContextReader({
      getSignalById: (id) => (id === signal.id ? signal : undefined),
      getEvidenceById: () => undefined,
    });
    const ctx = reader.getSignalContext(signal.id);
    expect(ctx?.routingState).toBe('CLEAR');
    expect(ctx?.governedThesisId).toBe('th_gov');
    expect(signal.thesisId).toBeUndefined();
  });

  it('routingDecision.selectedThesisId wins over a conflicting compatibility thesisId', () => {
    const signal = persistedClearSignal({ thesisId: 'th_legacy' });
    const reader = new LocalStrategicContextReader({
      getSignalById: (id) => (id === signal.id ? signal : undefined),
      getEvidenceById: () => undefined,
    });
    const ctx = reader.getSignalContext(signal.id);
    expect(ctx?.governedThesisId).toBe('th_gov');
    expect(ctx?.governedThesisId).not.toBe(signal.thesisId);
  });
});
