import { z } from 'zod';

export const ContentDraftFormatSchema = z.enum([
  'VIDEO_SCRIPT',
  'LINKEDIN_ARTICLE',
  'ACADEMIC_PAPER',
  'THOUGHT_LEADERSHIP',
]);

export type ContentDraftFormat = z.infer<typeof ContentDraftFormatSchema>;

export const ContentDraftAcademicExtrasSchema = z
  .object({
    roleAngle: z.string().optional(),
    venueLabel: z.string().optional(),
    why: z.string().optional(),
  })
  .strict();

/** Structured gateway input — preserves legacy generateContentDraft semantics. */
export const ContentDraftGatewayInputSchema = z
  .object({
    format: ContentDraftFormatSchema,
    topicTitle: z.string().min(1).max(500),
    voiceHint: z.string().min(1).max(500),
    perceptionTarget: z.string().min(1).max(500),
    evidenceHint: z.string().min(1).max(2000),
    hardBlocks: z.string().min(1).max(2000),
    voiceAvoid: z.string().min(1).max(500),
    expertIdentity: z.string().min(1).max(500),
    angle: z.string().max(500).optional(),
    academic: ContentDraftAcademicExtrasSchema.optional(),
  })
  .strict();

export type ContentDraftGatewayInput = z.infer<typeof ContentDraftGatewayInputSchema>;

export const CONTENT_DRAFT_PROMPT_ID = 'tmpl_content_v1';
export const CONTENT_DRAFT_PROMPT_VERSION = '1';

export function renderContentDraftUserMessage(input: ContentDraftGatewayInput): string {
  const academicHint =
    input.format === 'ACADEMIC_PAPER'
      ? `\nFormato: artículo científico / working paper (${input.academic?.venueLabel || 'working paper'}).\nÁngulo de rol: ${input.academic?.roleAngle || input.expertIdentity}.\nPor qué centrarnos aquí: ${input.academic?.why || 'inteligencia del radar + tesis'}.\nEstructura: abstract, problema, marco, evidencia verificable, implicaciones, límites, referencias. No inventes citas.`
      : '';

  return `Redacta ${input.format} en voz ${input.voiceHint}.
Percepción objetivo: ${input.perceptionTarget}.
No inventes credenciales fuera de: ${input.evidenceHint}.
Límites duros (nunca violar): ${input.hardBlocks}.
Evitar en voz: ${input.voiceAvoid}.
Tema: ${input.topicTitle}${input.angle ? `\nÁngulo: ${input.angle}` : ''}
Identidad: ${input.expertIdentity}${academicHint}
JSON { "title": string, "body": string }`;
}
