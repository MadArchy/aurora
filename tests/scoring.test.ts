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

describe('calculateStrategicScore with a structured thesis', () => {
  const structured: PositioningThesis = {
    ...thesis,
    territories: [
      { id: 'terr_gov', name: 'AI Governance', weight: 100, keywords: ['nist', 'governance', 'framework'] },
      { id: 'terr_consumer', name: 'Consumer AI', weight: 15, keywords: ['chatbot', 'consumer'] },
    ],
    audiences: [
      { id: 'aud_gc', name: 'General Counsel', tier: 'COMMERCIAL', weight: 95, keywords: ['enterprise', 'compliance'] },
      { id: 'aud_press', name: 'Periodistas', tier: 'AMPLIFICATION', weight: 40, keywords: ['media'] },
    ],
    objectives: [{ id: 'obj_business', kind: 'BUSINESS', weight: 90 }],
  };

  it('reports which territory and audience matched', () => {
    const result = calculateStrategicScore(signal, structured, {});

    expect(result.matchedTerritory).toBe('AI Governance');
    expect(result.matchedAudience).toBe('General Counsel');
    expect(result.strategicRationale).toContain('Territorio: AI Governance');
  });

  it('scores a low-weight territory below a core one', () => {
    const consumerSignal: Signal = {
      ...signal,
      id: 'sig_consumer',
      title: 'New consumer chatbot launches with viral growth',
      contentSnippet: 'A consumer chatbot reaches ten million users',
    };

    const core = calculateStrategicScore(signal, structured, {});
    const marginal = calculateStrategicScore(consumerSignal, structured, {});

    expect(marginal.factors.thesisMatch).toBeLessThan(core.factors.thesisMatch);
  });

  it('derives commercial potential from the business objective weight', () => {
    const lowBusiness = calculateStrategicScore(
      signal,
      { ...structured, objectives: [{ id: 'obj_business', kind: 'BUSINESS', weight: 10 }] },
      {}
    );
    const highBusiness = calculateStrategicScore(signal, structured, {});

    expect(highBusiness.factors.commercialPotential).toBeGreaterThan(lowBusiness.factors.commercialPotential);
  });

  it('forces NO_ACTION and reports the rule when a hard limit appears', () => {
    const result = calculateStrategicScore(
      signal,
      { ...structured, limits: { hardBlocks: ['NIST'], softAvoid: [] } },
      {}
    );

    expect(result.recommendedAction).toBe('NO_ACTION');
    expect(result.blockedByLimit).toBe('NIST');
  });

  it('penalizes soft limits declared on the thesis', () => {
    const plain = calculateStrategicScore(signal, structured, {});
    const penalized = calculateStrategicScore(
      signal,
      { ...structured, limits: { hardBlocks: [], softAvoid: ['risk management framework'] } },
      {}
    );

    expect(penalized.penalties.conflict).toBeGreaterThan(plain.penalties.conflict);
  });

  it('derives structured match from legacy free-text theses', () => {
    const legacy = calculateStrategicScore(signal, thesis, {});
    // El dominio libre se convierte en territorio; la audiencia libre también.
    expect(legacy.matchedTerritory || legacy.matchedAudience).toBeTruthy();
    expect(legacy.blockedByLimit).toBeUndefined();
  });

  it('uses authorityScore from context when provided', () => {
    const weak = calculateStrategicScore(signal, structured, { authorityScore: 10 });
    const strong = calculateStrategicScore(signal, structured, { authorityScore: 90 });
    expect(strong.factors.authorityFit).toBeGreaterThan(weak.factors.authorityFit);
    expect(strong.totalScore).toBeGreaterThan(weak.totalScore);
  });
});
