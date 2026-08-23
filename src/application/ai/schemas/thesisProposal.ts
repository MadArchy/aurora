import { z } from 'zod';

const AudienceTierSchema = z.enum(['COMMERCIAL', 'INFLUENCE', 'AMPLIFICATION']);
const ObjectiveKindSchema = z.enum(['BUSINESS', 'THOUGHT_LEADERSHIP', 'SPEAKING', 'INSTITUTIONAL', 'NETWORK']);

/** generateThesisProposal LLM JSON (thesis-generator-v1). */
export const ThesisProposalOutputSchema = z
  .object({
    title: z.string().min(1),
    expertIdentity: z.string().min(1),
    identityCurrent: z.string().min(1),
    perceptionTarget: z.string().min(1),
    targetAudience: z.string().min(1),
    domain: z.string().min(1),
    objective: z.string().min(1),
    differentiator: z.string().min(1),
    proofPoints: z.array(z.string()).min(1),
    audiences: z
      .array(
        z
          .object({
            name: z.string().min(1),
            tier: AudienceTierSchema,
            weight: z.number().min(0).max(100),
          })
          .strict()
      )
      .min(1),
    territories: z
      .array(
        z
          .object({
            name: z.string().min(1),
            weight: z.number().min(0).max(100),
            pillar: z.string().min(1),
          })
          .strict()
      )
      .min(1),
    objectives: z
      .array(
        z
          .object({
            kind: ObjectiveKindSchema,
            weight: z.number().min(0).max(100),
          })
          .strict()
      )
      .min(1),
    voiceAndTone: z.string().min(1),
    voiceAvoid: z.array(z.string()),
    hardBlocks: z.array(z.string()),
    softAvoid: z.array(z.string()),
    complianceRules: z.string().min(1),
  })
  .strict();

export type ThesisProposalOutput = z.infer<typeof ThesisProposalOutputSchema>;

export const THESIS_PROPOSAL_SCHEMA_ID = 'thesis.proposal';
export const THESIS_PROPOSAL_SCHEMA_VERSION = '1';
