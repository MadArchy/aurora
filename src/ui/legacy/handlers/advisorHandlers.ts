import { auditService } from '../../../services/audit';
import { authService } from '../../../services/auth';
import { runTopicAgent } from '../../../services/topicAgent';
import { generatePositioningAdvice } from '../../../services/advisor';
import { ExecutionDeliveryError } from '../../../application/executionDelivery';
import { addAdviceActionToCuration } from '../../../services/executionDeliveryConsumer';
import type { AdvisorHandlerHost } from '../legacyAppHost';

/** CR-1 #21a advisor — canonical add-to-curation click handler (testable seam). */
export function handleAdviceToCurationClick(
  host: AdvisorHandlerHost,
  requestedClientId: string,
  adviceActionId: string
): void {
  if (!adviceActionId) return;

  try {
    const result = addAdviceActionToCuration({ requestedClientId, adviceActionId });
    auditService.log(
      authService.getCurrentUser(),
      'ADVICE_TO_CURATION',
      'Client',
      result.entry.clientId,
      { actionId: result.adviceActionId }
    );
    host.showToast('Acción enviada a la mesa de curación', 'success');
    host.setTab('ws-curation');
  } catch (error) {
    if (error instanceof ExecutionDeliveryError && error.code === 'ADVICE_ACTION_NOT_FOUND') {
      return;
    }
    host.showToast(
      error instanceof Error ? error.message : 'No se pudo enviar a curación',
      'warning'
    );
  }
}

export function bindAdvisorHandlers(host: AdvisorHandlerHost): void  {
  const adviceBtn = document.getElementById('btn-generate-advice');
  adviceBtn?.addEventListener('click', async (e) => {
    const target = e.currentTarget as HTMLButtonElement;
    const grant = host.requireTenant(
      target.getAttribute('data-client-id') || host.resolveClientId(),
    );
    if (!grant.ok) {
      host.showToast(grant.message, 'warning');
      return;
    }
    const clientId = grant.clientId;
    target.disabled = true;
    target.textContent = 'Analizando…';
    try {
      const advice = await generatePositioningAdvice(clientId);
      host.showToast(
        `${advice.actions.length} acción(es) propuesta(s)${advice.usedLiveModel ? ' con modelo' : ' con reglas locales'}`,
        'success'
      );
    } catch (error) {
      host.showToast(error instanceof Error ? error.message : 'No se pudo generar el diagnóstico', 'warning');
    }
    host.render();
  });

  document.getElementById('btn-run-topic-agent')?.addEventListener('click', (e) => {
    const target = e.currentTarget as HTMLButtonElement;
    const grant = host.requireTenant(
      target.getAttribute('data-client-id') || host.resolveClientId(),
    );
    if (!grant.ok) {
      host.showToast(grant.message, 'warning');
      return;
    }
    const clientId = grant.clientId;
    target.disabled = true;
    try {
      const result = runTopicAgent(clientId);
      host.showToast(`Ranking generado: ${result.items.length} temas`, 'success');
    } finally {
      target.disabled = false;
    }
    host.render();
  });

  document.querySelectorAll('.btn-advice-to-curation').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const requestedClientId = target.getAttribute('data-client-id') || host.resolveClientId();
      const adviceActionId = target.getAttribute('data-action-id') || '';
      handleAdviceToCurationClick(host, requestedClientId, adviceActionId);
    });
  });
}
