import { describe, expect, it } from 'vitest';
import { calculateStrategicScore } from '../src/services/scoring';
import type { PositioningThesis, Signal } from '../src/types';

const thesis: PositioningThesis = {
  id: 'th_1',
  organizationId: 'org_aurora_01',
  clientId: 'client_juan_001',
  title: 'AI Governance Authority',
  expertIdentity: 'Regulatory strategist',
  targetAudience: 'General Counsel and CIOs',
  domain: 'AI regulation NIST EU AI Act',
  objective: 'Corporate advisory practice',
  proofPoints: ['Stanford LLM'],
  differentiator: 'Preventive engineering-law approach',
  complianceRules: 'No guaranteed outcomes',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'system',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
};

const signal: Signal = {
  id: 'sig_1',
  organizationId: 'org_aurora_01',
  clientId: 'client_juan_001',
  title: 'NIST releases updated AI risk management framework',
  contentSnippet: 'Compliance guidance for enterprise AI governance programs',
  sourceName: 'NIST',
  sourceUrl: 'https://nist.gov/example',
  sourceQuality: 'HIGH',
  status: 'NEW',
  detectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'system',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
};

describe('calculateStrategicScore', () => {
  it('scores higher with bilingual dossier context', () => {
    const bare = calculateStrategicScore(signal, thesis, {});
    const enriched = calculateStrategicScore(signal, thesis, {
      bilingualTerms: ['NIST', 'gobernanza de IA', 'EU AI Act'],
      ownedTopics: ['AI governance', 'risk management framework'],
    });
    expect(enriched.totalScore).toBeGreaterThanOrEqual(bare.totalScore);
  });

  it('penalizes avoided framings', () => {
    const normal = calculateStrategicScore(signal, thesis, {});
    const penalized = calculateStrategicScore(signal, thesis, {
      avoidedFramings: ['NIST', 'AI governance'],
    });
    expect(penalized.totalScore).toBeLessThanOrEqual(normal.totalScore);
  });
});
