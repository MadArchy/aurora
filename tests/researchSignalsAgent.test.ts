import { describe, expect, it } from 'vitest';
import type { PositioningThesis, Signal } from '../src/types';
import {
  buildResearchQuery,
  synthesizeResearchSummary,
} from '../src/domain/researchSignalsCore';

const thesis: PositioningThesis = {
  id: 'th_1',
  organizationId: 'org_1',
  clientId: 'client_juan_001',
  title: 'IP + AI Adoption',
  expertIdentity: 'Patent attorney',
  targetAudience: 'GC',
  domain: 'Intellectual property AI',
  objective: 'Authority',
  proofPoints: [],
  voiceAndTone: 'Precise',
  complianceRules: 'No legal advice',
  status: 'ACTIVE',
  clientApprovalStatus: 'APPROVED',
  createdAt: '2026-01-01',
  createdBy: 'admin',
  updatedAt: '2026-01-01',
  updatedBy: 'admin',
};

const signal: Signal = {
  id: 'sig_1',
  organizationId: 'org_1',
  clientId: 'client_juan_001',
  title: 'USPTO guidance on AI-assisted patent drafting',
  sourceType: 'REGULATORY',
  sourceName: 'USPTO',
  contentSnippet: 'New guidance',
  fingerprint: 'fp1',
  detectedAt: new Date().toISOString(),
  status: 'NEW',
  aiStatus: 'PENDING_AI',
  managerDecision: 'UNREVIEWED',
  recommendedAction: 'RESEARCH_REQUIRED',
};

describe('researchSignalsAgent', () => {
  it('builds a Tavily query from signal + thesis', () => {
    const q = buildResearchQuery(signal, thesis, {
      coreEn: ['patent law', 'AI adoption'],
      coreEs: ['patentes'],
      strong: ['uspto', 'nist'],
      context: ['legal'],
      negative: [],
    });
    expect(q).toContain('USPTO guidance');
    expect(q).toContain('Intellectual property AI');
    expect(q.length).toBeLessThanOrEqual(400);
  });

  it('summarizes trusted evidence as SHORT_POST candidate', () => {
    const summary = synthesizeResearchSummary(signal, thesis, [
      { title: 'USPTO AI report', url: 'https://www.uspto.gov/news', snippet: 'Guidance' },
      { title: 'NIST AI RMF', url: 'https://www.nist.gov/ai', snippet: 'Framework' },
    ]);
    expect(summary.suggestedNextStep).toBe('SHORT_POST');
    expect(summary.summary).toMatch(/autoridad/i);
  });

  it('returns MONITOR when no evidence', () => {
    const summary = synthesizeResearchSummary(signal, thesis, []);
    expect(summary.suggestedNextStep).toBe('MONITOR');
  });
});
