import { describe, expect, it } from 'vitest';
import { buildFactsFromProfile } from '../src/domain/profileFacts';
import { computeProfileCoverage, nextIncompleteOnboardingStep } from '../src/domain/profileCoverage';
import type { ClientProfile } from '../src/types';

const sampleProfile: ClientProfile = {
  organizationId: 'org',
  clientId: 'client',
  identity: { professionalHeadline: 'Headline', selfDescription: 'Desc', location: 'TX', languages: ['EN', 'ES'] },
  goals: { primaryGoal: 'Goal', secondaryGoals: ['G2', 'G3'] },
  audience: { targetAudienceDescription: 'GC', targetIndustries: ['Tech'], targetCountries: ['US'] },
  career: { profession: 'Attorney', currentRole: 'Member', currentCompany: 'Firm', yearsExperience: 10, industries: ['IP'] },
  education: [{ institution: 'UT', degree: 'BSEE', year: '2009' }],
  careerHistory: [{ role: 'Member', organization: 'Firm', period: '2022', highlight: 'Patents' }],
  ventures: ['3ITAL'],
  keyPublications: [{ title: 'Book', outlet: '2024' }],
  socialLinks: { linkedin: 'https://linkedin.com/in/x', website: 'https://example.com' },
  voicePreferences: { tone: 'authoritative', preferredPhrases: ['People + Tools + Rules'], topicsToAvoid: ['Hype'], complianceGuidelines: 'Bar rules' },
  facts: [],
  onboardingCompleted: true,
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('profileCoverage', () => {
  it('genera ≥20 facts y ≥5 secciones para perfil Juan-like', () => {
    const facts = buildFactsFromProfile(sampleProfile);
    const report = computeProfileCoverage({ ...sampleProfile, facts });
    expect(facts.length).toBeGreaterThanOrEqual(20);
    expect(report.sectionsWithFacts).toBeGreaterThanOrEqual(5);
    expect(report.meetsPilotThreshold).toBe(true);
  });

  it('salta al primer paso de onboarding incompleto', () => {
    const sparse: ClientProfile = {
      ...sampleProfile,
      facts: buildFactsFromProfile({
        ...sampleProfile,
        career: { ...sampleProfile.career, currentRole: '', currentCompany: '' },
        identity: { ...sampleProfile.identity, selfDescription: '' },
      }).filter((f) => f.section !== 'career' && f.section !== 'identity'),
    };
    expect(nextIncompleteOnboardingStep(sparse)).toBe(1);

    const facts = buildFactsFromProfile(sampleProfile);
    facts.push({
      id: 'fact_cred_bar',
      section: 'credentials',
      label: 'Colegiación',
      value: 'State Bar of Texas',
      status: 'confirmed',
      source: 'onboarding',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    expect(nextIncompleteOnboardingStep({ ...sampleProfile, facts })).toBe(6);
  });
});
