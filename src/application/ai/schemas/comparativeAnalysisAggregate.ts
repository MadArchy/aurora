import { z } from 'zod';
import {
  ComparativeAnalysisOutputSchema,
  ANALYSIS_COMPARATIVE_SCHEMA_ID,
  ANALYSIS_COMPARATIVE_SCHEMA_VERSION,
  type ComparativeAnalysisOutput,
} from './comparativeAnalysis';

/**
 * Deterministic Application aggregate after BOTH provider slices validate.
 * Not a third AI call — software aggregation of independent validated slices.
 */
export const ComparativeAnalysisAggregateSchema = z
  .object({
    openai: ComparativeAnalysisOutputSchema,
    anthropic: ComparativeAnalysisOutputSchema,
  })
  .strict();

export type ComparativeAnalysisAggregate = z.infer<typeof ComparativeAnalysisAggregateSchema>;

export {
  ComparativeAnalysisOutputSchema,
  ANALYSIS_COMPARATIVE_SCHEMA_ID,
  ANALYSIS_COMPARATIVE_SCHEMA_VERSION,
  type ComparativeAnalysisOutput,
};

export const ANALYSIS_COMPARATIVE_AGGREGATE_SCHEMA_ID = 'analysis.comparativeAggregate';
export const ANALYSIS_COMPARATIVE_AGGREGATE_SCHEMA_VERSION = '1';
