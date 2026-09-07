/**
 * CR-1 Wave B10 — #27 AssignClientTask / CancelClientTask + architecture guards.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.hoisted(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new (class {
    private store = new Map<string, string>();
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.store.set(key, value);
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
  })() as Storage;
});

import {
  createAssignClientTask,
  createCancelClientTask,
  ExecutionDeliveryError,
  type ClientExecutionReadPort,
  type CurationThesisReadPort,
  type TaskAssignmentPersistencePort,
  type TaskRepository,
  type TrustedExecutionDeliveryContext,
} from '../src/application/executionDelivery';
import type { Client, PositioningThesis, Task } from '../src/types';
import { TASK_TRANSITIONS } from '../src/domain/stateMachine';
import { composeExecutionDelivery } from '../src/composition/executionDelivery/composeExecutionDelivery';
import { authService } from '../src/services/auth';
import { auditService } from '../src/services/audit';
import { dbService } from '../src/services/db';
import {
  assignClientTask as assignClientTaskConsumer,
  cancelClientTask as cancelClientTaskConsumer,
  resetExecutionDeliveryConsumerForTest,
} from '../src/services/executionDeliveryConsumer';

function adminTrusted(
  overrides: Partial<TrustedExecutionDeliveryContext> = {}
): TrustedExecutionDeliveryContext {
  return {
    actorId: 'admin_01',
    actorRole: 'ADMIN',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    now: '2026-09-07T16:00:00.000Z',
    ...overrides,
  };
}

function clientTrusted(
  overrides: Partial<TrustedExecutionDeliveryContext> = {}
): TrustedExecutionDeliveryContext {
  return {
    actorId: 'client_01',
    actorRole: 'CLIENT',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    now: '2026-09-07T16:00:00.000Z',
    ...overrides,
  };
}

function baseClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client_ed',
    organizationId: 'org_ed',
    displayName: 'Client ED',
    status: 'ACTIVE',
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  } as Client;
}

function baseThesis(overrides: Partial<PositioningThesis> = {}): PositioningThesis {
  return {
    id: 'thesis_b10_1',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    title: 'Thesis',
    expertIdentity: 'Expert',
    targetAudience: 'Leaders',
    domain: 'Governance',
    complianceRules: 'Precise',
    status: 'ACTIVE',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  } as PositioningThesis;
}

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_b10_1',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    thesisId: 'thesis_b10_1',
    type: 'RECORD_VIDEO',
    title: 'Task',
    description: 'Do it',
    estimatedMinutes: 15,
    status: 'ASSIGNED',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function memoryAssignPorts(options: {
  client?: Client | null;
  thesis?: PositioningThesis | null;
  trusted?: TrustedExecutionDeliveryContext;
} = {}) {
  const tasks: Task[] = [];
  let createCalls = 0;
  const trusted = options.trusted ?? adminTrusted();

  const clients: ClientExecutionReadPort = {
    getById(id) {
      if (options.client === null) return undefined;
      const c = options.client ?? baseClient();
      return c.id === id ? c : undefined;
    },
  };

  const theses: CurationThesisReadPort = {
    getById(clientId, thesisId) {
      if (options.thesis === null) return undefined;
      const t = options.thesis ?? baseThesis();
      return t.clientId === clientId && t.id === thesisId ? t : undefined;
    },
  };

  const assignment: TaskAssignmentPersistencePort = {
    createTask(input) {
      createCalls += 1;
      const task: Task = {
        ...input,
        id: `task_${createCalls}`,
        createdAt: trusted.now,
      };
      tasks.push(task);
      return task;
    },
  };

  return {
    assign: createAssignClientTask({ clients, theses, assignment }),
    tasks,
    getCreateCalls: () => createCalls,
  };
}

function memoryCancelTasks(seed: Task[] = []) {
  const store = new Map(seed.map((t) => [t.id, { ...t }]));
  let saveCalls = 0;
  const repo: TaskRepository = {
    getById(id) {
      return store.get(id);
    },
    listByClient(clientId) {
      return [...store.values()].filter((t) => t.clientId === clientId);
    },
    saveStatus(input) {
      saveCalls += 1;
      const t = store.get(input.taskId)!;
      const allowed = TASK_TRANSITIONS[t.status] || [];
      if (!allowed.includes(input.status)) {
        throw new Error(`TASK_INVALID_TRANSITION:${t.status}->${input.status}`);
      }
      const next = { ...t, status: input.status };
      store.set(input.taskId, next);
      return next;
    },
    saveEvidence(input) {
      const t = store.get(input.taskId)!;
      const next = { ...t, evidenceUrl: input.evidenceUrl, clientNotes: input.clientNotes ?? t.clientNotes };
      store.set(input.taskId, next);
      return next;
    },
    saveNotes(input) {
      const t = store.get(input.taskId)!;
      const next = { ...t, clientNotes: input.clientNotes };
      store.set(input.taskId, next);
      return next;
    },
  };
  return { cancel: createCancelClientTask({ tasks: repo }), store, getSaveCalls: () => saveCalls };
}

function setupAdminGate(clientId = 'client_ed', organizationId = 'org_ed', clientExists = true) {
  vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
    uid: 'admin_01',
    email: 'a@x.com',
    displayName: 'Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    organizationId,
    clientId: null,
    mustCompleteOnboarding: false,
    aiKeyManagementAllowed: false,
    locale: 'es',
    timezone: 'UTC',
  } as ReturnType<typeof authService.getCurrentUser>);
  vi.spyOn(dbService, 'getClientById').mockImplementation((id: string) => {
    if (!clientExists) return undefined;
    if (id !== clientId) return undefined;
    return baseClient({ id, organizationId }) as ReturnType<typeof dbService.getClientById>;
  });
}

describe('CR-1 Wave B10 #27 — AssignClientTask core authority', () => {
  it('ADMIN valid MANUAL assign maps exact Task fields with trusted id/time', () => {
    const trusted = adminTrusted();
    const { assign, tasks, getCreateCalls } = memoryAssignPorts({ trusted });
    const result = assign({
      trusted,
      origin: {
        kind: 'MANUAL',
        thesisId: 'thesis_b10_1',
        type: 'REVIEW_ARTICLE',
        title: 'Review draft',
        description: 'Please review',
        estimatedMinutes: 20,
        deadline: '2026-10-01T00:00:00.000Z',
      },
    });
    expect(getCreateCalls()).toBe(1);
    expect(result.task).toMatchObject({
      id: 'task_1',
      organizationId: 'org_ed',
      clientId: 'client_ed',
      thesisId: 'thesis_b10_1',
      type: 'REVIEW_ARTICLE',
      title: 'Review draft',
      description: 'Please review',
      estimatedMinutes: 20,
      deadline: '2026-10-01T00:00:00.000Z',
      status: 'ASSIGNED',
      createdAt: trusted.now,
    });
    expect(tasks).toHaveLength(1);
  });

  it('CLIENT denied', () => {
    const { assign } = memoryAssignPorts();
    expect(() =>
      assign({
        trusted: clientTrusted(),
        origin: {
          kind: 'MANUAL',
          thesisId: 'thesis_b10_1',
          type: 'RECORD_VIDEO',
          title: 'X',
          description: 'Y',
          estimatedMinutes: 15,
        },
      })
    ).toThrow(ExecutionDeliveryError);
  });

  it('missing client denied with no write', () => {
    const { assign, getCreateCalls } = memoryAssignPorts({ client: null });
    expect(() =>
      assign({
        trusted: adminTrusted(),
        origin: {
          kind: 'MANUAL',
          thesisId: 'thesis_b10_1',
          type: 'RECORD_VIDEO',
          title: 'X',
          description: 'Y',
          estimatedMinutes: 15,
        },
      })
    ).toThrow(/Client not found/i);
    expect(getCreateCalls()).toBe(0);
  });

  it('wrong-client thesis denied', () => {
    const { assign, getCreateCalls } = memoryAssignPorts({
      thesis: baseThesis({ id: 'thesis_other', clientId: 'client_other' }),
    });
    expect(() =>
      assign({
        trusted: adminTrusted(),
        origin: {
          kind: 'MANUAL',
          thesisId: 'thesis_other',
          type: 'RECORD_VIDEO',
          title: 'X',
          description: 'Y',
          estimatedMinutes: 15,
        },
      })
    ).toThrow(/Thesis not found/i);
    expect(getCreateCalls()).toBe(0);
  });

  it('caller organization spoof ignored', () => {
    const { assign } = memoryAssignPorts();
    expect(() =>
      assign({
        trusted: adminTrusted(),
        origin: {
          kind: 'MANUAL',
          thesisId: 'thesis_b10_1',
          type: 'RECORD_VIDEO',
          title: 'X',
          description: 'Y',
          estimatedMinutes: 15,
        },
        claimedOrganizationId: 'org_spoof',
      })
    ).toThrow(/organizationId/i);
  });

  it('repeat assign creates second Task', () => {
    const trusted = adminTrusted();
    const { assign, getCreateCalls } = memoryAssignPorts({ trusted });
    const origin = {
      kind: 'MANUAL' as const,
      thesisId: 'thesis_b10_1',
      type: 'RECORD_VIDEO' as const,
      title: 'X',
      description: 'Y',
      estimatedMinutes: 15,
    };
    assign({ trusted, origin });
    assign({ trusted, origin });
    expect(getCreateCalls()).toBe(2);
  });

  it('FROM_RECOMMENDATION preserves exact composite mapping', () => {
    const trusted = adminTrusted();
    const { assign } = memoryAssignPorts({ trusted });
    const result = assign({
      trusted,
      origin: {
        kind: 'FROM_RECOMMENDATION',
        thesisId: 'thesis_b10_1',
        contentItemId: 'cnt_b10_1',
        scriptPayload: 'script body',
        strategicBriefId: 'brief_b10_1',
        strategicBriefVersion: 2,
        signalId: 'sig_b10_1',
        title: 'Grabar: angle',
        description: 'Guion redactado según tu tesis. Usa el teleprompter.',
      },
    });
    expect(result.origin).toBe('FROM_RECOMMENDATION');
    expect(result.task).toMatchObject({
      type: 'RECORD_VIDEO',
      estimatedMinutes: 15,
      status: 'ASSIGNED',
      contentItemId: 'cnt_b10_1',
      scriptPayload: 'script body',
      strategicBriefId: 'brief_b10_1',
      strategicBriefVersion: 2,
      signalId: 'sig_b10_1',
    });
  });
});

describe('CR-1 Wave B10 #27 — CancelClientTask core authority', () => {
  it('ADMIN valid cancel mutates status only', () => {
    const { cancel, store } = memoryCancelTasks([baseTask()]);
    const result = cancel({ trusted: adminTrusted(), taskId: 'task_b10_1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.task.status).toBe('CANCELLED');
      expect(result.task.completedAt).toBeUndefined();
    }
    expect(store.get('task_b10_1')?.status).toBe('CANCELLED');
  });

  it('CLIENT denied', () => {
    const { cancel } = memoryCancelTasks([baseTask()]);
    expect(() =>
      cancel({ trusted: clientTrusted(), taskId: 'task_b10_1' })
    ).toThrow(ExecutionDeliveryError);
  });

  it('cross-tenant existing task denied', () => {
    const { cancel, getSaveCalls } = memoryCancelTasks([
      baseTask({ organizationId: 'org_other', clientId: 'client_other' }),
    ]);
    expect(() =>
      cancel({
        trusted: adminTrusted({ clientId: 'client_other', organizationId: 'org_ed' }),
        taskId: 'task_b10_1',
      })
    ).toThrow(/organization/i);
    expect(getSaveCalls()).toBe(0);
  });

  it('missing task returns compat without mutation', () => {
    const { cancel, getSaveCalls } = memoryCancelTasks([]);
    const result = cancel({ trusted: adminTrusted(), taskId: 'missing_task' });
    expect(result).toEqual({ ok: false, compat: 'TASK_NOT_FOUND' });
    expect(getSaveCalls()).toBe(0);
  });

  it('invalid transition throws', () => {
    const { cancel } = memoryCancelTasks([baseTask({ status: 'COMPLETED' })]);
    expect(() => cancel({ trusted: adminTrusted(), taskId: 'task_b10_1' })).toThrow(
      ExecutionDeliveryError
    );
  });

  it('repeat CANCELLED throws', () => {
    const { cancel } = memoryCancelTasks([baseTask({ status: 'CANCELLED' })]);
    expect(() => cancel({ trusted: adminTrusted(), taskId: 'task_b10_1' })).toThrow(
      /INVALID_TRANSITION|TASK_INVALID/
    );
  });
});

describe('CR-1 Wave B10 #27 — consumer gates', () => {
  beforeEach(() => {
    resetExecutionDeliveryConsumerForTest();
    vi.restoreAllMocks();
  });

  it('missing session denied on assign', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    expect(() =>
      assignClientTaskConsumer({
        requestedClientId: 'client_ed',
        origin: {
          kind: 'MANUAL',
          thesisId: 'thesis_b10_1',
          type: 'RECORD_VIDEO',
          title: 'X',
          description: 'Y',
          estimatedMinutes: 15,
        },
      })
    ).toThrow(ExecutionDeliveryError);
  });

  it('missing client at gate denied on assign — no legacy session org fallback write', () => {
    setupAdminGate('client_ed', 'org_ed', false);
    vi.spyOn(dbService, 'getThesisById').mockReturnValue(baseThesis() as ReturnType<typeof dbService.getThesisById>);
    const addSpy = vi.spyOn(dbService, 'addTask');
    expect(() =>
      assignClientTaskConsumer({
        requestedClientId: 'client_ed',
        origin: {
          kind: 'MANUAL',
          thesisId: 'thesis_b10_1',
          type: 'RECORD_VIDEO',
          title: 'X',
          description: 'Y',
          estimatedMinutes: 15,
        },
      })
    ).toThrow(/Cliente no encontrado|Client not found/i);
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('missing task consumer compat preserves audit without write', () => {
    setupAdminGate();
    vi.spyOn(dbService, 'getAllTasks').mockReturnValue([]);
    const auditSpy = vi.spyOn(auditService, 'log');
    const result = cancelClientTaskConsumer({ taskId: 'ghost_task' });
    expect(result).toEqual({ ok: false, compat: 'TASK_NOT_FOUND' });
    expect(auditSpy).toHaveBeenCalledWith(
      expect.anything(),
      'CANCEL_TASK',
      'Task',
      'ghost_task'
    );
  });

  it('cross-tenant cancel denied with no audit', () => {
    setupAdminGate('client_ed', 'org_ed');
    vi.spyOn(dbService, 'getAllTasks').mockReturnValue([
      baseTask({ id: 'task_x', clientId: 'client_ed', organizationId: 'org_other' }),
    ]);
    const auditSpy = vi.spyOn(auditService, 'log');
    expect(() => cancelClientTaskConsumer({ taskId: 'task_x' })).toThrow(ExecutionDeliveryError);
    expect(auditSpy).not.toHaveBeenCalled();
  });
});

describe('CR-1 Wave B10 #27 — composite sequencing guards', () => {
  it('contentHandlers path C: #33 then assignClientTask then orphan recommendation status', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/contentHandlers.ts'), 'utf8');
    const block = source.slice(source.indexOf('.btn-create-task-from-rec'));
    expect(block.indexOf('createContentDraft')).toBeLessThan(block.indexOf('assignClientTask'));
    expect(block.indexOf('assignClientTask')).toBeLessThan(block.indexOf('updateRecommendationStatus'));
    expect(block).not.toMatch(/dbService\.addTask\s*\(/);
  });

  it('CreateContentDraft source unchanged by B10', () => {
    const source = readFileSync(
      resolve('src/application/executionDelivery/CreateContentDraft.ts'),
      'utf8'
    );
    expect(source).toMatch(/RECOMMENDATION_TASK_SCRIPT/);
    expect(source).not.toMatch(/assignClientTask|AssignClientTask/);
  });
});

describe('CR-1 Wave B10 #27 — architecture guards', () => {
  it('compose exposes assignClientTask and cancelClientTask', () => {
    const c = composeExecutionDelivery();
    expect(typeof c.assignClientTask).toBe('function');
    expect(typeof c.cancelClientTask).toBe('function');
    expect(Object.keys(c)).toHaveLength(19);
  });

  it('presentation has zero direct #27 addTask or manager cancel writes', () => {
    const tasks = readFileSync(resolve('src/ui/legacy/handlers/tasksHandlers.ts'), 'utf8');
    expect(tasks).toMatch(/assignClientTask\s*\(/);
    expect(tasks).toMatch(/cancelClientTask\s*\(/);
    expect(tasks).not.toMatch(/dbService\.addTask\s*\(/);
    expect(tasks).not.toMatch(/updateTaskStatus\s*\([^)]*CANCELLED/);

    const content = readFileSync(resolve('src/ui/legacy/handlers/contentHandlers.ts'), 'utf8');
    const pathC = content.slice(content.indexOf('.btn-create-task-from-rec'));
    expect(pathC).toMatch(/assignClientTask\s*\(/);
    expect(pathC).not.toMatch(/dbService\.addTask\s*\(/);
  });

  it('single assign persistence via TaskAssignmentPersistencePort adapter', () => {
    const adapter = readFileSync(
      resolve('src/infrastructure/executionDelivery/DbTaskAssignmentAdapters.ts'),
      'utf8'
    );
    expect(adapter).toMatch(/dbService\.addTask/);
    const appAssign = readFileSync(
      resolve('src/application/executionDelivery/AssignClientTask.ts'),
      'utf8'
    );
    expect(appAssign).not.toMatch(/dbService/);
  });

  it('cancel uses TaskRepository.saveStatus — no generic status command', () => {
    const cancel = readFileSync(
      resolve('src/application/executionDelivery/CancelClientTask.ts'),
      'utf8'
    );
    expect(cancel).toMatch(/saveStatus/);
    expect(cancel).not.toMatch(/updateTaskStatus/);
  });

  it('#28 TransitionClientTask source unchanged', () => {
    const source = readFileSync(
      resolve('src/application/executionDelivery/TransitionClientTask.ts'),
      'utf8'
    );
    expect(source).toMatch(/TransitionClientTask/);
    expect(source).not.toMatch(/AssignClientTask|CancelClientTask/);
  });

  it('orphan recommendation status authority remains exactly one presentation seam', () => {
    const content = readFileSync(resolve('src/ui/legacy/handlers/contentHandlers.ts'), 'utf8');
    const matches = content.match(/updateRecommendationStatus\s*\(/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});
