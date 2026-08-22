import { mapLegacyContentStatus, resolvePipelineStepsToTarget } from './contentPipeline';
import type { ContentItem, ContentPipelineStatus } from '../types';

/** Tras enviar video, el contenido queda listo para revisión del manager. */
export const VIDEO_SUBMIT_PIPELINE_TARGET: ContentPipelineStatus = 'manager_finalizing';

/** Pasos del pipeline al enviar una grabación desde el teleprompter. */
export function resolveVideoSubmitPipelineSteps(
  content: Pick<ContentItem, 'pipelineStatus' | 'status'>
): ContentPipelineStatus[] {
  const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
  if (current === VIDEO_SUBMIT_PIPELINE_TARGET) return [];
  return resolvePipelineStepsToTarget(current, VIDEO_SUBMIT_PIPELINE_TARGET);
}
