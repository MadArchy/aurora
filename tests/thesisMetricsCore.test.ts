import { describe, expect, it } from 'vitest';
import { computeThesisLearningMetrics } from '../src/domain/thesisMetricsCore';
import type { ContentItem, PositioningThesis, Signal, SignalOutcome } from '../src/types';

function thesis(): PositioningThesis {
  return {
    id: 't1',
    organizationId: 'org',
    clientId: 'c1',
    title: 'Patent',
    expertIdentity: 'counsel',
    targetAudience: 'GC',
    domain: 'IP',
    objective: 'TL',
    proofPoints: ['USPTO'],
    voiceAndTone: 'precise',
    complianceRules: '',
    status: 'ACTIVE',
    clientApprovalStatus: 'APPROVED',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'a',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'a',
  };
}

describe('computeThesisLearningMetrics', () => {
  it('aggregates signal outcomes, overrides and claim findings per thesis', () => {
    const t = thesis();
    const signals: Signal[] = [
      {
        id: 's1',
        organizationId: 'org',
        clientId: 'c1',
        title: 'USPTO update',
        sourceType: 'REGULATORY',
        sourceName: 'USPTO',
        contentSnippet: 'patent',
        fingerprint: 'f1',
        detectedAt: '2026-08-01T00:00:00.000Z',
        status: 'NEW',
        aiStatus: 'IDLE',
        managerDecision: 'SAVED',
        thesisId: 't1',
        routingDecision: { source: 'MANUAL', contested: true },
      },
      {
        id: 's2',
        organizationId: 'org',
        clientId: 'c1',
        title: 'Other',
        sourceType: 'NEWS_API',
        sourceName: 'News',
        contentSnippet: 'x',
        fingerprint: 'f2',
        detectedAt: '2026-08-01T00:00:00.000Z',
        status: 'NEW',
        aiStatus: 'IDLE',
        managerDecision: 'UNREVIEWED',
        thesisId: 't1',
        routingDecision: { source: 'AUTO' },
      },
    ];
    const outcomes: SignalOutcome[] = [
      {
        id: 'o1',
        organizationId: 'org',
        clientId: 'c1',
        signalId: 's1',
        kind: 'USEFUL',
        source: 'RADAR',
        actorUid: 'u1',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ];
    const content: ContentItem[] = [
      {
        id: 'c1',
        organizationId: 'org',
        clientId: 'c1',
        thesisId: 't1',
        type: 'LINKEDIN_ARTICLE',
        title: 'Post',
        body: 'Fundador de 3ITAL',
        targetPlatform: 'LinkedIn',
        status: 'PUBLISHED',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        claimSafety: {
          verdict: 'BLOCK',
          summary: '1 bloqueo',
          reviewedAt: '2026-08-01T00:00:00.000Z',
          findings: [{ kind: 'CREDENTIAL', severity: 'BLOCK', claim: 'Fundador', detail: 'x', action: 'y' }],
        },
      },
    ];

    const metrics = computeThesisLearningMetrics({
      thesis: t,
      signals,
      outcomes,
      content,
      evidence: [],
    });

    expect(metrics.signalsScored).toBe(2);
    expect(metrics.signalsUseful).toBe(1);
    expect(metrics.routingOverrides).toBe(1);
    expect(metrics.contentPublished).toBe(1);
    expect(metrics.claimBlocks).toBe(1);
    expect(metrics.summary).toContain('autoridad');
  });
});
