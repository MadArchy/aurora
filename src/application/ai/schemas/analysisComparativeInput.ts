import { z } from 'zod';

/** Structured gateway input — preserves legacy runComparativeAnalysis fields. */
export const AnalysisComparativeGatewayInputSchema = z
  .object({
    signalId: z.string().min(1).max(200),
    thesisId: z.string().min(1).max(200),
    thesisTitle: z.string().min(1).max(500),
    targetAudience: z.string().min(1).max(500),
    signalTitle: z.string().min(1).max(500),
    signalSnippet: z.string().min(1).max(4000),
  })
  .strict();

export type AnalysisComparativeGatewayInput = z.infer<typeof AnalysisComparativeGatewayInputSchema>;

export const ANALYSIS_COMPARATIVE_PROMPT_ID = 'tmpl_comparative_analysis_v1';
export const ANALYSIS_COMPARATIVE_PROMPT_VERSION = '1';

export function renderAnalysisComparativeUserMessage(input: AnalysisComparativeGatewayInput): string {
  return [
    `Compara ángulos para la tesis ${input.thesisTitle} ante ${input.targetAudience}. Fuente no confiable:`,
    '<UNTRUSTED_SOURCE>',
    input.signalTitle,
    input.signalSnippet,
    '</UNTRUSTED_SOURCE>',
    'JSON { "angle": string, "rationale": string }',
  ].join('\n');
}
