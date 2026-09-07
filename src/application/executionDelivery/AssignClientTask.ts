import type { Task, TaskType } from '../../types';
import { ExecutionDeliveryError } from './errors';
import type { ClientExecutionReadPort } from './ports/ClientExecutionReadPort';
import type { CurationThesisReadPort } from './ports/CurationThesisReadPort';
import type { TaskAssignmentPersistencePort } from './ports/TaskAssignmentPersistencePort';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export type AssignClientTaskOrigin =
  | {
      kind: 'MANUAL';
      thesisId: string;
      type: TaskType;
      title: string;
      description: string;
      estimatedMinutes: number;
      deadline?: string;
    }
  | {
      kind: 'FROM_RECOMMENDATION';
      thesisId: string;
      contentItemId: string;
      scriptPayload?: string;
      strategicBriefId: string;
      strategicBriefVersion?: number;
      signalId?: string;
      title: string;
      description: string;
    };

export interface AssignClientTaskInput {
  trusted: TrustedExecutionDeliveryContext;
  origin: AssignClientTaskOrigin;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface AssignClientTaskResult {
  task: Task;
  origin: AssignClientTaskOrigin['kind'];
}

export interface AssignClientTaskDeps {
  clients: ClientExecutionReadPort;
  theses: CurationThesisReadPort;
  assignment: TaskAssignmentPersistencePort;
}

function resolveAuthoritativeScope(
  deps: AssignClientTaskDeps,
  trusted: TrustedExecutionDeliveryContext,
  thesisId: string
) {
  const client = deps.clients.getById(trusted.clientId);
  if (!client) {
    throw new ExecutionDeliveryError('TENANT_CONTEXT_INVALID', 'Client not found.');
  }
  const clientOrg = client.organizationId?.trim();
  if (!clientOrg || clientOrg !== trusted.organizationId) {
    throw new ExecutionDeliveryError(
      'TENANT_CONTEXT_INVALID',
      'Client does not belong to the trusted organization.'
    );
  }

  const thesis = deps.theses.getById(trusted.clientId, thesisId.trim());
  if (!thesis) {
    throw new ExecutionDeliveryError('INVALID_INPUT', 'Thesis not found for trusted client.');
  }
  if (thesis.clientId !== trusted.clientId) {
    throw new ExecutionDeliveryError(
      'TENANT_CONTEXT_INVALID',
      'Thesis does not belong to the trusted client.'
    );
  }
  if (thesis.organizationId !== trusted.organizationId) {
    throw new ExecutionDeliveryError(
      'TENANT_CONTEXT_INVALID',
      'Thesis does not belong to the trusted organization.'
    );
  }

  return { client, thesis };
}

/**
 * CR-1 #27 — AssignClientTask.
 * ADMIN-only Task creation; Domain status ASSIGNED owned by Application.
 */
export function createAssignClientTask(deps: AssignClientTaskDeps) {
  return function assignClientTask(input: AssignClientTaskInput): AssignClientTaskResult {
    assertTrustedExecutionContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
    });

    const thesisId = input.origin.thesisId?.trim();
    if (!thesisId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'Thesis id is required.');
    }

    const { thesis } = resolveAuthoritativeScope(deps, input.trusted, thesisId);

    let taskInput: Omit<Task, 'id' | 'createdAt'>;

    switch (input.origin.kind) {
      case 'MANUAL': {
        const title = input.origin.title?.trim();
        const description = input.origin.description?.trim();
        if (!title || !description) {
          throw new ExecutionDeliveryError('INVALID_INPUT', 'Title and description are required.');
        }
        if (!Number.isFinite(input.origin.estimatedMinutes) || input.origin.estimatedMinutes <= 0) {
          throw new ExecutionDeliveryError('INVALID_INPUT', 'Estimated minutes must be positive.');
        }
        taskInput = {
          organizationId: input.trusted.organizationId,
          clientId: input.trusted.clientId,
          thesisId: thesis.id,
          type: input.origin.type,
          title,
          description,
          estimatedMinutes: input.origin.estimatedMinutes,
          deadline: input.origin.deadline?.trim() || undefined,
          status: 'ASSIGNED',
        };
        break;
      }
      case 'FROM_RECOMMENDATION': {
        const contentItemId = input.origin.contentItemId?.trim();
        const strategicBriefId = input.origin.strategicBriefId?.trim();
        if (!contentItemId || !strategicBriefId) {
          throw new ExecutionDeliveryError(
            'INVALID_INPUT',
            'Content item and strategic brief references are required.'
          );
        }
        taskInput = {
          organizationId: input.trusted.organizationId,
          clientId: input.trusted.clientId,
          thesisId: thesis.id,
          type: 'RECORD_VIDEO',
          title: input.origin.title,
          description: input.origin.description,
          estimatedMinutes: 15,
          status: 'ASSIGNED',
          contentItemId,
          scriptPayload: input.origin.scriptPayload,
          strategicBriefId,
          strategicBriefVersion: input.origin.strategicBriefVersion,
          signalId: input.origin.signalId,
        };
        break;
      }
      default: {
        const _exhaustive: never = input.origin;
        throw new ExecutionDeliveryError('INVALID_INPUT', `Unknown origin: ${String(_exhaustive)}`);
      }
    }

    try {
      const task = deps.assignment.createTask(taskInput);
      return { task, origin: input.origin.kind };
    } catch (err) {
      throw new ExecutionDeliveryError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to assign task.'
      );
    }
  };
}
