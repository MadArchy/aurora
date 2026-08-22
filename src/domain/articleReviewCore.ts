import { mapLegacyContentStatus, resolvePipelineStepsToTarget } from './contentPipeline';
import { diffLines, hasDiffChanges, summarizeDiff } from './textDiff';
import type { ContentItem, ContentPipelineStatus, ContentStatus } from '../types';

/** Tras guardar ediciones del cliente, el borrador queda en progreso. */
export const ARTICLE_SAVE_PIPELINE_TARGET: ContentPipelineStatus = 'client_in_progress';

/** Tras aprobar, el manager puede finalizar. */
export const ARTICLE_APPROVE_PIPELINE_TARGET: ContentPipelineStatus = 'client_submitted';

export const ARTICLE_REJECT_LEGACY_STATUS: ContentStatus = 'CHANGES_REQUESTED';

const SECTION_MARKER_RE = /^\[(GANCHO|DESARROLLO|CIERRE|HOOK|BODY|CLOSE)\]/im;

export function hasArticleSectionMarkers(body: string): boolean {
  return SECTION_MARKER_RE.test(body.trim());
}

export function resolveArticleSavePipelineSteps(
  content: Pick<ContentItem, 'pipelineStatus' | 'status'>
): ContentPipelineStatus[] {
  const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
  if (
    current === ARTICLE_SAVE_PIPELINE_TARGET ||
    current === ARTICLE_APPROVE_PIPELINE_TARGET ||
    current === 'manager_finalizing'
  ) {
    return [];
  }
  if (current === 'sent_to_client') {
    return resolvePipelineStepsToTarget(current, ARTICLE_SAVE_PIPELINE_TARGET);
  }
  return [];
}

export function resolveArticleApprovePipelineSteps(
  content: Pick<ContentItem, 'pipelineStatus' | 'status'>
): ContentPipelineStatus[] {
  const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
  if (current === ARTICLE_APPROVE_PIPELINE_TARGET || current === 'manager_finalizing') {
    return [];
  }
  return resolvePipelineStepsToTarget(current, ARTICLE_APPROVE_PIPELINE_TARGET);
}

export interface ClientArticleRevisionPlan {
  hasTextChanges: boolean;
  diffSummary?: { added: number; removed: number; unchanged: number };
  pipelineStepsOnSave: ContentPipelineStatus[];
  pipelineStepsOnApprove: ContentPipelineStatus[];
}

/** Planifica diff y pasos de pipeline al guardar o aprobar un borrador. */
export function planClientArticleRevision(
  content: Pick<ContentItem, 'pipelineStatus' | 'status' | 'body' | 'clientReviewBaseline'>,
  input: { body: string }
): ClientArticleRevisionPlan {
  const baseline = content.clientReviewBaseline || content.body;
  const lines = diffLines(baseline, input.body);
  const hasTextChanges = hasDiffChanges(lines);

  return {
    hasTextChanges,
    diffSummary: hasTextChanges ? summarizeDiff(lines) : undefined,
    pipelineStepsOnSave: hasTextChanges ? resolveArticleSavePipelineSteps(content) : [],
    pipelineStepsOnApprove: resolveArticleApprovePipelineSteps(content),
  };
}
