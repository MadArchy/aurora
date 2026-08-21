import { dbService } from './db';
import { metricsService } from './metrics';
import { summarizeSourceHealth } from './sourceHealth';

export interface PortfolioRadarMetrics {
  totalActiveSources: number;
  sourcesInError: number;
  sourcesHealthy: number;
  sourcesDegraded: number;
  ingestAccepted7d: number;
  signalsCreated7d: number;
  researchPending: number;
  clientsWithSourceErrors: number;
}

function sinceDays(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** Agregados de salud del radar para el panel de cartera. */
export function aggregatePortfolioRadarMetrics(): PortfolioRadarMetrics {
  const clients = dbService.getClients();
  const since7 = sinceDays(7);

  let totalActiveSources = 0;
  let sourcesInError = 0;
  let sourcesHealthy = 0;
  let sourcesDegraded = 0;
  let clientsWithSourceErrors = 0;
  let signalsCreated7d = 0;
  let researchPending = 0;

  for (const client of clients) {
    const sources = dbService.getSourcesByClient(client.id).filter((s) => s.status === 'ACTIVE');
    let clientHasError = false;
    totalActiveSources += sources.length;

    for (const source of sources) {
      const health = summarizeSourceHealth(source);
      if (health.status === 'ERROR') {
        sourcesInError += 1;
        clientHasError = true;
      } else if (health.status === 'HEALTHY') {
        sourcesHealthy += 1;
      } else if (health.status === 'DEGRADED' || health.status === 'EMPTY') {
        sourcesDegraded += 1;
      }
    }

    if (clientHasError) clientsWithSourceErrors += 1;

    signalsCreated7d += dbService
      .getSignalsByClient(client.id)
      .filter((s) => s.detectedAt >= since7 && s.status !== 'DISCARDED').length;

    researchPending += dbService
      .getSignalsByClient(client.id)
      .filter((s) => s.recommendedAction === 'RESEARCH_REQUIRED' && !s.researchBrief && s.status !== 'DISCARDED')
      .length;
  }

  let ingestAccepted7d = 0;
  for (const event of metricsService.eventsSince(since7)) {
    if (event.name === 'ingest_source_poll' && typeof event.meta?.accepted === 'number') {
      ingestAccepted7d += event.meta.accepted;
    }
  }

  return {
    totalActiveSources,
    sourcesInError,
    sourcesHealthy,
    sourcesDegraded,
    ingestAccepted7d,
    signalsCreated7d,
    researchPending,
    clientsWithSourceErrors,
  };
}

export function formatPresetBadge(label: string): string {
  return label.split('·')[0]?.trim() || label;
}
