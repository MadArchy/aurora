import { z } from 'zod';

const ThesisChallengeOutcomeSchema = z.enum(['READY', 'REFINE', 'SPLIT', 'PAUSE', 'REJECT']);

/** challengeThesis LLM JSON. */
export const ThesisChallengeOutputSchema = z
  .object({
    outcome: ThesisChallengeOutcomeSchema,
    recommendations: z.array(z.string()).min(1),
    riskScore: z.number().min(0).max(100),
  })
  .strict();

export type ThesisChallengeOutput = z.infer<typeof ThesisChallengeOutputSchema>;

export const THESIS_CHALLENGE_SCHEMA_ID = 'thesis.challenge';
export const THESIS_CHALLENGE_SCHEMA_VERSION = '1';
