import { describe, expect, it } from 'vitest';
import {
  buildCuratedPresetsForIndustry,
  detectIndustryPreset,
  getIndustryPresetMeta,
} from '../src/services/industryPresets';
import type { Client, PositioningThesis } from '../src/types';

const baseClient: Client = {
  id: 'c1',
  organizationId: 'org_1',
  displayName: 'Test',
  email: 't@test.com',
  profession: 'Consultant',
  status: 'ACTIVE',
  onboardingStatus: 'COMPLETED',
  profileCompleteness: 80,
  activeThesesCount: 1,
  completedTasksCount: 0,
  createdAt: '2026-01-01',
  createdBy: 'admin',
  updatedAt: '2026-01-01',
  updatedBy: 'admin',
};

const thesis: PositioningThesis = {
  id: 'th_1',
  organizationId: 'org_1',
  clientId: 'c1',
  title: 'AI in banking',
  expertIdentity: 'Fintech advisor',
  targetAudience: 'CFOs',
  domain: 'Open banking regulation',
  objective: 'Authority',
  proofPoints: [],
  voiceAndTone: 'Clear',
  complianceRules: 'None',
  status: 'ACTIVE',
  clientApprovalStatus: 'APPROVED',
  createdAt: '2026-01-01',
  createdBy: 'admin',
  updatedAt: '2026-01-01',
  updatedBy: 'admin',
};

describe('industryPresets', () => {
  it('detects IP legal preset for Juan-like profile', () => {
    const juan: Client = { ...baseClient, profession: 'Registered Patent Attorney' };
    const ipThesis = { ...thesis, domain: 'Intellectual property AI adoption' };
    expect(detectIndustryPreset(juan, ipThesis)).toBe('IP_LEGAL');
  });

  it('detects fintech preset', () => {
    expect(detectIndustryPreset(baseClient, thesis)).toBe('FINTECH');
  });

  it('builds three curated sources per preset', () => {
    const sources = buildCuratedPresetsForIndustry('HEALTHCARE', {
      coreEn: ['medical device'],
      coreEs: [],
      strong: ['fda'],
      context: [],
      negative: [],
    });
    expect(sources).toHaveLength(3);
    expect(sources.every((s) => s.key.startsWith('curated_healthcare_'))).toBe(true);
  });

  it('exposes human-readable preset labels', () => {
    expect(getIndustryPresetMeta('CYBERSECURITY').label).toMatch(/Ciberseguridad/i);
  });
});
