import type { ClaimSafetyVerdictRecord, ContentItem, PositioningThesis } from '../../../types';

export type ContentDraftFormat = 'VIDEO_SCRIPT' | 'LINKEDIN_ARTICLE' | 'ACADEMIC_PAPER' | 'THOUGHT_LEADERSHIP';

export interface ContentDraftGenerationExtras {
  roleAngle?: string;
  venueLabel?: string;
  why?: string;
  angle?: string;
}

/** SPEC-005 gateway / local fallback — Execution Delivery does not call providers directly. */
export interface ContentDraftGenerationPort {
  generate(
    thesis: PositioningThesis,
    topicTitle: string,
    format: ContentDraftFormat,
    extras?: ContentDraftGenerationExtras
  ): Promise<Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>>;
  /** Advisory projection only — COMPATIBILITY_ONLY (SPEC-006). */
  reviewDraftClaims(body: string, thesis: PositioningThesis): ClaimSafetyVerdictRecord;
}
