import type { ContentPipelineStatus, ContentStatus } from '../types';

export const CONTENT_PIPELINE_TRANSITIONS: Record<ContentPipelineStatus, ContentPipelineStatus[]> = {
  planned: ['generating', 'cancelled'],
  generating: ['draft_ready', 'cancelled'],
  draft_ready: ['manager_review', 'cancelled'],
  manager_review: ['sent_to_client', 'draft_ready', 'cancelled'],
  sent_to_client: ['client_in_progress', 'cancelled'],
  client_in_progress: ['client_submitted', 'cancelled'],
  client_submitted: ['manager_finalizing', 'cancelled'],
  manager_finalizing: ['qa_check', 'client_in_progress', 'cancelled'],
  qa_check: ['ready_to_publish', 'manager_finalizing', 'cancelled'],
  ready_to_publish: ['published', 'cancelled'],
  published: [],
  cancelled: [],
};

/** Transiciones que requieren actor humano explícito (no SYSTEM). */
export const HUMAN_ONLY_PIPELINE_TARGETS = new Set<ContentPipelineStatus>([
  'sent_to_client',
  'client_submitted',
  'ready_to_publish',
  'published',
]);

export function mapLegacyContentStatus(status: ContentStatus): ContentPipelineStatus {
  switch (status) {
    case 'DRAFT':
    case 'AI_GENERATED':
      return 'draft_ready';
    case 'MANAGER_REVIEW':
      return 'manager_review';
    case 'MANAGER_APPROVED':
      return 'sent_to_client';
    case 'CLIENT_REVIEW':
      return 'sent_to_client';
    case 'CLIENT_APPROVED':
      return 'client_submitted';
    case 'CHANGES_REQUESTED':
      return 'client_in_progress';
    case 'READY':
      return 'ready_to_publish';
    case 'PUBLISHED':
      return 'published';
    default:
      return 'planned';
  }
}

export function syncLegacyStatusFromPipeline(pipeline: ContentPipelineStatus): ContentStatus {
  switch (pipeline) {
    case 'planned':
    case 'generating':
      return 'DRAFT';
    case 'draft_ready':
      return 'AI_GENERATED';
    case 'manager_review':
      return 'MANAGER_REVIEW';
    case 'sent_to_client':
      return 'CLIENT_REVIEW';
    case 'client_in_progress':
      return 'CHANGES_REQUESTED';
    case 'client_submitted':
    case 'manager_finalizing':
      return 'CLIENT_APPROVED';
    case 'qa_check':
      return 'MANAGER_REVIEW';
    case 'ready_to_publish':
      return 'READY';
    case 'published':
      return 'PUBLISHED';
    case 'cancelled':
      return 'DRAFT';
    default:
      return 'DRAFT';
  }
}

export function assertContentPipelineTransition(
  current: ContentPipelineStatus,
  next: ContentPipelineStatus,
  actorRole: 'ADMIN' | 'CLIENT' | 'SYSTEM'
): void {
  if (!CONTENT_PIPELINE_TRANSITIONS[current]?.includes(next)) {
    throw new Error(`CONTENT_INVALID_TRANSITION:${current}->${next}`);
  }
  if (next === 'published' && actorRole !== 'ADMIN') {
    throw new Error('CONTENT_PUBLISH_REQUIRES_ADMIN');
  }
  if (HUMAN_ONLY_PIPELINE_TARGETS.has(next) && actorRole === 'SYSTEM') {
    throw new Error('CONTENT_HUMAN_GATE_REQUIRED');
  }
}

/** Camino más corto entre estados del pipeline (para sincronizar legacy status). */
export function resolvePipelineStepsToTarget(
  current: ContentPipelineStatus,
  target: ContentPipelineStatus
): ContentPipelineStatus[] {
  if (current === target) return [];
  const queue: { state: ContentPipelineStatus; path: ContentPipelineStatus[] }[] = [
    { state: current, path: [] },
  ];
  const visited = new Set<ContentPipelineStatus>([current]);
  while (queue.length) {
    const { state, path } = queue.shift()!;
    for (const next of CONTENT_PIPELINE_TRANSITIONS[state] || []) {
      if (visited.has(next)) continue;
      const nextPath = [...path, next];
      if (next === target) return nextPath;
      visited.add(next);
      queue.push({ state: next, path: nextPath });
    }
  }
  throw new Error(`CONTENT_NO_PATH:${current}->${target}`);
}
