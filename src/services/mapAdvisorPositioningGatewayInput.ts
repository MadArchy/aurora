import type { Client, ClientProfile, EvidenceVaultItem, ImageDiagnosis, PositioningThesis, ResultRecord, Topic } from '../types';
import {
  AdvisorPositioningGatewayInputSchema,
  type AdvisorPositioningGatewayInput,
} from '../application/ai/schemas/advisorPositioningInput';

export interface AdvisorPositioningSourceInput {
  client: Client;
  thesis?: PositioningThesis;
  profile: ClientProfile | null;
  evidence: EvidenceVaultItem[];
  results: ResultRecord[];
  topics: Topic[];
  diagnosis: ImageDiagnosis;
}

export function mapAdvisorPositioningToGatewayInput(
  source: AdvisorPositioningSourceInput
): AdvisorPositioningGatewayInput {
  const { client, thesis, profile, evidence, results, topics, diagnosis } = source;

  return AdvisorPositioningGatewayInputSchema.parse({
    client: {
      profession: client.profession,
      targetMarket: client.targetMarket,
      profileCompleteness: client.profileCompleteness,
      onboardingStatus: client.onboardingStatus,
    },
    thesis: thesis
      ? {
          title: thesis.title,
          expertIdentity: thesis.expertIdentity,
          targetAudience: thesis.targetAudience,
          domain: thesis.domain,
          objective: thesis.objective,
          proofPoints: thesis.proofPoints || [],
          differentiator: thesis.differentiator,
          complianceRules: thesis.complianceRules,
          clientApprovalStatus: thesis.clientApprovalStatus,
        }
      : null,
    profile: profile
      ? {
          headline: profile.identity.professionalHeadline,
          primaryGoal: profile.goals.primaryGoal,
          yearsExperience: profile.career.yearsExperience,
          education: profile.education.map((e) => `${e.degree} — ${e.institution}`),
          publications: profile.keyPublications.map((p) => p.title),
          tone: profile.voicePreferences.tone,
          topicsToAvoid: profile.voicePreferences.topicsToAvoid,
        }
      : null,
    evidence: {
      total: evidence.length,
      verified: evidence.filter((e) => e.verified).length,
      types: Array.from(new Set(evidence.map((e) => e.type))),
    },
    results: results.slice(0, 8).map((r) => `${r.title}: ${r.metricLabel} ${r.metricValue}`),
    radarTopics: topics.slice(0, 6).map((t) => ({
      label: t.label,
      signalCount: t.signalCount,
      topScore: t.topScore,
      momentum: t.momentum,
    })),
    localDiagnosis: {
      authorityScore: diagnosis.authorityScore,
      consistencyScore: diagnosis.consistencyScore,
      evidenceScore: diagnosis.evidenceScore,
      visibilityScore: diagnosis.visibilityScore,
    },
  });
}
