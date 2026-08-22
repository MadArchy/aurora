import { describe, expect, it } from 'vitest';
import { buildThesisProposalFromProfile } from '../src/domain/thesisProposalCore';
import type { Client, ClientProfile, MasterDossier } from '../src/types';

describe('buildThesisProposalFromProfile', () => {
  it('derives a structured proposal from profile and dossier', () => {
    const client: Client = {
      id: 'client_1',
      organizationId: 'org_1',
      displayName: 'Juan Vasquez',
      firstName: 'Juan',
      lastName: 'Vasquez',
      profession: 'Attorney',
      company: 'Vasquez IP',
      targetMarket: 'General Counsel',
      status: 'ACTIVE',
      onboardingStatus: 'COMPLETED',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const profile: ClientProfile = {
      organizationId: 'org_1',
      clientId: 'client_1',
      identity: { selfDescription: 'Patent attorney focused on AI adoption' },
      goals: { primaryGoal: 'Consolidar autoridad en gobernanza de IA' },
      audience: { targetAudienceDescription: 'General Counsel, IP Counsel' },
      career: { profession: 'Attorney', currentRole: 'Partner' },
      education: [{ institution: 'Stanford', degree: 'LL.M.', year: '2014' }],
      careerHistory: [],
      ventures: [],
      keyPublications: [],
      socialLinks: {},
      voicePreferences: {
        tone: 'authoritative',
        preferredPhrases: [],
        topicsToAvoid: ['hype'],
        complianceGuidelines: 'No garantizar resultados',
      },
      onboardingCompleted: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const dossier: MasterDossier = {
      id: 'dos_1',
      organizationId: 'org_1',
      clientId: 'client_1',
      version: '1',
      updatedAt: '2026-01-01T00:00:00.000Z',
      taglineEn: 'AI Adoption & IP Governance Attorney',
      subtitleEn: '',
      executiveSummary: 'Referente en adopción responsable de IA.',
      narrativeArc: '',
      identityDimensions: [],
      serviceLines: [],
      targetAudiences: ['General Counsel'],
      differentiators: ['Law × engineering'],
      topicsToOwn: ['AI Adoption', 'Patent Strategy'],
      topicsToAvoid: ['consumer hype'],
      clientQuestions: [],
      pendingVerification: [],
      channelGuides: [],
      newsEditorialRule: '',
    };

    const proposal = buildThesisProposalFromProfile({
      client,
      profile,
      dossier,
      evidence: [],
    });

    expect(proposal.title).toContain('AI Adoption');
    expect(proposal.expertIdentity).toBeTruthy();
    expect(proposal.audiences?.length).toBeGreaterThan(0);
    expect(proposal.territories?.length).toBeGreaterThan(0);
    expect(proposal.proofPoints.length).toBeGreaterThanOrEqual(2);
    expect(proposal.limits?.hardBlocks.length).toBeGreaterThan(0);
  });
});
