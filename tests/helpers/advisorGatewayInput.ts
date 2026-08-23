import type { AdvisorPositioningSourceInput } from '../../src/services/mapAdvisorPositioningGatewayInput';
import type { ImageDiagnosis } from '../../src/types';

export function minimalAdvisorPositioningSource(): AdvisorPositioningSourceInput {
  const diagnosis: ImageDiagnosis = {
    authorityScore: 55,
    consistencyScore: 60,
    evidenceScore: 40,
    visibilityScore: 45,
    strengths: ['Base strength'],
    gaps: ['Base gap'],
    risks: ['Base risk'],
  };

  return {
    client: {
      id: 'client_juan_001',
      organizationId: 'org_aurora_01',
      displayName: 'Dr. Juan Analyst',
      firstName: 'Juan',
      profession: 'Advisor',
      targetMarket: 'Enterprise',
      profileCompleteness: 70,
      onboardingStatus: 'COMPLETED',
    },
    thesis: {
      id: 'thesis_1',
      organizationId: 'org_aurora_01',
      clientId: 'client_juan_001',
      title: 'AI governance thesis',
      expertIdentity: 'Dr. Juan Analyst',
      domain: 'AI governance',
      targetAudience: 'CIOs',
      voiceAndTone: 'preciso',
      objective: 'thought leadership',
      proofPoints: ['ISO audit'],
      complianceRules: 'No medical claims',
      status: 'DRAFT',
      clientApprovalStatus: 'PENDING',
      createdAt: '2026-01-01T00:00:00Z',
      createdBy: 'admin',
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: 'admin',
    },
    profile: null,
    evidence: [],
    results: [],
    topics: [],
    diagnosis,
  };
}
