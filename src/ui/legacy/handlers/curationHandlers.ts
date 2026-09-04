import { ExecutionDeliveryError } from '../../../application/executionDelivery';
import { SignalIntakeError } from '../../../application/signalIntake';
import { auditService } from '../../../services/audit';
import { authService } from '../../../services/auth';
import { dbService } from '../../../services/db';
import { proposeAngle } from '../../../services/advisor';
import {
  approveStrategicBrief,
  createBriefFromCurationEntry,
  getStrategicBrief,
} from '../../../services/strategicBriefConsumer';
import { decideCuration } from '../../../services/executionDeliveryConsumer';
import { discardSignalForCurationComposite } from '../../../services/signalIntakeConsumer';
import type { CurationDestination } from '../../../types';
import { queueCurationInBriefing } from './radarHandlers';
import type { CurationHandlerHost } from '../legacyAppHost';

const DISCARD_PARTIAL_FAILURE_MESSAGE =
  'La decisión de curación se guardó, pero no se pudo descartar la señal vinculada.';

function showCurationSuccessToast(
  host: CurationHandlerHost,
  destination: CurationDestination,
  queued: boolean
): void {
  host.showToast(
    destination === 'DISCARD'
      ? 'Ítem descartado con justificación'
      : queued
        ? 'Destino confirmado y añadido al briefing'
        : 'Destino confirmado. Añádelo al briefing cuando quieras.',
    'success'
  );
}

/** CR-1 #14 — canonical curation form submit (testable seam). */
export function handleCurationFormSubmit(
  host: CurationHandlerHost,
  curationId: string,
  destination: CurationDestination,
  rationale: string
): void {
  const requestedClientId = host.resolveClientId();

  let entry;
  try {
    entry = decideCuration({
      requestedClientId,
      curationEntryId: curationId,
      destination,
      rationale,
    }).entry;
  } catch (error) {
    if (error instanceof ExecutionDeliveryError && error.code === 'CURATION_NOT_FOUND') {
      auditService.log(authService.getCurrentUser(), 'CURATION_DECIDED', 'CurationEntry', curationId, {
        destination,
        rationale,
      });
      showCurationSuccessToast(host, destination, false);
      host.render();
      return;
    }
    host.showToast(
      error instanceof Error ? error.message : 'No se pudo decidir la curación',
      'warning'
    );
    return;
  }

  if (entry.signalId && destination === 'DISCARD') {
    try {
      discardSignalForCurationComposite({
        requestedClientId: entry.clientId,
        signalId: entry.signalId,
        reason: rationale,
      });
    } catch (error) {
      if (error instanceof SignalIntakeError && error.code === 'SIGNAL_NOT_FOUND') {
        // Legacy-compatible success continuation after successful #14 DISCARD.
      } else {
        auditService.log(authService.getCurrentUser(), 'CURATION_DECIDED', 'CurationEntry', curationId, {
          destination,
          rationale,
        });
        host.showToast(DISCARD_PARTIAL_FAILURE_MESSAGE, 'warning');
        host.render();
        return;
      }
    }
  }

  auditService.log(authService.getCurrentUser(), 'CURATION_DECIDED', 'CurationEntry', curationId, {
    destination,
    rationale,
  });

  const queued = destination !== 'DISCARD' ? queueCurationInBriefing(curationId) : false;
  showCurationSuccessToast(host, destination, queued);
  host.render();
}

export function bindCurationHandlers(host: CurationHandlerHost): void  {
  document.querySelectorAll('.curation-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const el = form as HTMLFormElement;
      const curationId = el.getAttribute('data-curation-id');
      if (!curationId) return;

      const destination = (el.querySelector('[name="destination"]') as HTMLSelectElement)
        .value as CurationDestination;
      const rationale = (el.querySelector('[name="rationale"]') as HTMLTextAreaElement).value.trim();

      if (!destination) {
        host.showToast('Elige un destino para este ítem.', 'warning');
        return;
      }
      if (rationale.length < 10) {
        host.showToast('Escribe una justificación de al menos 10 caracteres.', 'warning');
        return;
      }

      handleCurationFormSubmit(host, curationId, destination, rationale);
    });
  });

  document.querySelectorAll('.btn-suggest-angle').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const curationId = target.getAttribute('data-curation-id');
      if (!curationId) return;

      const entry = dbService.getCurationById(curationId);
      if (!entry) return;

      target.disabled = true;
      target.textContent = 'Pensando…';
      try {
        const brief = entry.strategicBriefId
          ? getStrategicBrief(entry.strategicBriefId, entry.clientId)
          : undefined;
        const signal = entry.signalId ? dbService.getSignalById(entry.signalId) : undefined;
        const thesisId =
          brief?.thesisId ?? signal?.routingDecision?.selectedThesisId;
        if (!thesisId) {
          host.showToast(
            'Routing must be resolved first — create a Strategic Brief or ensure CLEAR governed routing.',
            'warning'
          );
          return;
        }
        const { angle, usedLiveModel } = await proposeAngle({
          clientId: entry.clientId,
          title: entry.title,
          snippet: entry.snippet,
          thesisId,
        });
        dbService.setCurationAngle(curationId, angle);
        host.showToast(usedLiveModel ? 'Ángulo propuesto con modelo' : 'Ángulo propuesto con reglas locales', 'success');
      } catch (error) {
        host.showToast(error instanceof Error ? error.message : 'No se pudo proponer el ángulo', 'warning');
      }
      host.render();
    });
  });

  document.querySelectorAll('.btn-remove-curation').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-curation-id');
      if (!id) return;
      dbService.removeCuration(id);
      auditService.log(authService.getCurrentUser(), 'CURATION_REMOVED', 'CurationEntry', id);
      host.showToast('Ítem retirado de la mesa', 'info');
      host.render();
    });
  });

  document.querySelectorAll('.btn-reopen-curation').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-curation-id');
      if (!id) return;
      dbService.reopenCuration(id);
      host.showToast('Ítem reabierto para volver a decidir', 'info');
      host.render();
    });
  });

  document.querySelectorAll('.btn-create-strategic-brief').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const curationId = (e.currentTarget as HTMLElement).getAttribute('data-curation-id');
      const destination = (e.currentTarget as HTMLElement).getAttribute('data-destination') as CurationDestination;
      if (!curationId || !destination) return;
      try {
        const { brief } = createBriefFromCurationEntry({ curationEntryId: curationId, destination });
        host.showToast(`Strategic Brief DRAFT created (${brief.id}).`, 'success');
      } catch (error) {
        host.showToast(error instanceof Error ? error.message : 'Could not create Strategic Brief.', 'warning');
      }
      host.render();
    });
  });

  document.querySelectorAll('.btn-approve-strategic-brief').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const briefId = (e.currentTarget as HTMLElement).getAttribute('data-brief-id');
      const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id');
      if (!briefId || !clientId) return;
      try {
        approveStrategicBrief({ clientId, briefId });
        host.showToast('Strategic Brief approved.', 'success');
      } catch (error) {
        host.showToast(error instanceof Error ? error.message : 'Could not approve Strategic Brief.', 'warning');
      }
      host.render();
    });
  });
}
