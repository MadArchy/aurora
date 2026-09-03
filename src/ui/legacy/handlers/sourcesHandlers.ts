import { authService } from '../../../services/auth';
import { dbService } from '../../../services/db';
import { auditService } from '../../../services/audit';
import {
  buildMergedProfileKeywords,
  discoverSources,
  normalizeSourceUrl,
} from '../../../services/sourceDiscovery';
import { registerManualSignal, registerSource } from '../../../services/signalIntakeConsumer';
import { SignalIntakeError } from '../../../application/signalIntake';
import { fetchSourceItems } from '../../../services/sourceApi';
import { labelSourceRunError } from '../../../domain/sourceIngestCore';
import {
  loadLastAgentRun,
  resolveDiscoveryCandidate,
  runSourceDiscoveryAgentAsync,
  saveAgentRun,
} from '../../../services/sourceDiscoveryAgent';
import { buildCuratedPresetsForProfile } from '../../../services/industryPresets';
import { discoverExtendedSources } from '../../../services/extendedSourceDiscovery';
import { enrichYoutubeDiscoverySources } from '../../../services/youtubeDiscovery';
import type { Source } from '../../../types';
import { scoreSignal } from './radarHandlers';
import type { SourcesHandlerHost } from '../legacyAppHost';

export function promptManualSignal(host: SourcesHandlerHost, clientId: string): void {
  const title = prompt('Título de la noticia o acontecimiento:');
  if (!title?.trim()) return;

  try {
    // CR-1 #26 — Signal Intake owns RegisterManualSignal (persistence only).
    const result = registerManualSignal({
      requestedClientId: clientId,
      title: title.trim(),
    });

    if (result.isDuplicate) {
      host.showToast('Esta señal ya estaba registrada.', 'warning');
      return;
    }
    // SPEC-001 routing begins after intake persistence (not Application authority).
    scoreSignal(host, result.signal.id, clientId);
    host.showToast('Señal añadida. Revisa el radar.', 'success');
    host.setTab('ws-radar');
  } catch (error) {
    host.showToast(
      error instanceof SignalIntakeError || error instanceof Error
        ? error.message
        : 'No se pudo crear la señal',
      'warning'
    );
  }
}

export function bindSourcesHandlers(host: SourcesHandlerHost): void  {
  document.getElementById('btn-open-source-registry')?.addEventListener('click', (e) => {
    const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || host.resolveClientId();
    host.activeModal = 'source-registry';
    host.modalData = { clientId };
    host.render();
  });

  document.getElementById('btn-close-source-registry')?.addEventListener('click', () => host.closeModal());

  document.getElementById('form-add-source')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const clientId = form.getAttribute('data-client-id') || host.resolveClientId();
    const name = (document.getElementById('src-name') as HTMLInputElement).value;
    const type = (document.getElementById('src-type') as HTMLSelectElement).value as Source['type'];
    const url = (document.getElementById('src-url') as HTMLInputElement).value;
    // Client-wide source — no silent thesisId attribution to primary/[0].

    try {
      // CR-1 #8 — Signal Intake Application owns RegisterSource.
      registerSource({
        requestedClientId: clientId,
        name,
        type,
        url: url || undefined,
        fetchIntervalMinutes: 360,
        thesisId: undefined,
      });
      host.showToast(`Fuente "${name}" registrada para el cliente`, 'success');
      host.activeModal = null;
      host.setTab('ws-sources');
    } catch (error) {
      host.showToast(
        error instanceof SignalIntakeError || error instanceof Error
          ? error.message
          : 'No se pudo añadir la fuente',
        'warning'
      );
    }
  });

  const pollAllBtn = document.getElementById('btn-poll-all-sources');
  pollAllBtn?.addEventListener('click', async () => {
    pollAllBtn.textContent = 'Buscando…';
    const { created, failed, rejected } = await host.sourceAutomation.pollSources();
    const parts: string[] = [];
    parts.push(created ? `${created} señal(es) nueva(s)` : 'Sin novedades');
    if (rejected) parts.push(`${rejected} descartada(s) por ruido`);
    if (failed) parts.push(`${failed} fuente(s) con error`);
    host.showToast(parts.join(' · '), created ? 'success' : failed ? 'warning' : 'info');
    host.activeModal = null;
    if (host.currentClientId()) {
      host.setTab(host.activeTab === 'ws-sources' ? 'ws-sources' : 'ws-radar');
    } else {
      host.render();
    }
  });

  document.querySelectorAll('.btn-probe-source').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const sourceId = (e.currentTarget as HTMLElement).getAttribute('data-source-id');
      const source = dbService.getSources().find((s) => s.id === sourceId);
      if (!source?.url) return;

      const el = e.currentTarget as HTMLButtonElement;
      el.textContent = 'Probando…';
      el.disabled = true;
      try {
        const { items, error } = await fetchSourceItems(source.url);
        if (error) {
          dbService.recordSourceRun(source.id, {
            fetched: 0,
            accepted: 0,
            rejected: 0,
            duplicates: 0,
            error,
          });
          host.showToast(`${source.name}: ${labelSourceRunError(error)}`, 'warning');
        } else {
          if (source.status === 'ERROR' || source.lastError) {
            dbService.updateSourceStatus(source.id, 'ACTIVE', { clearError: true });
          }
          host.showToast(`${source.name}: feed OK · ${items.length} item(s) legibles`, 'success');
        }
        host.render();
      } catch {
        host.showToast(`${source.name}: no se pudo probar el feed`, 'warning');
      } finally {
        el.textContent = 'Probar feed';
        el.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-pause-source').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const sourceId = (e.currentTarget as HTMLElement).getAttribute('data-source-id');
      if (!sourceId) return;
      const source = dbService.updateSourceStatus(sourceId, 'PAUSED');
      if (!source) return;
      auditService.log(authService.getCurrentUser(), 'SOURCE_PAUSED', 'Source', sourceId);
      host.showToast(`Fuente «${source.name}» pausada`, 'info');
      host.render();
    });
  });

  document.querySelectorAll('.btn-resume-source').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const sourceId = (e.currentTarget as HTMLElement).getAttribute('data-source-id');
      if (!sourceId) return;
      const source = dbService.updateSourceStatus(sourceId, 'ACTIVE', { clearError: true });
      if (!source) return;
      auditService.log(authService.getCurrentUser(), 'SOURCE_RESUMED', 'Source', sourceId);
      host.showToast(`Fuente «${source.name}» reactivada`, 'success');
      host.render();
    });
  });

  document.querySelectorAll('.btn-archive-source').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const sourceId = (e.currentTarget as HTMLElement).getAttribute('data-source-id');
      if (!sourceId) return;
      const existing = dbService.getSources().find((s) => s.id === sourceId);
      if (!existing) return;
      if (!window.confirm(`¿Archivar «${existing.name}»? Dejará de aparecer en ingesta.`)) return;
      const source = dbService.updateSourceStatus(sourceId, 'ARCHIVED');
      if (!source) return;
      auditService.log(authService.getCurrentUser(), 'SOURCE_ARCHIVED', 'Source', sourceId);
      host.showToast(`Fuente «${source.name}» archivada`, 'info');
      host.render();
    });
  });

  document.querySelectorAll('.btn-poll-one-source').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const sourceId = (e.currentTarget as HTMLElement).getAttribute('data-source-id');
      const source = dbService.getSources().find((s) => s.id === sourceId);
      if (!source?.url) return;
      try {
        const { created, rejected } = await host.sourceAutomation.pollOneSource(source);
        host.showToast(
          `${source.name}: ${created} nueva(s)${rejected ? `, ${rejected} filtrada(s)` : ''}`,
          created ? 'success' : 'info'
        );
        host.render();
      } catch (error) {
        host.showToast(`${source.name}: ${error instanceof Error ? error.message : 'fallo RSS'}`, 'warning');
        host.render();
      }
    });
  });

  document.querySelectorAll('.btn-add-discovered-source').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const clientId = el.getAttribute('data-client-id') || host.resolveClientId();
      const key = el.getAttribute('data-discovery-key');
      const client = dbService.getClientById(clientId);
      if (!client || !key) return;

      const candidate = resolveDiscoveryCandidate(client, undefined, key);
      if (!candidate) return;

      try {
        // CR-1 #24 — same RegisterSource command as SourceRegistryModal.
        registerSource({
          requestedClientId: clientId,
          name: candidate.name,
          type: candidate.type,
          url: candidate.url,
          fetchIntervalMinutes: fetchIntervalForKind(candidate.kind),
        });
        host.showToast(`Fuente añadida: ${candidate.name}`, 'success');
        host.setTab('ws-sources');
      } catch (error) {
        host.showToast(
          error instanceof SignalIntakeError || error instanceof Error
            ? error.message
            : 'No se pudo añadir la fuente',
          'warning'
        );
      }
    });
  });

  const fetchIntervalForKind = (kind: string): number => {
    if (kind === 'QUERY' || kind === 'SOCIAL') return 180;
    if (kind === 'YOUTUBE') return 240;
    if (kind === 'ACADEMIC') return 360;
    return 360;
  };

  const addAllBtn = document.getElementById('btn-add-all-discovered');
  addAllBtn?.addEventListener('click', async () => {
    const clientId = addAllBtn.getAttribute('data-client-id') || host.resolveClientId();
    const client = dbService.getClientById(clientId);
    if (!client) return;

    const lastRun = loadLastAgentRun(clientId);
    const existing = new Set(
      dbService.getSourcesByClient(clientId).map((s) => normalizeSourceUrl(s.url || ''))
    );
    const candidates = (
      lastRun?.recommendations.length
        ? lastRun.recommendations
        : discoverSources(client, undefined)
    ).filter((d) => !existing.has(normalizeSourceUrl(d.url)));

    let added = 0;
    for (const candidate of candidates) {
      try {
        registerSource({
          requestedClientId: clientId,
          name: candidate.name,
          type: candidate.type,
          url: candidate.url,
          fetchIntervalMinutes: fetchIntervalForKind(candidate.kind),
        });
        added += 1;
      } catch {
        continue;
      }
    }

    auditService.log(authService.getCurrentUser(), 'ADD_DISCOVERED_SOURCES_BULK', 'Client', clientId, { added });
    addAllBtn.textContent = 'Ingiriendo…';
    const { created, failed } = await host.sourceAutomation.pollSources();
    host.showToast(
      `${added} fuente(s) activada(s) · ${created} señal(es)${failed ? ` · ${failed} con error` : ''}`,
      created ? 'success' : 'info'
    );
    host.setTab('ws-sources');
  });

  const extendedBtn = document.getElementById('btn-add-extended-sources');
  extendedBtn?.addEventListener('click', async () => {
    const clientId = extendedBtn.getAttribute('data-client-id') || host.resolveClientId();
    const client = dbService.getClientById(clientId);
    if (!client) return;

    const active = dbService.getActiveTheses(clientId);
    const keywords = buildMergedProfileKeywords(client, active);
    const profile = dbService.getMasterProfile(clientId);
    const extendedBase = discoverExtendedSources(client, undefined);
    const enriched = await enrichYoutubeDiscoverySources(extendedBase, keywords, profile || undefined);
    const existing = new Set(
      dbService.getSourcesByClient(clientId).map((s) => normalizeSourceUrl(s.url || ''))
    );
    const candidates = enriched.sources.filter((d) => !existing.has(normalizeSourceUrl(d.url)));

    if (!candidates.length) {
      host.showToast('Social, YouTube y académico ya están activos', 'info');
      return;
    }

    let added = 0;
    for (const candidate of candidates) {
      try {
        registerSource({
          requestedClientId: clientId,
          name: candidate.name,
          type: candidate.type,
          url: candidate.url,
          fetchIntervalMinutes: fetchIntervalForKind(candidate.kind),
        });
        added += 1;
      } catch {
        continue;
      }
    }

    auditService.log(authService.getCurrentUser(), 'ADD_EXTENDED_SOURCES', 'Client', clientId, { added });
    extendedBtn.textContent = 'Ingiriendo…';
    const { created, failed } = await host.sourceAutomation.pollSources();
    host.showToast(
      `Social/YouTube/académico: ${added} fuente(s) · ${created} señal(es)${failed ? ` · ${failed} con error` : ''}`,
      created ? 'success' : 'info'
    );
    host.setTab('ws-sources');
  });

  const curatedTopBtn = document.getElementById('btn-add-curated-top3');
  curatedTopBtn?.addEventListener('click', async () => {
    const clientId = curatedTopBtn.getAttribute('data-client-id') || host.resolveClientId();
    const client = dbService.getClientById(clientId);
    if (!client) return;

    const active = dbService.getActiveTheses(clientId);
    const keywords = buildMergedProfileKeywords(client, active);
    const existing = new Set(
      dbService.getSourcesByClient(clientId).map((s) => normalizeSourceUrl(s.url || ''))
    );
    const candidates = buildCuratedPresetsForProfile(client, undefined, keywords).filter(
      (d) => !existing.has(normalizeSourceUrl(d.url))
    );

    if (!candidates.length) {
      host.showToast('Las 3 fuentes top ya están activas', 'info');
      return;
    }

    let added = 0;
    for (const candidate of candidates) {
      try {
        registerSource({
          requestedClientId: clientId,
          name: candidate.name,
          type: candidate.type,
          url: candidate.url,
          fetchIntervalMinutes: 240,
        });
        added += 1;
      } catch {
        continue;
      }
    }

    auditService.log(authService.getCurrentUser(), 'ADD_CURATED_TOP3_SOURCES', 'Client', clientId, { added });
    curatedTopBtn.textContent = 'Ingiriendo…';
    const { created, failed } = await host.sourceAutomation.pollSources();
    host.showToast(
      `Top 3 activado(s): ${added} fuente(s) · ${created} señal(es)${failed ? ` · ${failed} con error` : ''}`,
      created ? 'success' : 'info'
    );
    host.setTab('ws-radar');
  });

  const bindManualSignal = (el: Element) => {
    el.addEventListener('click', (e) => {
      const clientId = (e.currentTarget as HTMLElement).getAttribute('data-client-id') || host.resolveClientId();
      promptManualSignal(host, clientId);
    });
  };

  const manualBtn = document.getElementById('btn-add-manual-signal');
  if (manualBtn) bindManualSignal(manualBtn);
  const manualInlineBtn = document.getElementById('btn-add-manual-signal-inline');
  if (manualInlineBtn) bindManualSignal(manualInlineBtn);

  document.querySelectorAll('.btn-apply-source-suggestion').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const type = el.getAttribute('data-suggestion-type');
      const nameHint = el.getAttribute('data-suggestion-name');
      const typeSelect = document.getElementById('src-type') as HTMLSelectElement | null;
      const nameInput = document.getElementById('src-name') as HTMLInputElement | null;

      if (type && typeSelect) typeSelect.value = type;
      if (nameHint && nameInput && !nameInput.value.trim()) nameInput.value = nameHint;
      nameInput?.focus();
    });
  });

  document.querySelectorAll('.btn-open-agent-sources').forEach((btn) => {
    btn.addEventListener('click', () => {
      host.activeModal = null;
      host.setTab('ws-sources');
    });
  });

  const tavilyRescanBtn = document.getElementById('btn-tavily-rescan');
  tavilyRescanBtn?.addEventListener('click', async () => {
    const clientId = tavilyRescanBtn.getAttribute('data-client-id') || host.resolveClientId();
    const client = dbService.getClientById(clientId);
    if (!client) return;

    tavilyRescanBtn.textContent = 'Buscando…';
    tavilyRescanBtn.setAttribute('disabled', 'true');

    try {
      const run = await runSourceDiscoveryAgentAsync(client, undefined, { forceTavily: true });
      saveAgentRun(run);
      const tavilyCount = run.recommendations.filter((r) => r.kind === 'TAVILY').length;
      if (run.tavilyError === 'TAVILY_KEY_MISSING') {
        host.showToast('Configura TAVILY_API_KEY en .env.local y reinicia el servidor', 'warning');
      } else if (tavilyCount) {
        host.showToast(
          `Tavily: ${tavilyCount} fuente(s) web nueva(s) para ${client.displayName}`,
          'success'
        );
      } else {
        host.showToast('Tavily: sin fuentes nuevas para este perfil', 'info');
      }
      host.setTab('ws-sources');
    } catch (error) {
      host.showToast(error instanceof Error ? error.message : 'Fallo búsqueda Tavily', 'warning');
    } finally {
      tavilyRescanBtn.textContent = 'Buscar con Tavily';
      tavilyRescanBtn.removeAttribute('disabled');
    }
  });
}
