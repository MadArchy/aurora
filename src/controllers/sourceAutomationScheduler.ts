import { authService } from '../services/auth';
import { dbService } from '../services/db';
import { auditService } from '../services/audit';
import { isWorkspaceTab } from '../components/PageHeader';
import type { Source } from '../types';
import {
  loadLastAgentRun,
  profileChangedSinceLastRun,
  runSourceDiscoveryAgent,
  runSourceDiscoveryAgentAsync,
  saveAgentRun,
  sourcesDueForIngest,
} from '../services/sourceDiscoveryAgent';
import { runResearchSignalsAgent } from '../services/researchSignalsAgent';
import { shouldAutoResearchSignal } from '../domain/radarTriageCore';
import { pollAllActiveSources, pollRegisteredSource } from '../services/signalIntakeConsumer';
import type { SourceAutomationHost } from '../ui/legacy/legacyAppHost';

/** Intervalo entre escaneos del agente de fuentes (1 h). */
export const DISCOVERY_SCAN_MS = 60 * 60 * 1000;
/** Revisa ingesta programada cada 5 min. */
export const INGEST_TICK_MS = 5 * 60 * 1000;

export class SourceAutomationScheduler {
  sourceAgentTimer: number | null = null;
  sourceIngestTimer: number | null = null;
  lastDiscoveryScanAt = 0;

  constructor(private readonly host: SourceAutomationHost) {}

  startSourceAutomation() {
    this.stopSourceAutomation();
    void this.tickSourceDiscovery();
    void this.tickScheduledIngest();
    this.sourceIngestTimer = window.setInterval(() => {
      void this.tickScheduledIngest();
    }, INGEST_TICK_MS);
    this.sourceAgentTimer = window.setInterval(() => {
      void this.tickSourceDiscovery();
    }, DISCOVERY_SCAN_MS);
  }

  stopSourceAutomation() {
    if (this.sourceIngestTimer !== null) {
      window.clearInterval(this.sourceIngestTimer);
      this.sourceIngestTimer = null;
    }
    if (this.sourceAgentTimer !== null) {
      window.clearInterval(this.sourceAgentTimer);
      this.sourceAgentTimer = null;
    }
  }

  /** Agente de fuentes: escanea perfiles y notifica recomendaciones nuevas. */
  async tickSourceDiscovery() {
    const now = Date.now();
    if (now - this.lastDiscoveryScanAt < DISCOVERY_SCAN_MS - 30_000) return;
    this.lastDiscoveryScanAt = now;

    for (const client of dbService.getClients()) {
      const lastRun = loadLastAgentRun(client.id);
      const profileChanged = profileChangedSinceLastRun(client, undefined, lastRun);
      const run = profileChanged
        ? await runSourceDiscoveryAgentAsync(client, undefined)
        : runSourceDiscoveryAgent(client, undefined);
      const previousKeys = new Set(lastRun?.recommendations.map((r) => r.key) || []);
      const freshHigh = run.recommendations.filter(
        (r) => r.priority === 'HIGH' && !previousKeys.has(r.key)
      );

      saveAgentRun(run);

      if (run.pendingCount > 0 && (profileChanged || freshHigh.length)) {
        const viewingClient = this.host.activeClientId === client.id && this.host.activeTab === 'ws-sources';
        if (viewingClient || freshHigh.length) {
          const tavilyHint = run.tavilyUsed ? ' · Tavily' : '';
          this.host.showToast(
            `Agente de fuentes · ${client.displayName}: ${run.pendingCount} fuente(s) recomendada(s)${freshHigh.length ? ` (${freshHigh.length} prioritarias)` : ''}${tavilyHint}`,
            'info'
          );
        }
      }
    }

    if (this.host.activeTab === 'ws-sources' && this.host.activeClientId !== 'all') {
      this.host.render();
    }
  }

  /** Tras ingesta: investiga automáticamente HIGH/CRITICAL con RESEARCH_REQUIRED. */
  async autoResearchPrioritySignals(clientId: string): Promise<number> {
    const candidates = dbService
      .getSignalsByClient(clientId)
      .filter(shouldAutoResearchSignal)
      .slice(0, 2);
    if (!candidates.length) return 0;

    let done = 0;
    for (const signal of candidates) {
      try {
        const result = await runResearchSignalsAgent(clientId, { signalId: signal.id, maxSignals: 1 });
        if (result.briefs.length) done += 1;
      } catch {
        // no bloquear ingesta si Tavily falla
      }
    }
    return done;
  }

  /** Ingesta automática según fetchIntervalMinutes del cliente activo. */
  async tickScheduledIngest() {
    // AUDIT010-11: el scheduler caía en `getClients()[0]` cuando no había
    // workspace activo, ingiriendo para un tenant elegido por posición. Sin
    // scope explícito no se ingiere: el tick espera al siguiente ciclo.
    const scoped =
      isWorkspaceTab(this.host.activeTab) && this.host.activeClientId !== 'all'
        ? this.host.activeClientId
        : '';
    const grant = this.host.requireTenant(scoped);
    if (!grant.ok) return;
    const clientId = grant.clientId;

    const due = sourcesDueForIngest(clientId).slice(0, 4);
    if (!due.length) return;

    let created = 0;
    for (const source of due) {
      try {
        const outcome = await this.pollOneSource(source);
        created += outcome.created;
      } catch {
        // error ya registrado en recordSourceRun
      }
    }

    if (created > 0) {
      const researched = await this.autoResearchPrioritySignals(clientId);
      auditService.log(authService.getCurrentUser(), 'SOURCE_AUTO_INGEST', 'Client', clientId, {
        created,
        polled: due.length,
        researched,
      });
      if (this.host.activeTab === 'ws-radar' || this.host.activeTab === 'ws-sources') {
        this.host.render();
      }
    }
  }

  /** Presentation wiring — delegates ingest orchestration to Signal Intake Application (#9). */
  async pollSources(): Promise<{ created: number; failed: number; rejected: number }> {
    const clientId = this.host.currentClientId();
    const grant = this.host.requireTenant(clientId);
    if (!grant.ok) return { created: 0, failed: 0, rejected: 0 };
    const result = await pollAllActiveSources({ requestedClientId: grant.clientId });
    if (result.created > 0) {
      await this.autoResearchPrioritySignals(grant.clientId);
    }
    return result;
  }

  async pollOneSource(source: Source): Promise<{ created: number; rejected: number }> {
    const clientId = source.clientId || this.host.currentClientId();
    const result = await pollRegisteredSource({
      requestedClientId: clientId,
      sourceId: source.id,
    });
    return { created: result.created, rejected: result.rejected };
  }
}
