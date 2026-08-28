import type { Task, TaskStatus } from '../../types';
import { assertTransition, TASK_TRANSITIONS } from '../../domain/stateMachine';
import { ExecutionDeliveryError } from './errors';
import type { TaskRepository } from './ports/TaskRepository';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireTaskActorRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export type ClientTaskTransitionIntent =
  | 'view'
  | 'start'
  | 'complete'
  | 'cancel'
  | 'request_changes'
  | 'attach_evidence';

export interface TransitionClientTaskInput {
  trusted: TrustedExecutionDeliveryContext;
  taskId: string;
  intent: ClientTaskTransitionIntent;
  evidenceUrl?: string;
  clientNotes?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
}

export interface TransitionClientTaskResult {
  task: Task;
  intent: ClientTaskTransitionIntent;
  statusChanged: boolean;
}

export interface TransitionClientTaskDeps {
  tasks: TaskRepository;
}

function targetStatusForIntent(
  intent: ClientTaskTransitionIntent,
  current: TaskStatus
): TaskStatus | null {
  switch (intent) {
    case 'view':
      return 'VIEWED';
    case 'start':
      return 'IN_PROGRESS';
    case 'complete':
      return 'COMPLETED';
    case 'cancel':
      return 'CANCELLED';
    case 'request_changes':
      // Legacy ClientPortal writes IN_PROGRESS + notes (manager visibility).
      return current === 'IN_PROGRESS' ? null : 'IN_PROGRESS';
    case 'attach_evidence':
      return null;
    default:
      return null;
  }
}

/**
 * CR-1 #28 — TransitionClientTask.
 * Domain: TASK_TRANSITIONS / assertTransition. Evidence is execution attachment, not SPEC-006 claim.
 */
export function createTransitionClientTask(deps: TransitionClientTaskDeps) {
  return function transitionClientTask(
    input: TransitionClientTaskInput
  ): TransitionClientTaskResult {
    assertTrustedExecutionContext(input.trusted);
    requireTaskActorRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
      claimedStatus: input.claimedStatus,
    });

    const taskId = input.taskId?.trim();
    if (!taskId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'taskId is required.');
    }

    const existing = deps.tasks.getById(taskId);
    if (!existing) {
      throw new ExecutionDeliveryError('TASK_NOT_FOUND', 'Tarea no encontrada.');
    }
    if (existing.organizationId !== input.trusted.organizationId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Task organization does not match trusted session.'
      );
    }
    if (existing.clientId !== input.trusted.clientId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Task does not belong to the trusted client.'
      );
    }

    if (input.intent === 'cancel' && input.trusted.actorRole !== 'ADMIN') {
      throw new ExecutionDeliveryError(
        'ACTOR_NOT_AUTHORIZED',
        'Cancelling a task requires ADMIN role.'
      );
    }

    if (input.intent === 'attach_evidence') {
      const url = input.evidenceUrl?.trim();
      if (!url) {
        throw new ExecutionDeliveryError('INVALID_INPUT', 'evidenceUrl is required for attach_evidence.');
      }
      const task = deps.tasks.saveEvidence({
        taskId,
        evidenceUrl: url,
        clientNotes: input.clientNotes,
      });
      return { task, intent: input.intent, statusChanged: false };
    }

    const target = targetStatusForIntent(input.intent, existing.status);

    if (target === null) {
      // Same-status request_changes: notes only (legacy IN_PROGRESS → IN_PROGRESS).
      if (input.intent === 'request_changes') {
        const task = deps.tasks.saveNotes({
          taskId,
          clientNotes: input.clientNotes || existing.clientNotes || '',
        });
        return { task, intent: input.intent, statusChanged: false };
      }
      throw new ExecutionDeliveryError('INVALID_INPUT', `Unknown task intent: ${input.intent}`);
    }

    if (existing.status === target) {
      return { task: existing, intent: input.intent, statusChanged: false };
    }

    try {
      assertTransition(existing.status, target, TASK_TRANSITIONS, 'TASK');
    } catch (err) {
      throw new ExecutionDeliveryError(
        'INVALID_TRANSITION',
        err instanceof Error ? err.message : 'Invalid task transition.'
      );
    }

    const task = deps.tasks.saveStatus({
      taskId,
      status: target,
      evidenceUrl: input.evidenceUrl,
      clientNotes: input.clientNotes,
      completedAt: target === 'COMPLETED' ? input.trusted.now : undefined,
    });

    return { task, intent: input.intent, statusChanged: true };
  };
}
