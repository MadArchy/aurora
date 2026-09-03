import { authService } from '../../../services/auth';
import { dbService } from '../../../services/db';
import { notifyManager } from '../../../services/notifications';
import { transitionClientTask } from '../../../services/executionDeliveryConsumer';
import { ExecutionDeliveryError } from '../../../application/executionDelivery';
import {
  acceptClientOpportunity,
  declineClientOpportunity,
  OpportunityApplicationError,
  submitClientOpportunity,
  toggleClientOpportunityChecklistItem,
} from '../../../services/opportunityScoutConsumer';
import { decideThesisClientReview } from '../../../services/thesisLifecycleConsumer';
import { ThesisLifecycleError } from '../../../application/thesisLifecycle';
import { registerResultRecordIntent } from '../../../services/learningLoopConsumer';
import type { BusinessKpiType } from '../../../types';
import type { ClientPortalHandlerHost } from '../legacyAppHost';
import { bindTeleprompterHandlers } from '../teleprompterController';

export function bindClientPortalHandlers(host: ClientPortalHandlerHost): void {
    document.querySelectorAll('[data-client-thesis-select]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        host.filterState.thesisId = (e.currentTarget as HTMLElement).getAttribute('data-client-thesis-select') || '';
        host.setTab('client-thesis');
      });
    });

    document.querySelectorAll('.btn-request-task-changes').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
        if (!taskId) return;
        host.activeModal = 'feedback';
        host.modalData = { targetId: taskId, type: 'TASK' };
        host.render();
      });
    });

    document.querySelectorAll('.btn-reject-opp').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const oppId = (e.currentTarget as HTMLElement).getAttribute('data-opp-id');
        if (!oppId) return;
        host.activeModal = 'feedback';
        host.modalData = { targetId: oppId, type: 'OPPORTUNITY' };
        host.render();
      });
    });

    ['btn-close-feedback', 'btn-cancel-feedback'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => host.closeModal());
    });

    const formFeedback = document.getElementById('form-submit-feedback');
    formFeedback?.addEventListener('submit', (e) => {
      e.preventDefault();
      const targetId = formFeedback.getAttribute('data-target-id');
      const type = formFeedback.getAttribute('data-type');
      const taskId = formFeedback.getAttribute('data-task-id') || undefined;
      const notes = (document.getElementById('feedback-notes') as HTMLTextAreaElement).value.trim();
      if (!targetId || !notes) return;

      if (type === 'TASK') {
        try {
          // CR-1 #28 — TransitionClientTask (request_changes).
          const task = dbService.getAllTasks().find((t) => t.id === targetId);
          transitionClientTask({
            requestedClientId: task?.clientId || authService.getCurrentUser()?.clientId,
            taskId: targetId,
            intent: 'request_changes',
            clientNotes: notes,
          });
          host.showToast('Observaciones enviadas a tu Brand Manager', 'info');
        } catch (error) {
          host.showToast(
            error instanceof ExecutionDeliveryError || error instanceof Error
              ? error.message
              : 'No se pudo actualizar la tarea',
            'warning'
          );
          return;
        }
      } else if (type === 'OPPORTUNITY') {
        const clientId = authService.getCurrentUser()?.clientId || host.resolveClientId();
        if (!clientId) {
          host.showToast('Cliente no resuelto — no se puede declinar la oportunidad', 'warning');
          return;
        }
        try {
          declineClientOpportunity({
            clientId,
            opportunityId: targetId,
            notes,
          });
          host.showToast('Oportunidad descartada con tus observaciones', 'info');
        } catch (err) {
          const message =
            err instanceof OpportunityApplicationError
              ? err.message
              : 'No se pudo declinar la oportunidad';
          host.showToast(message, 'warning');
          return;
        }
      } else if (type === 'CONTENT') {
        host.rejectClientArticle(targetId, notes, taskId);
      }
      host.closeModal();
    });

    document.querySelectorAll('.btn-approve-article-task').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const contentId = el.getAttribute('data-content-id');
        const taskId = el.getAttribute('data-task-id') || undefined;
        if (!contentId) return;
        host.approveClientArticle(contentId, taskId);
      });
    });

    document.querySelectorAll('.btn-complete-task').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const taskId = (e.currentTarget as HTMLElement).getAttribute('data-task-id');
        if (!taskId) return;
        try {
          const task = dbService.getAllTasks().find((t) => t.id === taskId);
          // CR-1 #28 — TransitionClientTask (complete).
          transitionClientTask({
            requestedClientId: task?.clientId || authService.getCurrentUser()?.clientId,
            taskId,
            intent: 'complete',
          });
          host.showToast('Tarea completada', 'success');
          host.render();
        } catch (error) {
          host.showToast(
            error instanceof ExecutionDeliveryError || error instanceof Error
              ? error.message
              : 'No se pudo completar la tarea',
            'warning'
          );
        }
      });
    });

    document.querySelectorAll('.btn-accept-opp').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const oppId = (e.currentTarget as HTMLElement).getAttribute('data-opp-id');
        if (!oppId) return;
        const clientId = authService.getCurrentUser()?.clientId || host.resolveClientId();
        if (!clientId) {
          host.showToast('Cliente no resuelto — no se puede aceptar la oportunidad', 'warning');
          return;
        }
        try {
          const opp = acceptClientOpportunity({
            clientId,
            opportunityId: oppId,
            notes: 'Aceptado con disponibilidad completa.',
          });
          notifyManager(opp.clientId, {
            type: 'OPPORTUNITY',
            title: 'Oportunidad aceptada',
            body: `«${opp.title}» — el cliente completará el checklist de postulación.`,
            href: 'ws-briefing',
          });
          host.showToast('Oportunidad aceptada. Completa el checklist de postulación.', 'success');
          host.render();
        } catch (err) {
          const message =
            err instanceof OpportunityApplicationError
              ? err.message
              : 'No se pudo aceptar la oportunidad';
          host.showToast(message, 'warning');
        }
      });
    });

    document.querySelectorAll('.input-opp-checklist').forEach((input) => {
      input.addEventListener('change', (e) => {
        const el = e.currentTarget as HTMLInputElement;
        const oppId = el.getAttribute('data-opp-id');
        const itemId = el.getAttribute('data-item-id');
        if (!oppId || !itemId) return;
        const clientId = authService.getCurrentUser()?.clientId || host.resolveClientId();
        if (!clientId) {
          host.showToast('Cliente no resuelto', 'warning');
          return;
        }
        try {
          toggleClientOpportunityChecklistItem({
            clientId,
            opportunityId: oppId,
            itemId,
            done: el.checked,
          });
          host.render();
        } catch (err) {
          const message =
            err instanceof OpportunityApplicationError
              ? err.message
              : 'No se pudo actualizar el checklist';
          host.showToast(message, 'warning');
        }
      });
    });

    document.querySelectorAll('.btn-submit-opportunity').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const oppId = (e.currentTarget as HTMLElement).getAttribute('data-opp-id');
        if (!oppId) return;
        const clientId = authService.getCurrentUser()?.clientId || host.resolveClientId();
        if (!clientId) {
          host.showToast('Cliente no resuelto', 'warning');
          return;
        }
        try {
          const opp = submitClientOpportunity({
            clientId,
            opportunityId: oppId,
          });
          notifyManager(opp.clientId, {
            type: 'OPPORTUNITY',
            title: 'Postulación enviada',
            body: `«${opp.title}» — el cliente marcó la postulación como enviada.`,
            href: 'ws-briefing',
          });
          host.showToast('Postulación marcada como enviada. Tu Brand Manager fue notificado.', 'success');
          host.render();
        } catch (err) {
          const message =
            err instanceof OpportunityApplicationError
              ? err.message
              : 'Completa todos los ítems del checklist antes de enviar.';
          host.showToast(message, 'warning');
        }
      });
    });

    document.querySelectorAll('.btn-approve-thesis').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const thesisId = (e.currentTarget as HTMLElement).getAttribute('data-thesis-id');
        const clientId = authService.getCurrentUser()?.clientId || host.resolveClientId();
        if (!thesisId) {
          host.showToast('Selecciona una tesis explícita para aprobar.', 'warning');
          return;
        }
        try {
          // CR-1 #13 — Thesis Lifecycle Application owns client review.
          const result = decideThesisClientReview({
            requestedClientId: clientId,
            thesisId,
            decision: 'approve',
          });
          if (result.awaitsManagerActivation) {
            notifyManager(clientId, {
              type: 'THESIS',
              title: 'Tesis aprobada por el cliente',
              body: `«${result.thesis.title}» — puedes activarla en Identidad.`,
              href: 'ws-positioning',
            });
            host.showToast('Tesis aprobada. Tu Brand Manager la activará.', 'success');
          } else {
            host.showToast(
              result.appliedRevision
                ? 'Revisión aplicada. La tesis activa queda actualizada.'
                : 'Tesis aprobada.',
              'success'
            );
          }
          host.render();
        } catch (error) {
          host.showToast(
            error instanceof ThesisLifecycleError || error instanceof Error
              ? error.message
              : 'No se pudo aprobar la tesis',
            'warning'
          );
        }
      });
    });

    document.querySelectorAll('.btn-request-thesis-changes').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const thesisId = (e.currentTarget as HTMLElement).getAttribute('data-thesis-id');
        const clientId = authService.getCurrentUser()?.clientId || host.resolveClientId();
        if (!thesisId) {
          host.showToast('Selecciona una tesis explícita.', 'warning');
          return;
        }
        const feedback =
          (document.getElementById('thesis-change-notes') as HTMLTextAreaElement | null)?.value.trim() || undefined;
        try {
          const result = decideThesisClientReview({
            requestedClientId: clientId,
            thesisId,
            decision: 'request_changes',
            feedback,
          });
          notifyManager(clientId, {
            type: 'THESIS',
            title: 'Cambios solicitados en la tesis',
            body: feedback
              ? `«${result.thesis.title}»: ${feedback.slice(0, 120)}`
              : `El cliente pidió ajustes en «${result.thesis.title}».`,
            href: 'ws-positioning',
          });
          host.showToast('Cambios solicitados al manager', 'info');
          host.render();
        } catch (error) {
          host.showToast(
            error instanceof ThesisLifecycleError || error instanceof Error
              ? error.message
              : 'No se pudo solicitar cambios',
            'warning'
          );
        }
      });
    });

    document.querySelectorAll('.btn-client-approve-content').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-content-id');
        if (!id) return;
        host.approveClientArticle(id);
      });
    });

    document.querySelectorAll('.btn-request-content-changes').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-content-id');
        if (!id) return;
        host.activeModal = 'feedback';
        host.modalData = { targetId: id, type: 'CONTENT' };
        host.render();
      });
    });

    const formAddResult = document.getElementById('form-add-result');
    formAddResult?.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientId = formAddResult.getAttribute('data-client-id') || authService.getCurrentUser()?.clientId || '';
      const organizationId = host.resolveOrganizationId(clientId);
      if (!organizationId) {
        host.showToast('Cliente sin organizationId — no se puede registrar el resultado', 'warning');
        return;
      }
      try {
        registerResultRecordIntent({
          clientId,
          title: (document.getElementById('result-title') as HTMLInputElement).value,
          channel: (document.getElementById('result-channel') as HTMLInputElement).value,
          metricLabel: (document.getElementById('result-metric-label') as HTMLInputElement).value,
          metricValue: Number((document.getElementById('result-metric-value') as HTMLInputElement).value || 0),
          kpiType: (document.getElementById('result-kpi-type') as HTMLSelectElement).value as BusinessKpiType,
        });
      } catch (error) {
        host.showToast(
          error instanceof Error ? error.message : 'No se pudo registrar el resultado',
          'warning'
        );
        return;
      }
      host.showToast('Resultado registrado', 'success');
      host.render();
    });

    document.getElementById('form-quick-kpi-consultation')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const clientId = form.getAttribute('data-client-id') || authService.getCurrentUser()?.clientId || '';
      const organizationId = host.resolveOrganizationId(clientId);
      if (!organizationId) {
        host.showToast('Cliente sin organizationId — no se puede registrar la consulta', 'warning');
        return;
      }
      const note = (document.getElementById('quick-kpi-note') as HTMLInputElement).value.trim();
      try {
        registerResultRecordIntent({
          clientId,
          title: note ? `Consulta: ${note}` : 'Consulta recibida',
          channel: 'LinkedIn / Web',
          metricLabel: 'Consultas recibidas',
          metricValue: 1,
          kpiType: 'consultation_requests',
          notes: note || undefined,
        });
      } catch (error) {
        host.showToast(
          error instanceof Error ? error.message : 'No se pudo registrar la consulta',
          'warning'
        );
        return;
      }
      host.showToast('Consulta registrada — dashboard actualizado', 'success');
      host.render();
    });

    document.querySelectorAll('.btn-result-to-evidence').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-result-id');
        const clientId = authService.getCurrentUser()?.clientId || host.resolveClientId();
        const result = dbService.getResultsByClient(clientId).find((r) => r.id === id);
        if (!result) return;
        dbService.addEvidenceItem({
          organizationId: result.organizationId,
          clientId: result.clientId,
          title: result.title,
          type: 'MEDIA',
          snippet: `${result.channel}: ${result.metricLabel} ${result.metricValue}`,
          confidenceScore: 80,
          verified: true,
          verifiedAt: new Date().toISOString(),
          associatedThesesIds: [],
        });
        result.addedToEvidence = true;
        host.showToast('Resultado copiado al evidence vault', 'success');
        host.render();
      });
    });

  bindTeleprompterHandlers(host);
}
