import { describe, expect, it } from 'vitest';
import { buildScoreBreakdown } from '../src/domain/scoreExplainCore';
import {
  canonicalSignalsFromClusters,
  clusterSimilarSignals,
  titleSimilarity,
} from '../src/domain/signalClusterCore';
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
  proofPoints: ['Stanford LLM', 'NIST workshop'],
  differentiator: 'Preventive engineering-law approach',
  complianceRules: 'No guaranteed outcomes',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'system',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
};

function makeSignal(partial: Partial<Signal> & Pick<Signal, 'id' | 'title' | 'sourceName'>): Signal {
  return {
    organizationId: 'org_aurora_01',
    clientId: 'client_juan_001',
    contentSnippet: 'Compliance guidance for enterprise AI governance programs',
    sourceType: 'RSS',
    fingerprint: partial.id,
    detectedAt: '2026-01-01T00:00:00Z',
    status: 'NEW',
    aiStatus: 'PENDING_AI',
    managerDecision: 'UNREVIEWED',
    sourceQuality: 'MEDIUM',
    ...partial,
  };
}

describe('score explainability', () => {
  it('builds ranked factor rows from a score result', () => {
    const signal = makeSignal({
      id: 'sig_1',
      title: 'NIST releases updated AI risk management framework',
      sourceName: 'NIST',
      sourceQuality: 'HIGH',
    });
    const score = calculateStrategicScore(signal, thesis, {
      bilingualTerms: ['NIST', 'AI governance'],
    });
    const breakdown = buildScoreBreakdown(score);
    expect(breakdown.totalScore).toBe(score.totalScore);
    expect(breakdown.factors.length).toBeGreaterThan(3);
    expect(breakdown.factors[0].points).toBeGreaterThanOrEqual(breakdown.factors[1].points);
    expect(breakdown.summary.length).toBeGreaterThan(10);
  });
});

describe('signal clustering', () => {
  it('detects similar headlines across outlets', () => {
    expect(
      titleSimilarity(
        'USPTO issues guidance on AI-assisted patent inventorship',
        'USPTO issues new guidance on AI-assisted patent inventorship rules'
      )
    ).toBeGreaterThanOrEqual(0.45);
    expect(
      titleSimilarity(
        'USPTO issues guidance on AI-assisted patent inventorship',
        'Mexico fintech open banking regulation advances in senate'
      )
    ).toBeLessThan(0.3);
  });

  it('clusters duplicate stories and picks a canonical signal', () => {
    const signals = [
      makeSignal({
        id: 'a',
        title: 'USPTO issues guidance on AI-assisted patent inventorship',
        sourceName: 'Bloomberg Law',
        relevanceScore: 72,
        sourceQuality: 'HIGH',
      }),
      makeSignal({
        id: 'b',
        title: 'USPTO issues new guidance on AI-assisted patent inventorship rules',
        sourceName: 'Law.com',
        relevanceScore: 68,
      }),
      makeSignal({
        id: 'c',
        title: 'Mexico fintech open banking regulation advances in senate',
        sourceName: 'Finextra',
        relevanceScore: 50,
      }),
    ];

    const clusters = clusterSimilarSignals(signals);
    const inventorship = clusters.find((c) => c.memberCount >= 2);
    expect(inventorship).toBeTruthy();
    expect(inventorship!.canonicalSignalId).toBe('a');
    expect(inventorship!.alsoIn).toContain('Law.com');

    const canonical = canonicalSignalsFromClusters(signals, clusters);
    expect(canonical.map((s) => s.id).sort()).toEqual(['a', 'c']);
  });
});
