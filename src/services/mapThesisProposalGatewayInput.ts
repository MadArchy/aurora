import type { ThesisEditableFields } from '../types';
import { dbService } from './db';
import { buildThesisProposalFromProfile } from '../domain/thesisProposalCore';
import {
  ThesisProposalGatewayInputSchema,
  type ThesisProposalGatewayInput,
} from '../application/ai/schemas/thesisProposalInput';
import type { ThesisProposalOutput } from '../application/ai/schemas/thesisProposal';

export function mapClientToThesisProposalGatewayInput(clientId: string): {
  input: ThesisProposalGatewayInput;
  fallback: ThesisEditableFields;
  organizationId: string;
} | null {
  const client = dbService.getClientById(clientId);
  const profile = dbService.getMasterProfile(clientId);
  const dossier = dbService.getMasterDossier(clientId);
  const evidence = dbService.getEvidenceVaultByClient(clientId);
  const fallback = buildThesisProposalFromProfile({ client, profile, dossier, evidence });
  if (!client) return null;

  const input = ThesisProposalGatewayInputSchema.parse({
    name: client.displayName || client.firstName || clientId,
    profession: profile?.career?.profession || client.profession || undefined,
    selfDescription: profile?.identity?.selfDescription || undefined,
    primaryGoal: profile?.goals?.primaryGoal || undefined,
    audience: profile?.audience?.targetAudienceDescription || undefined,
    industries: profile?.audience?.targetIndustries || undefined,
    dossierTagline: dossier?.taglineEn || undefined,
    topicsToOwn: dossier?.topicsToOwn || undefined,
    proofPoints: fallback.proofPoints?.length ? fallback.proofPoints : ['Credencial confirmada'],
    compliance: profile?.voicePreferences?.complianceGuidelines || undefined,
  });

  return { input, fallback, organizationId: client.organizationId };
}

/** Maps validated gateway output into form-ready ThesisEditableFields (no persistence). */
export function mapThesisProposalOutputToEditableFields(
  output: ThesisProposalOutput,
  fallback: ThesisEditableFields
): ThesisEditableFields {
  return {
    title: output.title || fallback.title,
    expertIdentity: output.expertIdentity || fallback.expertIdentity,
    identityCurrent: output.identityCurrent || fallback.identityCurrent,
    perceptionTarget: output.perceptionTarget || fallback.perceptionTarget,
    targetAudience: output.targetAudience || fallback.targetAudience,
    domain: output.domain || fallback.domain,
    objective: output.objective || fallback.objective,
    differentiator: output.differentiator || fallback.differentiator,
    proofPoints: output.proofPoints.length ? output.proofPoints : fallback.proofPoints,
    voiceAndTone: output.voiceAndTone || fallback.voiceAndTone,
    complianceRules: output.complianceRules || fallback.complianceRules,
    audiences: output.audiences.map((a, i) => ({
      id: `aud_prop_${i}`,
      name: a.name,
      tier: a.tier,
      weight: a.weight,
      keywords: [],
    })),
    territories: output.territories.map((t, i) => ({
      id: `ter_prop_${i}`,
      name: t.name,
      weight: t.weight,
      pillar: t.pillar || t.name,
      keywords: [],
    })),
    objectives: output.objectives.map((o, i) => ({
      id: `obj_prop_${i}`,
      kind: o.kind,
      weight: o.weight,
    })),
    voiceProfile: {
      ...fallback.voiceProfile!,
      style: output.voiceAndTone || fallback.voiceAndTone,
      avoid: output.voiceAvoid.length ? output.voiceAvoid : fallback.voiceProfile?.avoid,
    },
    limits: {
      hardBlocks: output.hardBlocks.length ? output.hardBlocks : fallback.limits?.hardBlocks || [],
      softAvoid: output.softAvoid.length ? output.softAvoid : fallback.limits?.softAvoid || [],
    },
    priority: fallback.priority,
  };
}
