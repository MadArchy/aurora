import { authService } from '../../../services/auth';
import { dbService } from '../../../services/db';
import { aiService } from '../../../services/ai';
import { auditService } from '../../../services/audit';
import { buildMergedProfileKeywords } from '../../../services/sourceDiscovery';
import { resolveThesisForSignalOperation } from '../../../domain/routedThesisContext';
import { SignalIntakeError } from '../../../application/signalIntake';
import { ExecutionDeliveryError } from '../../../application/executionDelivery';
import { StrategicRoutingError } from '../../../application/strategicSignalRouting';
import { runResearchSignalsAgent } from '../../../services/researchSignalsAgent';
import { registerSignalOutcomeIntent } from '../../../services/learningLoopConsumer';
import { addSignalToCuration, addCurationToDelivery } from '../../../services/executionDeliveryConsumer';
import { discardSignal, markSignalSaved } from '../../../services/signalIntakeConsumer';
import { metricsService } from '../../../services/metrics';
import type { ScoringContext } from '../../../services/scoring';
import type { RadarHandlerHost } from '../legacyAppHost';

export function scoringContext(clientId: string): ScoringContext {
  const client = dbService.getClientById(clientId);
  if (!client) return {};
  const keywords = buildMergedProfileKeywords(client, dbService.getActiveTheses(clientId));
  const dossier = dbService.getMasterDossier(clientId);
  return {
    bilingualTerms: [...keywords.coreEn, ...keywords.coreEs],
    ownedTopics: dossier?.topicsToOwn,
    avoidedFramings: dossier?.topicsToAvoid || [],
  };
}

export function scoreSignal(host: RadarHandlerHost, signalId: string, clientId: string): number | null {
  const organizationId = host.resolveOrganizationId(clientId);
  if (!organizationId) return null;

  try {
    const result = host.strategicRouting.scoreAndRouteSignal({
      signalId,
      clientId,
      organizationId,
    });
    if (result.routing.routingState === 'UNROUTED' && result.routing.eligibleThesisCount === 0) {
      return null;
    }
    return result.scoreResult.totalScore;
  } catch (error) {
    if (error instanceof StrategicRoutingError && error.code === 'SIGNAL_NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

export function queueCurationInBriefing(curationId: string, requestedClientId: string): boolean {
  const result = addCurationToDelivery({
    requestedClientId,
    curationEntryId: curationId,
  });
  return result.ok;
}

/**
 * Primary #20 radar discard click — canonical consumer with legacy missing-signal
 * presentation compatibility (Wave A1 remediation).
 */
export function handleRadarDiscardSignalClick(host: RadarHandlerHost, signalId: string): void {
  if (!signalId) return;
  const signal = dbService.getSignalById(signalId);
  const clientId = host.resolveClientId(signal?.clientId);
  if (!clientId) return;
  try {
    discardSignal({ requestedClientId: clientId, signalId });
  } catch (error) {
    if (error instanceof SignalIntakeError && error.code === 'SIGNAL_NOT_FOUND') {
      auditService.log(authService.getCurrentUser(), 'SIGNAL_DISCARDED', 'Signal', signalId);
      host.showToast('Señal descartada', 'info');
      host.refreshMain();
      return;
    }
    host.showToast(
      error instanceof Error ? error.message : 'No se pudo descartar la señal',
      'warning'
    );
    return;
  }
  host.showToast('Señal descartada', 'info');
  host.refreshMain();
}

/**
 * Primary #21 composite send-to-curation click — canonical #21a AddSignalToCuration then frozen #21b
 * with legacy missing-signal presentation compatibility (Wave A2).
 */
export function handleSendToCurationClick(host: RadarHandlerHost, signalId: string): void {
  if (!signalId) return;

  const signal = dbService.getSignalById(signalId);
  const clientId = host.resolveClientId(signal?.clientId);
  if (!signal) return;

  if (dbService.isSignalInCuration(clientId, signalId)) {
    host.showToast('Esta señal ya está en la mesa de curación.', 'info');
    return;
  }

  if (signal.relevanceScore === undefined) scoreSignal(host, signalId, clientId);

  try {
    addSignalToCuration({ requestedClientId: clientId, signalId });
  } catch (error) {
    if (error instanceof ExecutionDeliveryError && error.code === 'CURATION_ALREADY_EXISTS') {
      host.showToast('Esta señal ya está en la mesa de curación.', 'info');
      return;
    }
    host.showToast(
      error instanceof Error ? error.message : 'No se pudo enviar a curación',
      'warning'
    );
    return;
  }

  try {
    markSignalSaved({ requestedClientId: clientId, signalId });
  } catch (error) {
    if (error instanceof SignalIntakeError && error.code === 'SIGNAL_NOT_FOUND') {
      // #21a already persisted — legacy composite continues to audit/toast/refresh.
    } else {
      host.showToast(
        error instanceof Error ? error.message : 'No se pudo marcar la señal como guardada',
        'warning'
      );
      return;
    }
  }

  auditService.log(authService.getCurrentUser(), 'SIGNAL_TO_CURATION', 'Signal', signalId, { clientId });
  host.showToast('Enviada a curación', 'success');
  host.refreshMain();
}

export function bindRadarHandlers(host: RadarHandlerHost): void  {
  document.getElementById('btn-score-all-signals')?.addEventListener('click', (e) => {
    const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || host.resolveClientId();
    const pending = dbService.getSignalsByClient(clientId).filter((s) => s.relevanceScore === undefined && s.status !== 'DISCARDED');
    let scored = 0;
    pending.forEach((s) => {
      if (scoreSignal(host, s.id, clientId) !== null) scored += 1;
    });
    auditService.log(authService.getCurrentUser(), 'SCORE_SIGNALS_BULK', 'Client', clientId, { scored });
    host.showToast(scored ? `${scored} señal(es) puntuada(s)` : 'No hay tesis activa para puntuar', scored ? 'success' : 'warning');
    host.render();
  });

  document.getElementById('btn-research-all-signals')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const grant = host.requireTenant(btn.getAttribute('data-client-id') || host.resolveClientId());
    if (!grant.ok) {
      host.showToast(grant.message, 'warning');
      return;
    }
    const clientId = grant.clientId;
    btn.disabled = true;
    btn.textContent = 'Investigando…';
    try {
      const result = await runResearchSignalsAgent(clientId, { maxSignals: 3 });
      const ok = result.briefs.length;
      const err = result.errors.length;
      if (result.errors.some((x) => x.error === 'TAVILY_KEY_MISSING')) {
        host.showToast('Configura TAVILY_API_KEY en .env.local', 'warning');
      } else {
        host.showToast(
          ok ? `${ok} señal(es) investigada(s)${err ? ` · ${err} error(es)` : ''}` : 'Sin señales pendientes o Tavily falló',
          ok ? 'success' : 'warning'
        );
      }
      auditService.log(authService.getCurrentUser(), 'RESEARCH_SIGNALS_RUN', 'Client', clientId, { ok, err });
      metricsService.track('research_signals_run', { ok, err }, clientId);
    } catch (error) {
      host.showToast(error instanceof Error ? error.message : 'Investigación fallida', 'warning');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Investigar pendientes';
      host.render();
    }
  });

  document.querySelectorAll('.btn-research-signal').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const signalId = target.getAttribute('data-signal-id');
      if (!signalId) return;
      const signal = dbService.getSignalById(signalId);
      const grant = host.requireTenant(host.resolveClientId(signal?.clientId));
      if (!grant.ok) {
        host.showToast(grant.message, 'warning');
        return;
      }
      const clientId = grant.clientId;
      target.disabled = true;
      target.textContent = '…';
      try {
        const result = await runResearchSignalsAgent(clientId, { signalId, maxSignals: 1 });
        if (result.briefs.length) {
          host.showToast('Evidencia Tavily adjunta a la señal', 'success');
        } else if (result.errors.some((x) => x.error === 'TAVILY_KEY_MISSING')) {
          host.showToast('Configura TAVILY_API_KEY en .env.local', 'warning');
        } else {
          host.showToast(result.errors[0]?.error || 'Sin resultados', 'warning');
        }
      } catch (error) {
        host.showToast(error instanceof Error ? error.message : 'Error', 'warning');
      }
      host.render();
    });
  });

  document.querySelectorAll('.btn-analyze-signal').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const signalId = target.getAttribute('data-signal-id');
      if (!signalId) return;

      const signal = dbService.getSignalById(signalId);
      const clientId = host.resolveClientId(signal?.clientId);
      if (!signal) {
        host.showToast('Señal no encontrada.', 'warning');
        return;
      }

      // Deterministic routing first; advisory AI only on CLEAR routed thesis.
      scoreSignal(host, signalId, clientId);
      const routedSignal = dbService.getSignalById(signalId) || signal;
      const resolved = resolveThesisForSignalOperation(
        routedSignal,
        dbService.getThesesByClient(clientId)
      );
      if (!resolved.ok) {
        const msg =
          resolved.error === 'CONTESTED'
            ? 'Conflicto entre tesis — resuelve manualmente antes del análisis AI.'
            : resolved.error === 'UNROUTED'
              ? 'Señal sin tesis enrutada — no se puede analizar.'
              : 'No hay tesis válida para analizar esta señal.';
        host.showToast(msg, 'warning');
        host.render();
        return;
      }
      const thesis = resolved.thesis;

      target.disabled = true;
      target.textContent = 'Analizando…';
      try {
        const rec = await aiService.analyzeSignalAgainstThesis(
          routedSignal,
          thesis,
          scoringContext(clientId)
        );
        const { usedLiveModel, ...payload } = rec as typeof rec & { usedLiveModel?: boolean };
        dbService.addRecommendation(payload);
        host.showToast(
          `Score ${payload.impactScore}/100${usedLiveModel ? ' · con modelo' : ' · scoring local'}`,
          'success'
        );
      } catch (error) {
        host.showToast(error instanceof Error ? error.message : 'No se pudo analizar', 'warning');
      }
      host.render();
    });
  });

  document.querySelectorAll('.btn-discard-signal').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-signal-id');
      if (!id) return;
      handleRadarDiscardSignalClick(host, id);
    });
  });

  document.querySelectorAll('.btn-signal-outcome').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const signalId = el.getAttribute('data-signal-id');
      const kind = el.getAttribute('data-outcome') as 'USEFUL' | 'NOT_USEFUL' | null;
      if (!signalId || (kind !== 'USEFUL' && kind !== 'NOT_USEFUL')) return;
      const signal = dbService.getSignalById(signalId);
      const clientId = host.resolveClientId(signal?.clientId);
      if (!signal || !clientId) return;
      try {
        registerSignalOutcomeIntent({
          clientId,
          signalId,
          kind,
          source: 'RADAR',
          thesisId: signal.thesisId,
        });
      } catch (error) {
        host.showToast(
          error instanceof Error ? error.message : 'No se pudo registrar el outcome',
          'warning'
        );
        return;
      }
      auditService.log(authService.getCurrentUser(), 'SIGNAL_OUTCOME', 'Signal', signalId, { kind });
      metricsService.track('signal_outcome', { kind }, clientId);
      host.showToast(
        kind === 'USEFUL' ? 'Marcada como útil' : 'Marcada como no útil',
        'success'
      );
      host.refreshMain();
    });
  });

  document.querySelectorAll('.btn-send-to-curation').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const signalId = (e.currentTarget as HTMLElement).getAttribute('data-signal-id');
      if (!signalId) return;
      handleSendToCurationClick(host, signalId);
    });
  });
}
