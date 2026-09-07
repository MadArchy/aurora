/**
 * SPEC-010 · T603 React Parity Wave P3A — #28 generic ClientPortal task actions.
 *
 * Presentation parity only: view / complete / request_changes for non-video,
 * non-article tasks via frozen TransitionClientTask command seam.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Task } from '../src/types';
import { buildTrustedTenantScope } from '../src/ui/query/tenantScope';
import type { User } from '../src/types';
import { createTransitionClientTask } from '../src/application/executionDelivery/TransitionClientTask';
import type { TaskRepository } from '../src/application/executionDelivery';
import { ExecutionDeliveryError } from '../src/application/executionDelivery';

const consumerCalls: {
  requestedClientId: string | null | undefined;
  taskId: string;
  intent: string;
  evidenceUrl?: string;
  clientNotes?: string;
}[] = [];

let consumerThrows: Error | null = null;

vi.mock('../src/services/auth', () => ({
  authService: { getCurrentUser: () => null },
}));

vi.mock('../src/services/audit', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../src/services/notifications', () => ({
  notifyManager: vi.fn(),
}));

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  transitionClientTask: (intent: {
    requestedClientId: string | null | undefined;
    taskId: string;
    intent: string;
    evidenceUrl?: string;
    clientNotes?: string;
  }) => {
    if (consumerThrows) throw consumerThrows;
    consumerCalls.push(intent);
    return { task: { id: intent.taskId, status: 'COMPLETED' }, intent: intent.intent, statusChanged: true };
  },
  acknowledgeDelivery: vi.fn(),
  reviewClientArticle: vi.fn(),
  saveContentDraft: vi.fn(),
}));

const taskFixtures: Record<string, Task> = {
  generic: {
    id: 'task_generic',
    organizationId: 'org_a',
    clientId: 'client_a',
    thesisId: 'thesis_1',
    type: 'SUBMIT_INFO',
    title: 'Enviar información',
    description: 'Tarea genérica P3A',
    estimatedMinutes: 10,
    status: 'ASSIGNED',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  video: {
    id: 'task_video',
    organizationId: 'org_a',
    clientId: 'client_a',
    thesisId: 'thesis_1',
    type: 'RECORD_VIDEO',
    title: 'Grabar video',
    description: 'Video task',
    estimatedMinutes: 15,
    status: 'ASSIGNED',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  article: {
    id: 'task_article',
    organizationId: 'org_a',
    clientId: 'client_a',
    thesisId: 'thesis_1',
    type: 'REVIEW_ARTICLE',
    title: 'Revisar artículo',
    description: 'Article task',
    estimatedMinutes: 20,
    status: 'ASSIGNED',
    contentItemId: 'cnt_1',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
};

vi.mock('../src/services/db', () => ({
  dbService: {
    getTasksForClient: vi.fn((clientId: string) => {
      if (clientId !== 'client_a') return [];
      return Object.values(taskFixtures);
    }),
    getClientById: vi.fn((id: string) =>
      id === 'client_a'
        ? { id: 'client_a', organizationId: 'org_a', displayName: 'Cliente A' }
        : undefined
    ),
  },
}));

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

function memoryTasks(initial: Task[]) {
  const store = new Map(initial.map((task) => [task.id, { ...task }]));
  const repo: TaskRepository = {
    getById(taskId) {
      return store.get(taskId);
    },
    listByClient(clientId) {
      return [...store.values()].filter((task) => task.clientId === clientId);
    },
    saveStatus(input) {
      const task = store.get(input.taskId)!;
      task.status = input.status;
      if (input.evidenceUrl) task.evidenceUrl = input.evidenceUrl;
      if (input.clientNotes) task.clientNotes = input.clientNotes;
      if (input.completedAt) task.completedAt = input.completedAt;
      return { ...task };
    },
    saveEvidence(input) {
      const task = store.get(input.taskId)!;
      task.evidenceUrl = input.evidenceUrl;
      if (input.clientNotes) task.clientNotes = input.clientNotes;
      return { ...task };
    },
    saveNotes(input) {
      const task = store.get(input.taskId)!;
      task.clientNotes = input.clientNotes;
      return { ...task };
    },
  };
  return { repo, store };
}

function clientTrusted(overrides: Partial<{ clientId: string; actorId: string }> = {}) {
  return {
    organizationId: 'org_a',
    clientId: overrides.clientId ?? 'client_a',
    actorId: overrides.actorId ?? 'user_client',
    actorRole: 'CLIENT' as const,
    now: '2026-09-07T12:00:00.000Z',
  };
}

async function loadSeam() {
  const mod = await import('../src/ui/commands/commandSeam');
  consumerCalls.length = 0;
  consumerThrows = null;
  return mod;
}

beforeEach(() => {
  consumerCalls.length = 0;
  consumerThrows = null;
});

describe('P3A §2–§3 — task type classification and React surface', () => {
  it('classifies generic tasks as non-video and non-article only', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/isGenericClientTaskType/);
    expect(portal).toMatch(/type !== 'RECORD_VIDEO' && type !== 'REVIEW_ARTICLE'/);
  });

  it('TasksPanel uses useClientTasks and useTransitionClientTask', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/useClientTasks/);
    expect(portal).toMatch(/useTransitionClientTask/);
    expect(portal).toMatch(/data-testid="react-portal-tasks"/);
  });
});

describe('P3A §6–§9 — generic task presentation', () => {
  it('renders native view, complete, and request-changes with legacy labels', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/Abrir acción/);
    expect(portal).toMatch(/Aprobar y Marcar como Listo/);
    expect(portal).toMatch(/Solicitar Ajustes/);
    expect(portal).toMatch(/data-testid=\{`react-portal-task-view-\$\{task\.id\}`\}/);
    expect(portal).toMatch(/data-testid=\{`react-portal-task-complete-\$\{task\.id\}`\}/);
    expect(portal).toMatch(/data-testid=\{`react-portal-task-request-changes-\$\{task\.id\}`\}/);
  });

  it('does not render native generic start action', () => {
    const portal = code('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).not.toMatch(/intent:\s*'start'/);
    expect(portal).not.toMatch(/intent:\s*"start"/);
    expect(portal).not.toMatch(/Iniciar tarea/);
  });

  it('does not render attach_evidence UI', () => {
    const portal = code('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).not.toMatch(/attach_evidence/);
    expect(portal).not.toMatch(/evidenceUrl/);
  });

  it('does not render CLIENT cancel UI', () => {
    const portal = code('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).not.toMatch(/intent:\s*'cancel'/);
    expect(portal).not.toMatch(/Cancelar tarea/);
  });
});

describe('P3A §10–§12 — specialized legacy handoffs', () => {
  it('RECORD_VIDEO retains teleprompter legacy handoff', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/task\.type === 'RECORD_VIDEO'/);
    expect(portal).toMatch(/grabar vídeo con el teleprompter/);
    expect(portal).toMatch(/react-portal-task-handoff-video-/);
  });

  it('REVIEW_ARTICLE retains article-review legacy handoff', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/task\.type === 'REVIEW_ARTICLE'/);
    expect(portal).toMatch(/revisar el artículo/);
    expect(portal).toMatch(/react-portal-task-handoff-article-/);
  });

  it('removes panel-level blanket task LegacyHandoff', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).not.toMatch(/react-portal-tasks-handoff/);
  });
});

describe('P3A §4–§5 — command seam and public input', () => {
  it('view invokes canonical consumer exactly once with public input only', async () => {
    const { executionDeliveryCommands } = await loadSeam();
    const result = executionDeliveryCommands.transitionClientTask({
      requestedClientId: 'client_a',
      taskId: 'task_generic',
      intent: 'view',
    });
    expect(result.ok).toBe(true);
    expect(consumerCalls).toHaveLength(1);
    expect(consumerCalls[0]).toEqual({
      requestedClientId: 'client_a',
      taskId: 'task_generic',
      intent: 'view',
    });
  });

  it('complete invokes canonical consumer exactly once', async () => {
    const { executionDeliveryCommands } = await loadSeam();
    executionDeliveryCommands.transitionClientTask({
      requestedClientId: 'client_a',
      taskId: 'task_generic',
      intent: 'complete',
    });
    expect(consumerCalls).toHaveLength(1);
    expect(consumerCalls[0]?.intent).toBe('complete');
  });

  it('request_changes passes clientNotes without React authority fields', async () => {
    const { executionDeliveryCommands } = await loadSeam();
    executionDeliveryCommands.transitionClientTask({
      requestedClientId: 'client_a',
      taskId: 'task_generic',
      intent: 'request_changes',
      clientNotes: 'Necesito más contexto',
    });
    expect(consumerCalls[0]).toEqual({
      requestedClientId: 'client_a',
      taskId: 'task_generic',
      intent: 'request_changes',
      clientNotes: 'Necesito más contexto',
    });
  });

  it('useTransitionClientTask invalidates compatibility reads on success', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useTransitionClientTask/);
    expect(hooks).toMatch(/executionDeliveryCommands\.transitionClientTask/);
    expect(hooks).toMatch(/tenantInvalidationKey\(scope, 'compatibility'\)/);
  });
});

describe('P3A §13–§14 — read model and refresh boundaries', () => {
  it('React portal never imports dbService directly', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).not.toMatch(/\bdbService\b/);
    expect(portal).not.toMatch(/\btransitionClientTask\s*\(/);
    expect(portal).toMatch(/useTransitionClientTask/);
  });

  it('readClientTasks remains compatibility read without evidence fields for P3A', () => {
    const reads = read('src/ui/data/compatibilityReads.ts');
    const fn = reads.slice(reads.indexOf('export function readClientTasks'));
    expect(fn).toMatch(/getTasksForClient/);
    expect(fn).not.toMatch(/evidenceUrl/);
  });
});

describe('P3A §15–§16 — notifications and audits', () => {
  it('command seam does not add manager notifications for task transitions', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    const block = seam.slice(seam.indexOf('transitionClientTask(intent'));
    const nextExport = block.indexOf('saveContentDraft');
    const transitionBlock = block.slice(0, nextExport);
    expect(transitionBlock).not.toMatch(/notifyManager/);
    expect(transitionBlock).not.toMatch(/auditService/);
  });

  it('React portal does not import notifyManager or auditService for tasks', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).not.toMatch(/notifyManager/);
    expect(portal).not.toMatch(/auditService/);
    expect(portal).not.toMatch(/VIDEO_SUBMITTED/);
  });
});

describe('P3A §20–§21 — frozen Application state behavior', () => {
  it('view missing task throws TASK_NOT_FOUND', () => {
    const { repo } = memoryTasks([]);
    const transition = createTransitionClientTask({ tasks: repo });
    expect(() =>
      transition({ trusted: clientTrusted(), taskId: 'missing', intent: 'view' })
    ).toThrow(ExecutionDeliveryError);
  });

  it('view cross-client denied', () => {
    const { repo } = memoryTasks([taskFixtures.generic]);
    const transition = createTransitionClientTask({ tasks: repo });
    expect(() =>
      transition({
        trusted: clientTrusted({ clientId: 'other' }),
        taskId: 'task_generic',
        intent: 'view',
      })
    ).toThrow(ExecutionDeliveryError);
  });

  it('view repeat on VIEWED is no-op', () => {
    const { repo, store } = memoryTasks([{ ...taskFixtures.generic, status: 'VIEWED' }]);
    const transition = createTransitionClientTask({ tasks: repo });
    transition({ trusted: clientTrusted(), taskId: 'task_generic', intent: 'view' });
    expect(store.get('task_generic')?.status).toBe('VIEWED');
  });

  it('view invalid transition from COMPLETED denied', () => {
    const { repo } = memoryTasks([{ ...taskFixtures.generic, status: 'COMPLETED' }]);
    const transition = createTransitionClientTask({ tasks: repo });
    expect(() =>
      transition({ trusted: clientTrusted(), taskId: 'task_generic', intent: 'view' })
    ).toThrow(/INVALID_TRANSITION|TASK_INVALID/);
  });

  it('complete repeat on COMPLETED is no-op', () => {
    const { repo, store } = memoryTasks([{ ...taskFixtures.generic, status: 'COMPLETED' }]);
    const transition = createTransitionClientTask({ tasks: repo });
    transition({ trusted: clientTrusted(), taskId: 'task_generic', intent: 'complete' });
    expect(store.get('task_generic')?.status).toBe('COMPLETED');
  });

  it('request_changes on IN_PROGRESS updates notes without status change', () => {
    const { repo, store } = memoryTasks([{ ...taskFixtures.generic, status: 'IN_PROGRESS' }]);
    const transition = createTransitionClientTask({ tasks: repo });
    transition({
      trusted: clientTrusted(),
      taskId: 'task_generic',
      intent: 'request_changes',
      clientNotes: 'Segunda observación',
    });
    expect(store.get('task_generic')?.status).toBe('IN_PROGRESS');
    expect(store.get('task_generic')?.clientNotes).toBe('Segunda observación');
  });
});

describe('P3A §22 — specialized flow non-regression (source)', () => {
  it('teleprompter controller still owns start and video complete', () => {
    const teleprompter = read('src/ui/legacy/teleprompterController.ts');
    expect(teleprompter).toMatch(/intent: 'start'/);
    expect(teleprompter).toMatch(/intent: 'complete'/);
    expect(teleprompter).toMatch(/VIDEO_SUBMITTED/);
    expect(teleprompter).toMatch(/notifyManager/);
  });

  it('TransitionClientTask Application file remains frozen', () => {
    const app = read('src/application/executionDelivery/TransitionClientTask.ts');
    expect(app).toMatch(/requireTaskActorRole/);
    expect(app).not.toMatch(/notifyManager/);
    expect(app).not.toMatch(/auditService/);
  });
});

describe('P3A §19 — tenant scope guard', () => {
  it('readClientTasks returns empty when trusted scope has no clientId', async () => {
    const { readClientTasks } = await import('../src/ui/data/compatibilityReads');
    const scope = buildTrustedTenantScope({
      uid: 'user_admin',
      email: 'admin@test',
      displayName: 'Admin',
      role: 'ADMIN',
      organizationId: 'org_a',
    } as User);
    expect(readClientTasks(scope)).toEqual([]);
  });
});
