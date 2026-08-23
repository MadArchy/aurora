import { z } from 'zod';

/** Structured gateway input — preserves legacy analyzeSignalAgainstThesis prompt fields. */
export const SignalThesisEvalGatewayInputSchema = z
  .object({
    thesisId: z.string().min(1).max(200),
    thesisTitle: z.string().min(1).max(500),
    expertIdentity: z.string().min(1).max(500),
    targetAudience: z.string().min(1).max(500),
    domain: z.string().min(1).max(500),
    complianceRules: z.string().max(2000),
    signalId: z.string().min(1).max(200),
    signalTitle: z.string().min(1).max(500),
    signalSourceName: z.string().min(1).max(500),
    signalSnippet: z.string().min(1).max(4000),
  })
  .strict();

export type SignalThesisEvalGatewayInput = z.infer<typeof SignalThesisEvalGatewayInputSchema>;

export const SIGNAL_THESIS_EVAL_PROMPT_ID = 'tmpl_strategist_signal_eval_v2';
export const SIGNAL_THESIS_EVAL_PROMPT_VERSION = '2';

export function renderSignalThesisEvalUserMessage(input: SignalThesisEvalGatewayInput): string {
  return `Tesis: ${input.thesisTitle}
Identidad: ${input.expertIdentity}
Audiencia: ${input.targetAudience}
Dominio: ${input.domain}
Límites: ${input.complianceRules || 'sin límites duros'}
<UNTRUSTED_SOURCE>
Título: ${input.signalTitle}
Fuente: ${input.signalSourceName}
${input.signalSnippet}
</UNTRUSTED_SOURCE>
Devuelve JSON { "proposedAngle": string, "strategicRationale": string, "recommendedAction": string }`;
}
