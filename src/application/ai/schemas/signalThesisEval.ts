import { z } from 'zod';

/** analyzeSignalAgainstThesis LLM JSON (tmpl_strategist_signal_eval_v2). */
export const SignalThesisEvalOutputSchema = z
  .object({
    proposedAngle: z.string().min(1),
    strategicRationale: z.string().min(1),
    recommendedAction: z.string().min(1),
  })
  .strict();

export type SignalThesisEvalOutput = z.infer<typeof SignalThesisEvalOutputSchema>;

export const SIGNAL_THESIS_EVAL_SCHEMA_ID = 'signal.thesisEval';
export const SIGNAL_THESIS_EVAL_SCHEMA_VERSION = '1';
