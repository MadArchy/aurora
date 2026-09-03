import { dbService } from '../../../services/db';
import { auditService } from '../../../services/audit';
import { authService } from '../../../services/auth';
import { runTopicAgent } from '../../../services/topicAgent';
import { generatePositioningAdvice } from '../../../services/advisor';
import type { AdvisorHandlerHost } from '../legacyAppHost';

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
      const clientId = target.getAttribute('data-client-id') || host.resolveClientId();
      const actionId = target.getAttribute('data-action-id');
      const advice = dbService.getLatestAdvice(clientId);
      const action = advice?.actions.find((a) => a.id === actionId);
      if (!action) return;

      const organizationId = host.resolveOrganizationId(clientId);
      if (!organizationId) {
        host.showToast('Cliente sin organizationId', 'warning');
        return;
      }
      dbService.addToCuration({
        organizationId,
        clientId,
        title: action.title,
        snippet: `${action.why} ${action.how}`,
        score: action.impact,
        aiAngle: action.how,
        createdBy: authService.getCurrentUser()?.uid || 'user_admin_01',
      });

      auditService.log(authService.getCurrentUser(), 'ADVICE_TO_CURATION', 'Client', clientId, { actionId });
      host.showToast('Acción enviada a la mesa de curación', 'success');
      host.setTab('ws-curation');
    });
  });
}
