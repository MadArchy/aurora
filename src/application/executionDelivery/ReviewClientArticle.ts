import type { ContentItem, FeedbackEvent } from '../../types';
import {
  planClientArticleRevision,
  resolveArticleApprovePipelineSteps,
  resolveArticleSavePipelineSteps,
  ARTICLE_REJECT_LEGACY_STATUS,
} from '../../domain/articleReviewCore';
import {
  mapLegacyContentStatus,
  resolvePipelineStepsToTarget,
} from '../../domain/contentPipeline';
import { assertClaimSafeTransition } from '../../domain/claimSafetyGateCore';
import { ExecutionDeliveryError } from './errors';
import type { ContentPublicationGatePort, ContentRepository } from './ports/ContentRepository';
import type { TaskRepository } from './ports/TaskRepository';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireClientRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export type ClientArticleReviewDecision = 'save_revision' | 'approve' | 'request_changes';

export interface ReviewClientArticleInput {
  trusted: TrustedExecutionDeliveryContext;
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
}

export interface ReviewClientArticleResult {
  content: ContentItem;
  decision: ClientArticleReviewDecision;
  feedbackEvent?: FeedbackEvent | null;
  taskCompleted?: boolean;
}

export interface ReviewClientArticleDeps {
  contents: ContentRepository;
  tasks: TaskRepository;
  publicationGate: ContentPublicationGatePort;
}

function advancePipeline(
  deps: ReviewClientArticleDeps,
  contentId: string,
  steps: ReturnType<typeof resolveArticleSavePipelineSteps>,
  actor: { uid: string; role: 'CLIENT' },
  comment: string
): ContentItem {
  let content = deps.contents.getById(contentId)!;
  for (const step of steps) {
    content = deps.contents.transitionPipeline({
      contentId,
      next: step,
      actor,
      comment,
    });
  }
  return content;
}

/**
 * CR-1 #32 — ReviewClientArticle.
 * Domain: articleReviewCore + contentPipeline. Article approval ≠ SPEC-006 publication.
 */
export function createReviewClientArticle(deps: ReviewClientArticleDeps) {
  return function reviewClientArticle(
    input: ReviewClientArticleInput
  ): ReviewClientArticleResult {
    assertTrustedExecutionContext(input.trusted);
    requireClientRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
      claimedStatus: input.claimedStatus,
      claimedPipelineStatus: input.claimedPipelineStatus,
      claimedPublicationState: input.claimedPublicationState,
      claimedClaimSafetyVerdict: input.claimedClaimSafetyVerdict,
    });

    const contentId = input.contentId?.trim();
    if (!contentId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'contentId is required.');
    }
    if (
      input.decision !== 'save_revision' &&
      input.decision !== 'approve' &&
      input.decision !== 'request_changes'
    ) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Invalid article review decision.');
    }

    const existing = deps.contents.getById(contentId);
    if (!existing) {
      throw new ExecutionDeliveryError('CONTENT_NOT_FOUND', 'Contenido no encontrado.');
    }
    if (existing.organizationId !== input.trusted.organizationId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Content organization does not match trusted session.'
      );
    }
    if (existing.clientId !== input.trusted.clientId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Content does not belong to the authenticated client.'
      );
    }

    const actor = { uid: input.trusted.actorId, role: 'CLIENT' as const };

    if (input.decision === 'save_revision') {
      const title = input.title?.trim();
      const body = input.body?.trim();
      if (!title || !body) {
        throw new ExecutionDeliveryError('INVALID_INPUT', 'title and body are required to save revision.');
      }
      const plan = planClientArticleRevision(existing, { body });
      const event = deps.contents.saveClientRevision({
        contentId,
        title,
        body,
        actorUid: input.trusted.actorId,
        taskId: input.taskId,
      });
      let content = deps.contents.getById(contentId)!;
      if (event && plan.pipelineStepsOnSave.length) {
        content = advancePipeline(
          deps,
          contentId,
          plan.pipelineStepsOnSave,
          actor,
          'Cliente editando borrador'
        );
      }
      return { content, decision: input.decision, feedbackEvent: event };
    }

    if (input.decision === 'approve') {
      if (input.title?.trim() && input.body?.trim()) {
        deps.contents.saveClientRevision({
          contentId,
          title: input.title.trim(),
          body: input.body.trim(),
          actorUid: input.trusted.actorId,
          taskId: input.taskId,
        });
      }

      let content = deps.contents.getById(contentId)!;
      const targetLegacy: ContentItem['status'] = 'CLIENT_APPROVED';
      const canonical = deps.publicationGate.authorize({
        contentId: content.id,
        organizationId: content.organizationId,
        clientId: content.clientId,
        targetStatus: targetLegacy,
        actorId: input.trusted.actorId,
        actorRole: 'CLIENT',
        now: input.trusted.now,
      });
      const gate = assertClaimSafeTransition(content.status, targetLegacy, content.claimSafety, {
        canonical: {
          allowed: canonical.allowed,
          reason: canonical.reason,
          reasonCode: canonical.reasonCode,
        },
      });
      if (!gate.allowed) {
        throw new ExecutionDeliveryError(
          'PUBLICATION_GATE_DENIED',
          gate.reason || 'Claim publication gate blocks article approval advance.'
        );
      }

      const steps = resolveArticleApprovePipelineSteps(content);
      if (steps.length) {
        content = advancePipeline(deps, contentId, steps, actor, 'Aprobado por cliente');
      } else {
        const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
        const target = mapLegacyContentStatus(targetLegacy);
        if (current !== target) {
          const path = resolvePipelineStepsToTarget(current, target);
          content = advancePipeline(deps, contentId, path, actor, 'Aprobado por cliente');
        }
      }

      const feedback = deps.contents.addFeedback({
        organizationId: content.organizationId,
        clientId: content.clientId,
        contentId,
        taskId: input.taskId,
        kind: 'CLIENT_APPROVE',
        actorUid: input.trusted.actorId,
        actorRole: 'CLIENT',
      });

      let taskCompleted = false;
      const linked =
        (input.taskId ? deps.tasks.getById(input.taskId) : undefined) ||
        deps.tasks
          .listByClient(input.trusted.clientId)
          .find(
            (t) =>
              t.contentItemId === contentId &&
              t.type === 'REVIEW_ARTICLE' &&
              t.status !== 'COMPLETED' &&
              t.status !== 'CANCELLED'
          );
      if (linked && linked.clientId === input.trusted.clientId) {
        try {
          deps.tasks.saveStatus({
            taskId: linked.id,
            status: 'COMPLETED',
            clientNotes: 'Artículo aprobado por el cliente.',
            completedAt: input.trusted.now,
          });
          taskCompleted = true;
        } catch {
          /* Domain may deny — article still approved */
        }
      }

      return {
        content: deps.contents.getById(contentId)!,
        decision: input.decision,
        feedbackEvent: feedback,
        taskCompleted,
      };
    }

    // request_changes
    const reason = input.reason?.trim();
    if (!reason) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'reason is required to request changes.');
    }

    let content = deps.contents.getById(contentId)!;
    const targetLegacy = ARTICLE_REJECT_LEGACY_STATUS;
    const canonical = deps.publicationGate.authorize({
      contentId: content.id,
      organizationId: content.organizationId,
      clientId: content.clientId,
      targetStatus: targetLegacy,
      actorId: input.trusted.actorId,
      actorRole: 'CLIENT',
      now: input.trusted.now,
    });
    const gate = assertClaimSafeTransition(content.status, targetLegacy, content.claimSafety, {
      canonical: {
        allowed: canonical.allowed,
        reason: canonical.reason,
        reasonCode: canonical.reasonCode,
      },
    });
    if (!gate.allowed) {
      throw new ExecutionDeliveryError(
        'PUBLICATION_GATE_DENIED',
        gate.reason || 'Claim publication gate blocks request-changes advance.'
      );
    }

    const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
    const target = mapLegacyContentStatus(targetLegacy);
    if (current !== target) {
      const path = resolvePipelineStepsToTarget(current, target);
      content = advancePipeline(deps, contentId, path, actor, reason);
    }

    const feedback = deps.contents.addFeedback({
      organizationId: content.organizationId,
      clientId: content.clientId,
      contentId,
      taskId: input.taskId,
      kind: 'CLIENT_REJECT',
      actorUid: input.trusted.actorId,
      actorRole: 'CLIENT',
      reason,
    });

    content = deps.contents.saveDraft(
      contentId,
      { clientFeedback: reason },
      input.trusted.now
    );

    return { content, decision: input.decision, feedbackEvent: feedback };
  };
}
