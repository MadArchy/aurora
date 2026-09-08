/**
 * P4 presentation-only open for REVIEW_ARTICLE.
 * Mirrors legacy `markArticleReviewStarted` — lives outside React UI so the
 * T-010-503 React dbService import ban remains intact.
 */
import { dbService } from './db';
import { transitionClientTask } from './executionDeliveryConsumer';
import { resolveArticleSavePipelineSteps } from '../domain/articleReviewCore';
import { pipelineActor } from '../controllers/contentPipelineCommands';
import { ExecutionDeliveryError } from '../application/executionDelivery';

export function openClientArticleReviewPresentation(intent: {
  requestedClientId: string | null | undefined;
  contentId: string;
  taskId?: string;
}): { ok: true } | { ok: false; message: string } {
  try {
    const content = dbService.getContentById(intent.contentId);
    if (!content) {
      return { ok: false, message: 'Contenido no encontrado' };
    }

    if (intent.taskId) {
      const task = dbService.getAllTasks().find((row) => row.id === intent.taskId);
      if (!task) {
        return { ok: false, message: 'Tarea no encontrada' };
      }
      if (task.type !== 'REVIEW_ARTICLE') {
        return { ok: false, message: 'Solo tareas REVIEW_ARTICLE abren revisión nativa' };
      }
      if (task.status === 'ASSIGNED' || task.status === 'VIEWED' || task.status === 'DRAFT') {
        try {
          transitionClientTask({
            requestedClientId: intent.requestedClientId ?? task.clientId,
            taskId: task.id,
            intent: 'start',
          });
        } catch {
          /* ya avanzada */
        }
      }
    }

    const steps = resolveArticleSavePipelineSteps(content);
    const actor = pipelineActor();
    for (const step of steps) {
      dbService.transitionContentPipeline(intent.contentId, step, actor, 'Cliente revisando borrador');
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof ExecutionDeliveryError || err instanceof Error
          ? err.message
          : 'No se pudo abrir la revisión del artículo',
    };
  }
}
