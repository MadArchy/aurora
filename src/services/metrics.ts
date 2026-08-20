export interface MetricEvent {
  name: string;
  at: string;
  clientId?: string;
  meta?: Record<string, string | number | boolean>;
}

const METRICS_KEY = 'postura_metrics_v1';
const MAX_EVENTS = 500;

class MetricsService {
  private events: MetricEvent[] = [];

  constructor() {
    try {
      const raw = localStorage.getItem(METRICS_KEY);
      if (raw) this.events = JSON.parse(raw) as MetricEvent[];
    } catch {
      this.events = [];
    }
  }

  private persist(): void {
    localStorage.setItem(METRICS_KEY, JSON.stringify(this.events.slice(-MAX_EVENTS)));
  }

  track(name: string, meta?: MetricEvent['meta'], clientId?: string): void {
    this.events.push({ name, at: new Date().toISOString(), clientId, meta });
    this.persist();
  }

  recent(limit = 50): MetricEvent[] {
    return this.events.slice(-limit).reverse();
  }

  countByName(sinceIso?: string): Record<string, number> {
    const since = sinceIso ? Date.parse(sinceIso) : 0;
    const tally: Record<string, number> = {};
    for (const event of this.events) {
      if (Date.parse(event.at) < since) continue;
      tally[event.name] = (tally[event.name] || 0) + 1;
    }
    return tally;
  }
}

export const metricsService = new MetricsService();
