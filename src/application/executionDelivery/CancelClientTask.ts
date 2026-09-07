import type { Task } from '../../types';
import { ExecutionDeliveryError } from './errors';
import type { TaskRepository } from './ports/TaskRepository';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface CancelClientTaskInput {
  trusted: TrustedExecutionDeliveryContext;
  taskId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
}

export type CancelClientTaskCompat = 'TASK_NOT_FOUND';

export type CancelClientTaskResult =
  | { ok: true; task: Task }
  | { ok: false; compat: CancelClientTaskCompat };

export interface CancelClientTaskDeps {
  tasks: TaskRepository;
}

/**
 * CR-1 #27 — CancelClientTask.
 * ADMIN manager cancel to CANCELLED via existing TASK_TRANSITIONS / TaskRepository.
 */
export function createCancelClientTask(deps: CancelClientTaskDeps) {
  return function cancelClientTask(input: CancelClientTaskInput): CancelClientTaskResult {
    const taskId = input.taskId?.trim();
    if (!taskId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'taskId is required.');
    }

    assertTrustedExecutionContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
      claimedStatus: input.claimedStatus,
    });

    const existing = deps.tasks.getById(taskId);
    if (!existing) {
      return { ok: false, compat: 'TASK_NOT_FOUND' };
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

    try {
      const task = deps.tasks.saveStatus({ taskId, status: 'CANCELLED' });
      return { ok: true, task };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid task transition.';
      if (/INVALID_TRANSITION|TASK_INVALID_TRANSITION/i.test(message)) {
        throw new ExecutionDeliveryError('INVALID_TRANSITION', message);
      }
      throw new ExecutionDeliveryError('PERSISTENCE_ERROR', message);
    }
  };
}
