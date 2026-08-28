/**
 * TEMPORARY LEGACY ADAPTER — CR-1 Execution Delivery strangler.
 */

import type {
  ContentPublicationGatePort,
  ContentRepository,
  ContentStrategicBriefGatePort,
  TaskRepository,
} from '../../application/executionDelivery';
import { authorizeContentPublicationGate } from '../../composition/claimEvidence/contentClaimPublicationGate';
import { assertTransition, TASK_TRANSITIONS } from '../../domain/stateMachine';
import { authorizeStrategicDownstream } from '../../services/strategicBriefConsumer';
import { dbService } from '../../services/db';

export function createDbTaskRepository(): TaskRepository {
  return {
    getById(taskId) {
      return dbService.getAllTasks().find((t) => t.id === taskId);
    },
    listByClient(clientId) {
      return dbService.getTasksForClient(clientId);
    },
    saveStatus(input) {
      assertTransition(
        this.getById(input.taskId)!.status,
        input.status,
        TASK_TRANSITIONS,
        'TASK'
      );
      dbService.updateTaskStatus(input.taskId, input.status, input.evidenceUrl, input.clientNotes);
      return this.getById(input.taskId)!;
    },
    saveEvidence(input) {
      dbService.updateTaskEvidence(input.taskId, input.evidenceUrl, input.clientNotes);
      return this.getById(input.taskId)!;
    },
    saveNotes(input) {
      const task = this.getById(input.taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      dbService.updateTaskEvidence(input.taskId, task.evidenceUrl || '', input.clientNotes);
      return this.getById(input.taskId)!;
    },
  };
}

export function createDbContentRepository(): ContentRepository {
  return {
    getById(contentId) {
      return dbService.getContentById(contentId);
    },
    saveDraft(contentId, fields, updatedAt) {
      const content = dbService.getContentById(contentId);
      if (!content) throw new Error('CONTENT_NOT_FOUND');
      dbService.saveContent({
        ...content,
        ...fields,
        // Preserve authoritative ownership / strategic refs — caller Brief authority = 0
        id: content.id,
        organizationId: content.organizationId,
        clientId: content.clientId,
        thesisId: content.thesisId,
        strategicBriefId: content.strategicBriefId,
        strategicBriefVersion: content.strategicBriefVersion,
        signalIds: content.signalIds,
        supportingEvidenceIds: content.supportingEvidenceIds,
        status: content.status,
        pipelineStatus: content.pipelineStatus,
        updatedAt,
      });
      return dbService.getContentById(contentId)!;
    },
    transitionPipeline(input) {
      const next = dbService.transitionContentPipeline(
        input.contentId,
        input.next,
        input.actor,
        input.comment
      );
      if (!next) throw new Error('CONTENT_NOT_FOUND');
      return next;
    },
    saveClientRevision(input) {
      return dbService.saveClientArticleRevision(input.contentId, {
        title: input.title,
        body: input.body,
        actorUid: input.actorUid,
        taskId: input.taskId,
      });
    },
    addFeedback(input) {
      return dbService.addFeedbackEvent(input);
    },
  };
}

export function createDbContentPublicationGate(): ContentPublicationGatePort {
  return {
    authorize(input) {
      return authorizeContentPublicationGate({
        contentId: input.contentId,
        organizationId: input.organizationId,
        clientId: input.clientId,
        targetStatus: input.targetStatus,
        actorId: input.actorId,
        actorRole: input.actorRole,
        now: input.now,
      });
    },
  };
}

/**
 * SPEC-003 gate adapter — delegates to AuthorizeStrategicDownstream via consumer
 * (shared Brief store). Execution Delivery does not own Brief lifecycle.
 */
export function createDbContentStrategicBriefGate(): ContentStrategicBriefGatePort {
  return {
    authorize(input) {
      void input.organizationId;
      void input.actorId;
      void input.actorRole;
      const result = authorizeStrategicDownstream({
        clientId: input.clientId,
        briefId: input.briefId,
        requestedAction: 'CREATE_CONTENT',
        now: input.now,
      });
      return {
        authorized: result.authorized,
        briefId: result.briefId,
        version: result.version,
        denialCode: result.denialCode,
        denialReason: result.denialReason,
      };
    },
  };
}
