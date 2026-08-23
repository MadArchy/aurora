import { z } from 'zod';

/** First migration target — generateContentDraft (tmpl_content_v1). */
export const ContentDraftOutputSchema = z
  .object({
    title: z.string().min(1).max(500),
    body: z.string().min(1),
  })
  .strict();

export type ContentDraftOutput = z.infer<typeof ContentDraftOutputSchema>;

export const CONTENT_DRAFT_SCHEMA_ID = 'content.draft';
export const CONTENT_DRAFT_SCHEMA_VERSION = '1';
