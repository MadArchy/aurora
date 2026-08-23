import { z } from 'zod';

const AdviceCategorySchema = z.enum(['CONTENT', 'CREDENTIAL', 'VISIBILITY', 'EVIDENCE', 'NETWORK', 'RISK']);
const AdviceHorizonSchema = z.enum(['DAYS_30', 'DAYS_60', 'DAYS_90']);

/** generatePositioningAdvice LLM JSON (tmpl_positioning_advisor_v1). */
export const AdvisorPositioningOutputSchema = z
  .object({
    summary: z.string().min(1).optional(),
    diagnosis: z
      .object({
        strengths: z.array(z.string()).optional(),
        gaps: z.array(z.string()).optional(),
        risks: z.array(z.string()).optional(),
        authorityScore: z.number().min(0).max(100).optional(),
        visibilityScore: z.number().min(0).max(100).optional(),
      })
      .strict()
      .optional(),
    actions: z
      .array(
        z
          .object({
            title: z.string().min(1).optional(),
            description: z.string().min(1).optional(),
            category: AdviceCategorySchema.optional(),
            horizon: AdviceHorizonSchema.optional(),
            priority: z.number().min(0).max(100).optional(),
          })
          .strict()
      )
      .optional(),
  })
  .strict()
  .refine(
    (v) => Boolean(v.summary || v.diagnosis || (v.actions && v.actions.length > 0)),
    { message: 'At least one of summary, diagnosis, or actions is required' }
  );

export type AdvisorPositioningOutput = z.infer<typeof AdvisorPositioningOutputSchema>;

export const ADVISOR_POSITIONING_SCHEMA_ID = 'advisor.positioning';
export const ADVISOR_POSITIONING_SCHEMA_VERSION = '1';
