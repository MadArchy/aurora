import type { Source } from '../types';

export type SourceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'ERROR' | 'UNKNOWN' | 'EMPTY';

export interface SourceHealthSummary {
  status: SourceHealthStatus;
  label: string;
  acceptRate: number | null;
}

/** Resume salud de una fuente a partir del último run registrado. */
export function summarizeSourceHealth(source: Source): SourceHealthSummary {
  if (source.status === 'ERROR' || source.lastError) {
    return { status: 'ERROR', label: 'Error', acceptRate: acceptanceRate(source) };
  }

  if (source.lastRunFetched === undefined) {
    return { status: 'UNKNOWN', label: 'Sin probar', acceptRate: null };
  }

  if (source.lastRunFetched === 0) {
    return { status: 'EMPTY', label: 'Feed vacío', acceptRate: 0 };
  }

  const rate = acceptanceRate(source);
  if (rate === null) {
    return { status: 'UNKNOWN', label: 'Sin datos', acceptRate: null };
  }

  if (rate >= 0.15) {
    return { status: 'HEALTHY', label: `${Math.round(rate * 100)}% útil`, acceptRate: rate };
  }

  if (rate > 0) {
    return { status: 'DEGRADED', label: `${Math.round(rate * 100)}% útil`, acceptRate: rate };
  }

  return { status: 'DEGRADED', label: '0% útil (ruido)', acceptRate: 0 };
}

function acceptanceRate(source: Source): number | null {
  if (source.lastRunFetched === undefined || source.lastRunFetched === 0) return null;
  const accepted = source.lastRunAccepted || 0;
  return accepted / source.lastRunFetched;
}

export const JUAN_RECOMMENDED_STACK = [
  'USPTO — noticias oficiales',
  'NIST — IA y ciberseguridad',
  'IPWatchdog — patentes',
  'Bloomberg Law (Top 3)',
  'Managing IP (Top 3)',
  'Law.com (Top 3)',
];

export { getRecommendedStackForPreset } from './industryPresets';
