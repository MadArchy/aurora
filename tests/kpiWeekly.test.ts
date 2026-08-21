import { describe, expect, it } from 'vitest';
import { aggregateWeeklyKpis, primaryKpiSeries, sumKpi, sumKpiThisWeek } from '../src/domain/kpiWeekly';
import type { ResultRecord } from '../src/types';

function result(overrides: Partial<ResultRecord> = {}): ResultRecord {
  return {
    id: 'res_1',
    organizationId: 'org_1',
    clientId: 'client_1',
    title: 'Vistas LinkedIn',
    channel: 'LinkedIn',
    metricLabel: 'Vistas',
    metricValue: 100,
    kpiType: 'linkedin_profile_views',
    addedToEvidence: false,
    createdAt: '2026-08-18T09:00:00Z',
    createdBy: 'user_1',
    ...overrides,
  };
}

describe('kpiWeekly', () => {
  it('aggregates metrics into weekly buckets sorted chronologically', () => {
    const buckets = aggregateWeeklyKpis([
      result({ id: 'a', metricValue: 620, createdAt: '2026-08-04T09:00:00Z' }),
      result({ id: 'b', metricValue: 710, createdAt: '2026-08-11T09:00:00Z' }),
      result({ id: 'c', metricValue: 842, createdAt: '2026-08-18T09:00:00Z' }),
    ]);

    expect(buckets).toHaveLength(3);
    expect(buckets[0].totals.linkedin_profile_views).toBe(620);
    expect(buckets[2].totals.linkedin_profile_views).toBe(842);
  });

  it('builds aligned series for chart rendering', () => {
    const buckets = aggregateWeeklyKpis([
      result({ metricValue: 50, kpiType: 'consultation_requests', createdAt: '2026-08-11T09:00:00Z' }),
      result({ metricValue: 842, kpiType: 'linkedin_profile_views', createdAt: '2026-08-18T09:00:00Z' }),
    ]);
    const series = primaryKpiSeries(buckets, ['consultation_requests', 'linkedin_profile_views']);

    expect(series).toHaveLength(2);
    expect(series[0].values).toEqual([50, 0]);
    expect(series[1].values).toEqual([0, 842]);
    expect(series[1].max).toBeGreaterThanOrEqual(842);
  });

  it('sums KPI totals across all records', () => {
    const total = sumKpi(
      [
        result({ metricValue: 620, kpiType: 'linkedin_profile_views' }),
        result({ id: 'x', metricValue: 222, kpiType: 'linkedin_profile_views' }),
        result({ id: 'y', metricValue: 3, kpiType: 'consultation_requests' }),
      ],
      'linkedin_profile_views'
    );
    expect(total).toBe(842);
  });

  it('sums KPI for current week only', () => {
    const weekTotal = sumKpiThisWeek(
      [
        result({ metricValue: 1, kpiType: 'consultation_requests', createdAt: '2026-08-20T11:00:00Z' }),
        result({ id: 'old', metricValue: 5, kpiType: 'consultation_requests', createdAt: '2026-08-04T09:00:00Z' }),
      ],
      'consultation_requests',
      new Date('2026-08-20T12:00:00Z')
    );
    expect(weekTotal).toBe(1);
  });
});
