import type { BusinessKpiType, ResultRecord } from '../types';
import { KPI_LABELS } from '../lib/campaignLabels';

export interface WeeklyKpiBucket {
  weekKey: string;
  weekLabel: string;
  totals: Partial<Record<BusinessKpiType, number>>;
  grandTotal: number;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKey(date: Date): string {
  return startOfWeek(date).toISOString().slice(0, 10);
}

function weekLabel(date: Date): string {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('es', { day: '2-digit', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Agrega resultados KPI por semana (últimas N semanas con datos). */
export function aggregateWeeklyKpis(results: ResultRecord[], maxWeeks = 8): WeeklyKpiBucket[] {
  const buckets = new Map<string, WeeklyKpiBucket>();

  for (const result of results) {
    const created = new Date(result.createdAt);
    const key = weekKey(created);
    const bucket = buckets.get(key) || {
      weekKey: key,
      weekLabel: weekLabel(created),
      totals: {},
      grandTotal: 0,
    };
    const kpi = result.kpiType || 'custom';
    bucket.totals[kpi] = (bucket.totals[kpi] || 0) + result.metricValue;
    bucket.grandTotal += result.metricValue;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
    .slice(-maxWeeks);
}

export function primaryKpiSeries(
  buckets: WeeklyKpiBucket[],
  kpiTypes: BusinessKpiType[]
): Array<{ kpiType: BusinessKpiType; label: string; values: number[]; max: number }> {
  const max = Math.max(
    1,
    ...buckets.flatMap((bucket) => kpiTypes.map((type) => bucket.totals[type] || 0))
  );

  return kpiTypes.map((kpiType) => ({
    kpiType,
    label: KPI_LABELS[kpiType],
    values: buckets.map((bucket) => bucket.totals[kpiType] || 0),
    max,
  }));
}

export function sumKpi(results: ResultRecord[], kpiType: BusinessKpiType): number {
  return results
    .filter((result) => result.kpiType === kpiType)
    .reduce((sum, result) => sum + result.metricValue, 0);
}
