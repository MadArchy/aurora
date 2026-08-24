import { describe, expect, it, vi } from 'vitest';
import type { PositioningThesis, Signal } from '../src/types';
import {
  SCORING_FACTOR_WEIGHT_MAX_TOTAL,
  SCORING_VERSION,
  computeStrategicScoreMaterial,
  derivePriorityBand,
  toStrategicScoreResult,
} from '../src/domain/scoringCore';
import {
  reconstructBaseScore100,
  totalPenaltyPoints,
} from '../src/domain/scoreExplainCore';
import { calculateStrategicScore } from '../src/services/scoring';

const FIXED_NOW = Date.parse('2026-01-02T12:00:00Z');

const baseThesis: PositioningThesis = {
  id: 'th_1',
  organizationId: 'org_aurora_01',
  clientId: 'client_juan_001',
  title: 'AI Governance Authority',
  expertIdentity: 'Regulatory strategist',
  targetAudience: 'General Counsel and CIOs',
  domain: 'AI regulation NIST EU AI Act',
  objective: 'Corporate advisory practice',
  proofPoints: ['Stanford LLM', 'EU AI Act brief', 'NIST mapping', 'Board playbook'],
  differentiator: 'Preventive engineering-law approach',
  complianceRules: 'No guaranteed outcomes',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'system',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
  territories: [
    { id: 'terr_gov', name: 'AI Governance', weight: 100, keywords: ['nist', 'governance', 'framework'] },
  ],
  audiences: [
    { id: 'aud_gc', name: 'General Counsel', tier: 'COMMERCIAL', weight: 95, keywords: ['enterprise', 'compliance'] },
  ],
  objectives: [{ id: 'obj_business', kind: 'BUSINESS', weight: 90 }],
};

const baseSignal: Signal = {
  id: 'sig_1',
  organizationId: 'org_aurora_01',
  clientId: 'client_juan_001',
  title: 'NIST releases updated AI risk management framework',
  contentSnippet: 'Compliance guidance for enterprise AI governance programs',
  sourceName: 'NIST',
  sourceUrl: 'https://nist.gov/example',
  sourceType: 'REGULATORY',
  sourceQuality: 'HIGH',
  status: 'NEW',
  detectedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'system',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
};

function scoreAt(input: {
  signal?: Signal;
  thesis?: PositioningThesis;
  context?: Parameters<typeof computeStrategicScoreMaterial>[0]['context'];
  nowMs?: number;
}) {
  return computeStrategicScoreMaterial({
    signal: input.signal ?? baseSignal,
    thesis: input.thesis ?? baseThesis,
    context: input.context,
    nowMs: input.nowMs ?? FIXED_NOW,
  });
}

describe('SPEC-002 Phase 1 — scoringCore contract', () => {
  it('positive factor max weights total exactly 100', () => {
    expect(SCORING_FACTOR_WEIGHT_MAX_TOTAL).toBe(100);
  });

  it('every canonical result carries scoringVersion scoring-v1', () => {
    const material = scoreAt({});
    const result = toStrategicScoreResult(material, '2026-01-02T12:00:00.000Z');
    expect(material.scoringVersion).toBe('scoring-v1');
    expect(result.scoringVersion).toBe(SCORING_VERSION);
  });

  it('is deterministic for identical material inputs', () => {
    const input = {
      signal: baseSignal,
      thesis: baseThesis,
      context: { bilingualTerms: ['NIST', 'gobernanza de IA'] },
      nowMs: FIXED_NOW,
    };
    const a = computeStrategicScoreMaterial(input);
    const b = computeStrategicScoreMaterial(input);
    expect(b).toEqual(a);
  });

  it('priority band boundaries match baseline v1', () => {
    expect(derivePriorityBand(39)).toBe('LOW');
    expect(derivePriorityBand(40)).toBe('MEDIUM');
    expect(derivePriorityBand(69)).toBe('MEDIUM');
    expect(derivePriorityBand(70)).toBe('HIGH');
    expect(derivePriorityBand(84)).toBe('HIGH');
    expect(derivePriorityBand(85)).toBe('CRITICAL');
  });

  it('clamps negative raw totals to 0 and caps at 100', () => {
    const heavyPenalties = scoreAt({
      signal: {
        ...baseSignal,
        title: 'Fraude y escandalo ilegal en conflicto',
        contentSnippet: 'controversia conflicto risk management framework',
      },
      thesis: { ...baseThesis, proofPoints: [] },
      context: { avoidedFramings: ['risk management framework', 'NIST', 'governance', 'AI'] },
    });
    expect(heavyPenalties.totalScore).toBeGreaterThanOrEqual(0);
    expect(heavyPenalties.totalScore).toBeLessThanOrEqual(100);

    const highMatch = scoreAt({
      context: {
        bilingualTerms: ['NIST', 'gobernanza de IA', 'EU AI Act', 'framework', 'governance'],
        ownedTopics: ['AI governance', 'risk management framework', 'enterprise compliance'],
        whyNow: { score: 1, reason: 'Regulatory window' },
        authorityScore: 100,
      },
    });
    expect(highMatch.totalScore).toBeLessThanOrEqual(100);
  });

  it('reconstructs pre-clamp total and final score from factors and penalties', () => {
    const material = scoreAt({});
    const base = reconstructBaseScore100(material.factors);
    const penaltySum = totalPenaltyPoints(material.penalties);
    const expected = Math.round(Math.max(0, Math.min(100, base - penaltySum)));
    expect(base).toBeCloseTo(material.baseScore100, 5);
    expect(material.totalScore).toBe(expected);
  });

  it('high strategic match profile yields HIGH or CRITICAL band', () => {
    const material = scoreAt({
      context: {
        bilingualTerms: ['NIST', 'gobernanza de IA', 'EU AI Act'],
        ownedTopics: ['AI governance', 'risk management framework'],
        whyNow: { score: 0.95, reason: 'Active regulatory cycle' },
        authorityScore: 92,
      },
    });
    expect(['HIGH', 'CRITICAL']).toContain(material.priorityBand);
    expect(material.recommendedDisposition).not.toBe('NO_ACTION');
  });

  it('penalty-heavy profile lowers score vs enriched baseline', () => {
    const baseline = scoreAt({});
    const penalized = scoreAt({
      context: { avoidedFramings: ['NIST', 'AI governance', 'framework'] },
    });
    expect(penalized.totalScore).toBeLessThanOrEqual(baseline.totalScore);
    expect(penalized.penalties.conflict).toBeGreaterThanOrEqual(baseline.penalties.conflict);
  });

  it('separates disposition from output format on canonical material', () => {
    const videoTier = scoreAt({
      context: {
        bilingualTerms: ['NIST', 'gobernanza de IA', 'EU AI Act'],
        ownedTopics: ['AI governance', 'risk management framework'],
        whyNow: { score: 1, reason: 'Peak attention' },
        authorityScore: 95,
      },
    });
    if (videoTier.recommendedOutputFormat === 'VIDEO') {
      expect(videoTier.recommendedDisposition).toBe('SAVE');
    }
    if (videoTier.recommendedDisposition === 'RESEARCH_REQUIRED') {
      expect(videoTier.recommendedOutputFormat).toBe('NONE');
    }
  });

  it('services wrapper parity — delegates to canonical core with injected clock', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const material = scoreAt({ nowMs: FIXED_NOW });
    const wrapper = calculateStrategicScore(baseSignal, baseThesis, {});
    expect(wrapper.factors).toEqual(material.factors);
    expect(wrapper.penalties).toEqual(material.penalties);
    expect(wrapper.totalScore).toBe(material.totalScore);
    expect(wrapper.priorityBand).toBe(material.priorityBand);
    expect(wrapper.scoringVersion).toBe('scoring-v1');
    expect(wrapper.recommendedDisposition).toBe(material.recommendedDisposition);
    expect(wrapper.recommendedOutputFormat).toBe(material.recommendedOutputFormat);
    vi.restoreAllMocks();
  });
});
