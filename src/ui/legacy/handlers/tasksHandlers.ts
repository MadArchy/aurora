import { authService } from '../../../services/auth';
import { dbService } from '../../../services/db';
import { auditService } from '../../../services/audit';
import { notifyClient } from '../../../services/notifications';
import { transitionClientTask } from '../../../services/executionDeliveryConsumer';
import type { TaskType } from '../../../types';
import type { TasksHandlerHost } from '../legacyAppHost';

export function openAssignedTask(host: TasksHandlerHost, taskId: string): void {
  const task = dbService.getAllTasks().find((t) => t.id === taskId);
  if (!task) {
    host.showToast('Tarea no encontrada', 'warning');
    return;
  }

  if (task.status === 'ASSIGNED' || task.status === 'DRAFT') {
    try {
      // CR-1 #28 — TransitionClientTask (view).
      transitionClientTask({
        requestedClientId: task.clientId,
        taskId,
        intent: 'view',
      });
    } catch {
      /* transiciones ya avanzadas */
    }
  }

  if (task.type === 'RECORD_VIDEO') {
    host.teleprompter.markVideoCaptureStarted(task);
    host.activeModal = 'teleprompter';
    host.modalData = { taskId };
    host.render();
    return;
  }

  if (task.type === 'REVIEW_ARTICLE') {
    if (task.contentItemId) {
      const user = authService.getCurrentUser();
      if (user?.role === 'CLIENT') {
        host.teleprompter.markArticleReviewStarted(task, task.contentItemId);
        host.activeModal = 'article-review';
        host.modalData = { contentId: task.contentItemId, taskId };
      } else {
        host.activeModal = 'content-preview';
        host.modalData = { contentId: task.contentItemId, taskId };
      }
      host.render();
      return;
    }
    host.setTab('ws-production');
    host.showToast('No hay borrador vinculado. Revisa Producción.', 'info');
    return;
  }

  if (task.type === 'APPROVE_OPPORTUNITY') {
    host.setTab('ws-briefing');
    return;
  }

  if (task.type === 'SUBMIT_INFO') {
    const urlMatch = task.description.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      window.open(urlMatch[0], '_blank', 'noopener,noreferrer');
    }
    host.showToast(
      urlMatch ? 'Se abrió la lectura en una pestaña.' : 'Lectura asignada: revisa la descripción de la tarea.',
      'info'
    );
    return;
  }

  host.showToast('Esta tarea no tiene una acción automática.', 'info');
}

export function bindTasksHandlers(host: TasksHandlerHost): void  {
  document.getElementById('btn-open-add-task')?.addEventListener('click', (e) => {
    const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || host.resolveClientId();
    host.activeModal = 'add-task';
    host.modalData = { clientId };
    host.render();
  });

  ['btn-close-add-task', 'btn-cancel-add-task'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => host.closeModal());
  });

  document.getElementById('form-add-task')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const clientId = form.getAttribute('data-client-id') || host.resolveClientId();
    const thesisId = (document.getElementById('task-thesis') as HTMLSelectElement | null)?.value || undefined;
    if (!thesisId) {
      host.showToast('Selecciona una tesis ACTIVE para la tarea.', 'warning');
      return;
    }

    const title = (document.getElementById('task-title') as HTMLInputElement).value.trim();
    const description = (document.getElementById('task-description') as HTMLTextAreaElement).value.trim();
    const type = (document.getElementById('task-type') as HTMLSelectElement).value as TaskType;
    const estimatedMinutes = parseInt((document.getElementById('task-minutes') as HTMLInputElement).value || '15', 10);
    const deadlineRaw = (document.getElementById('task-deadline') as HTMLInputElement).value;

    const organizationId = host.resolveOrganizationId(clientId);
    if (!organizationId) {
      host.showToast('Cliente sin organizationId — no se puede crear la tarea', 'warning');
      return;
    }

    const created = dbService.addTask({
      organizationId,
      clientId,
      thesisId,
      type,
      title,
      description,
      estimatedMinutes,
      deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : undefined,
      status: 'ASSIGNED',
    });

    const notified = notifyClient(clientId, {
      type: 'TASK_ASSIGNED',
      title: 'Nueva tarea asignada',
      body: title,
      href: 'client-home',
      targetId: created.id,
    });
    if (!notified) {
      host.showToast('Tarea guardada. El cliente no tiene cuenta vinculada para avisos.', 'info');
    }

    auditService.log(authService.getCurrentUser(), 'ASSIGN_TASK', 'Task', clientId, { title, type });
    host.showToast('Tarea asignada. El cliente la verá en su portal.', 'success');
    host.activeModal = null;
    host.setTab('ws-tasks');
  });

  document.querySelectorAll('.btn-cancel-task').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
      if (!taskId) return;
      if (!confirm('¿Cancelar esta tarea? El cliente dejará de verla como pendiente.')) return;
      dbService.updateTaskStatus(taskId, 'CANCELLED');
      auditService.log(authService.getCurrentUser(), 'CANCEL_TASK', 'Task', taskId);
      host.showToast('Tarea cancelada', 'info');
      host.render();
    });
  });

  document.querySelectorAll('.btn-open-task-action').forEach((btn) => {
    const open = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('a, video, .btn-download-recording, .btn-reupload-recording, .input-reupload-recording')) {
        e.stopPropagation();
        return;
      }
      const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
      if (taskId) openAssignedTask(host, taskId);
    };
    btn.addEventListener('click', open);
    btn.addEventListener('keydown', (e) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        e.preventDefault();
        open(e);
      }
    });
  });
}
