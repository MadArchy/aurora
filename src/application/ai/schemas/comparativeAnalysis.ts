import { z } from 'zod';

/** Single-provider comparative slice (runComparativeAnalysis per provider). */
export const ComparativeAnalysisOutputSchema = z
  .object({
    angle: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export type ComparativeAnalysisOutput = z.infer<typeof ComparativeAnalysisOutputSchema>;

export const ANALYSIS_COMPARATIVE_SCHEMA_ID = 'analysis.comparative';
export const ANALYSIS_COMPARATIVE_SCHEMA_VERSION = '1';
