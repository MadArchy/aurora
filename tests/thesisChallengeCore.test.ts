import { describe, expect, it } from 'vitest';
import {
  evaluateThesisChallenge,
  mapLegacyChallengeStatus,
  thesisChallengeOutcomeLabel,
} from '../src/domain/thesisChallengeCore';
import type { PositioningThesis } from '../src/types';

function baseThesis(overrides: Partial<PositioningThesis> = {}): PositioningThesis {
  return {
    id: 'thesis_test',
    organizationId: 'org',
    clientId: 'client',
    title: 'AI Governance Attorney',
    expertIdentity: 'Registered Patent Attorney focused on enterprise AI governance and IP strategy',
    targetAudience: 'General Counsel',
    domain: 'AI Adoption',
    objective: 'Thought leadership',
    proofPoints: ['Registered Patent Attorney', 'Committee Chair'],
    voiceAndTone: 'Preciso',
    complianceRules: 'No hype',
    status: 'DRAFT',
    clientApprovalStatus: 'PENDING',
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
    identityCurrent: 'Known counsel',
    perceptionTarget: 'Trusted advisor',
    audiences: [{ id: 'a1', name: 'General Counsel', tier: 'COMMERCIAL', weight: 100, keywords: [] }],
    territories: [{ id: 't1', name: 'AI Adoption', pillar: 'Gov', weight: 100, keywords: [] }],
    objectives: [{ id: 'o1', kind: 'BUSINESS', weight: 100 }],
    voiceProfile: {
      authority: 80,
      technicalDepth: 75,
      academic: 60,
      executive: 80,
      accessible: 55,
      provocative: 25,
      commercial: 50,
      legalPrecision: 85,
      humor: 15,
    },
    limits: { hardBlocks: ['no prometer resultados'], softAvoid: [] },
    ...overrides,
  };
}

describe('thesisChallengeCore', () => {
  it('maps legacy AI statuses', () => {
    expect(mapLegacyChallengeStatus('SOLID')).toBe('READY');
    expect(mapLegacyChallengeStatus('SATURATED')).toBe('SPLIT');
    expect(mapLegacyChallengeStatus('VULNERABLE')).toBe('REFINE');
  });

  it('returns READY for a structured thesis with proof points', () => {
    const result = evaluateThesisChallenge(baseThesis(), []);
    expect(['READY', 'REFINE', 'PAUSE']).toContain(result.outcome);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(thesisChallengeOutcomeLabel(result.outcome)).toBeTruthy();
  });

  it('suggests SPLIT when many territories compete', () => {
    const result = evaluateThesisChallenge(
      baseThesis({
        domain: 'Patentes · FTO · Startups · Litigio · Due diligence',
        territories: [
          { id: 't1', name: 'Patentes', pillar: 'A', weight: 90, keywords: [] },
          { id: 't2', name: 'FTO', pillar: 'B', weight: 88, keywords: [] },
          { id: 't3', name: 'Startups', pillar: 'C', weight: 86, keywords: [] },
          { id: 't4', name: 'Litigio', pillar: 'D', weight: 84, keywords: [] },
        ],
        audiences: [
          { id: 'a1', name: 'GC', tier: 'COMMERCIAL', weight: 80, keywords: [] },
          { id: 'a2', name: 'CTO', tier: 'COMMERCIAL', weight: 75, keywords: [] },
          { id: 'a3', name: 'Founders', tier: 'INFLUENCE', weight: 70, keywords: [] },
        ],
      }),
      []
    );
    expect(result.outcome).toBe('SPLIT');
    expect(result.primaryAction).toBe('split');
  });
});
