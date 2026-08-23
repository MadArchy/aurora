import { z } from 'zod';

/** Structured gateway input — preserves legacy proposeAngle prompt fields. */
export const AdvisorCurationAngleGatewayInputSchema = z
  .object({
    thesisTitle: z.string().min(1).max(500),
    expertIdentity: z.string().min(1).max(500),
    targetAudience: z.string().min(1).max(500),
    complianceRules: z.string().max(2000),
    signalTitle: z.string().min(1).max(500),
    signalSnippet: z.string().min(1).max(4000),
  })
  .strict();

export type AdvisorCurationAngleGatewayInput = z.infer<typeof AdvisorCurationAngleGatewayInputSchema>;

export const ADVISOR_CURATION_ANGLE_PROMPT_ID = 'tmpl_curation_angle_v1';
export const ADVISOR_CURATION_ANGLE_PROMPT_VERSION = '1';

export function renderAdvisorCurationAngleUserMessage(input: AdvisorCurationAngleGatewayInput): string {
  return [
    `Tesis: ${input.thesisTitle}`,
    `Identidad experta: ${input.expertIdentity}`,
    `Audiencia: ${input.targetAudience}`,
    `Límites deontológicos: ${input.complianceRules || 'sin límites duros'}`,
    'Propone un ángulo editorial en una frase que el cliente pueda defender con su evidencia.',
    '<UNTRUSTED_SOURCE>',
    `Título: ${input.signalTitle}`,
    input.signalSnippet,
    '</UNTRUSTED_SOURCE>',
    'Responde SOLO JSON: { "angle": string }',
  ].join('\n');
}
