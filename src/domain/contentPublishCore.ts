import { mapLegacyContentStatus, resolvePipelineStepsToTarget } from './contentPipeline';
import type { ContentItem, ContentPipelineStatus } from '../types';

export const PIPELINE_STATUS_LABELS: Record<ContentPipelineStatus, string> = {
  planned: 'Planificado',
  generating: 'Generando',
  draft_ready: 'Borrador listo',
  manager_review: 'Revisión manager',
  sent_to_client: 'Enviado al cliente',
  client_in_progress: 'Cliente editando',
  client_submitted: 'Aprobado por cliente',
  manager_finalizing: 'Manager finalizando',
  qa_check: 'Control QA',
  ready_to_publish: 'Listo para publicar',
  published: 'Publicado',
  cancelled: 'Cancelado',
};

export type ContentPipelineAction = 'finalize' | 'qa_pass' | 'mark_ready' | 'publish';

const ACTION_TARGETS: Record<ContentPipelineAction, ContentPipelineStatus> = {
  finalize: 'manager_finalizing',
  qa_pass: 'qa_check',
  mark_ready: 'ready_to_publish',
  publish: 'published',
};

export const PIPELINE_ACTION_LABELS: Record<ContentPipelineAction, string> = {
  finalize: 'Tomar para finalizar',
  qa_pass: 'Pasar control QA',
  mark_ready: 'Marcar listo para publicar',
  publish: 'Publicar',
};

/** Acciones de pipeline disponibles para el manager según el estado actual. */
export function availablePipelineActions(
  content: Pick<ContentItem, 'pipelineStatus' | 'status'>
): ContentPipelineAction[] {
  const pipeline = content.pipelineStatus || mapLegacyContentStatus(content.status);
  const actions: ContentPipelineAction[] = [];

  if (pipeline === 'client_submitted') {
    actions.push('finalize');
  }
  if (pipeline === 'manager_finalizing') {
    actions.push('qa_pass');
  }
  if (pipeline === 'qa_check') {
    actions.push('mark_ready');
  }
  if (pipeline === 'ready_to_publish') {
    actions.push('publish');
  }

  return actions;
}

export function pipelineActionTarget(action: ContentPipelineAction): ContentPipelineStatus {
  return ACTION_TARGETS[action];
}

export function resolvePipelineActionSteps(
  content: Pick<ContentItem, 'pipelineStatus' | 'status'>,
  action: ContentPipelineAction
): ContentPipelineStatus[] {
  const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
  const target = pipelineActionTarget(action);
  if (current === target) return [];
  return resolvePipelineStepsToTarget(current, target);
}

export function pipelineStatusLabel(content: Pick<ContentItem, 'pipelineStatus' | 'status'>): string {
  const pipeline = content.pipelineStatus || mapLegacyContentStatus(content.status);
  return PIPELINE_STATUS_LABELS[pipeline] || pipeline;
}
