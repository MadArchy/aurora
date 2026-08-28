/**
 * CR-1 Workstream 5 — Execution Delivery consumer facade.
 *
 * #28 TransitionClientTask · #31 SaveContentDraft · #32 ReviewClientArticle
 * SPEC-006 gate is consumed, not owned. No SPEC-008 learning. No providers.
 */

import type { ContentStatus, ContentType } from '../types';
import {
  ExecutionDeliveryError,
  type ClientArticleReviewDecision,
  type ClientTaskTransitionIntent,
  type ReviewClientArticleResult,
  type SaveContentDraftResult,
  type TransitionClientTaskResult,
} from '../application/executionDelivery';
import { composeExecutionDelivery } from '../composition/executionDelivery/composeExecutionDelivery';
import { requireTenantScope } from '../controllers/trustedTenant';
import { authService } from './auth';
import { auditService } from './audit';
import { dbService } from './db';

type ExecutionDeliveryUseCases = ReturnType<typeof composeExecutionDelivery>;

let useCases: ExecutionDeliveryUseCases = composeExecutionDelivery();

export function resetExecutionDeliveryConsumerForTest(next?: ExecutionDeliveryUseCases): void {
  useCases = next ?? composeExecutionDelivery();
}

function mapError(err: unknown, fallback: string): never {
  if (err instanceof ExecutionDeliveryError) throw err;
  throw new ExecutionDeliveryError(
    'PERSISTENCE_ERROR',
    err instanceof Error ? err.message : fallback
  );
}

function gate(requestedClientId: string | null | undefined) {
  const decision = requireTenantScope(requestedClientId, {
    getCurrentUser: () => authService.getCurrentUser(),
    getClientById: (id) => dbService.getClientById(id),
  });
  if (!decision.ok) {
    throw new ExecutionDeliveryError('ACTOR_NOT_AUTHORIZED', decision.message);
  }
  return decision;
}

function trustedFrom(g: ReturnType<typeof gate>) {
  return {
    actorId: g.actorId,
    actorRole: g.actorRole,
    organizationId: g.organizationId,
    clientId: g.clientId,
    now: new Date().toISOString(),
  };
}

/** Registry #28 */
export function transitionClientTask(intent: {
  requestedClientId: string | null | undefined;
  taskId: string;
  intent: ClientTaskTransitionIntent;
  evidenceUrl?: string;
  clientNotes?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
}): TransitionClientTaskResult {
  const g = gate(intent.requestedClientId);
  try {
    const result = useCases.transitionClientTask({
      trusted: trustedFrom(g),
      taskId: intent.taskId,
      intent: intent.intent,
      evidenceUrl: intent.evidenceUrl,
      clientNotes: intent.clientNotes,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedStatus: intent.claimedStatus,
    });
    auditService.log(authService.getCurrentUser(), 'TRANSITION_CLIENT_TASK', 'Task', result.task.id, {
      intent: result.intent,
      status: result.task.status,
    });
    return result;
  } catch (err) {
    mapError(err, 'No se pudo actualizar la tarea');
  }
}

/** Registry #31 */
export function saveContentDraft(intent: {
  requestedClientId: string | null | undefined;
  contentId: string;
  fields: {
    title?: string;
    body?: string;
    type?: ContentType;
    targetPlatform?: 'LinkedIn' | 'YouTube' | 'PersonalWebsite' | 'Substack' | 'LegalJournal';
    teleprompterScript?: string;
    managerNotes?: string;
    claimSafety?: import('../types').ClaimSafetyVerdictRecord;
  };
  requestedTargetStatus?: ContentStatus;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedPipelineStatus?: string;
  claimedPublicationState?: string;
  claimedClaimSafetyVerdict?: string;
  claimedStrategicBriefId?: string;
}): SaveContentDraftResult {
  const g = gate(intent.requestedClientId);
  try {
    const result = useCases.saveContentDraft({
      trusted: trustedFrom(g),
      contentId: intent.contentId,
      fields: intent.fields,
      requestedTargetStatus: intent.requestedTargetStatus,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedStatus: intent.claimedStatus,
      claimedPipelineStatus: intent.claimedPipelineStatus,
      claimedPublicationState: intent.claimedPublicationState,
      claimedClaimSafetyVerdict: intent.claimedClaimSafetyVerdict,
      claimedStrategicBriefId: intent.claimedStrategicBriefId,
    });
    auditService.log(authService.getCurrentUser(), 'EDIT_CONTENT', 'ContentItem', result.content.id, {
      advanced: result.advanced,
    });
    return result;
  } catch (err) {
    mapError(err, 'No se pudo guardar el borrador');
  }
}

/** Registry #32 */
export function reviewClientArticle(intent: {
  requestedClientId: string | null | undefined;
  contentId: string;
  decision: ClientArticleReviewDecision;
  title?: string;
  body?: string;
  reason?: string;
  taskId?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedPipelineStatus?: string;
  claimedPublicationState?: string;
  claimedClaimSafetyVerdict?: string;
}): ReviewClientArticleResult {
  const g = gate(intent.requestedClientId);
  try {
    const result = useCases.reviewClientArticle({
      trusted: trustedFrom(g),
      contentId: intent.contentId,
      decision: intent.decision,
      title: intent.title,
      body: intent.body,
      reason: intent.reason,
      taskId: intent.taskId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedStatus: intent.claimedStatus,
      claimedPipelineStatus: intent.claimedPipelineStatus,
      claimedPublicationState: intent.claimedPublicationState,
      claimedClaimSafetyVerdict: intent.claimedClaimSafetyVerdict,
    });
    auditService.log(
      authService.getCurrentUser(),
      'REVIEW_CLIENT_ARTICLE',
      'ContentItem',
      result.content.id,
      { decision: result.decision }
    );
    return result;
  } catch (err) {
    mapError(err, 'No se pudo registrar la revisión del artículo');
  }
}
