import { dbService } from '../services/db';
import { esc } from '../lib/escape';
import { aggregateWeeklyKpis, primaryKpiSeries, sumKpi } from '../domain/kpiWeekly';
import { kpiLabel } from '../lib/campaignLabels';
import type { BusinessKpiType } from '../types';

const CHART_KPIS: BusinessKpiType[] = [
  'consultation_requests',
  'linkedin_profile_views',
  'website_visits_from_linkedin',
];

export function renderKpiWeeklyChart(clientId: string, title = 'KPIs semanales'): string {
  const results = dbService.getResultsByClient(clientId).filter((result) => result.kpiType);
  const buckets = aggregateWeeklyKpis(results, 8);

  if (!buckets.length) {
    return `
      <section class="card">
        <div class="card-header">
          <div>
            <h3>${esc(title)}</h3>
            <p class="muted small">Registra resultados con tipo KPI §11.3 para ver la tendencia.</p>
          </div>
        </div>
        <p class="empty-state">Sin datos KPI todavía.</p>
      </section>
    `;
  }

  const series = primaryKpiSeries(buckets, CHART_KPIS);

  return `
    <section class="card kpi-chart-card">
      <div class="card-header">
        <div>
          <h3>${esc(title)}</h3>
          <p class="muted small">Consultas, visitas LinkedIn y tráfico web — últimas ${buckets.length} semanas.</p>
        </div>
      </div>

      <div class="kpi-chart-legend">
        ${series.map((s) => `<span class="kpi-legend-item" data-kpi="${esc(s.kpiType)}">${esc(s.label)}</span>`).join('')}
      </div>

      <div class="kpi-chart-grid" role="img" aria-label="Gráfico semanal de KPIs">
        ${buckets.map((bucket, bucketIndex) => `
          <div class="kpi-chart-column">
            <div class="kpi-chart-bars">
              ${series.map((s, index) => {
                const value = s.values[bucketIndex] || 0;
                const height = Math.max(4, Math.round((value / s.max) * 100));
                return `<div class="kpi-bar kpi-bar-${index}" style="height:${height}%" title="${esc(s.label)}: ${value}"></div>`;
              }).join('')}
            </div>
            <span class="kpi-chart-label">${esc(bucket.weekLabel.split(' – ')[0])}</span>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

export function renderKpiSummaryTiles(clientId: string): string {
  const results = dbService.getResultsByClient(clientId);
  const consultations = sumKpi(results, 'consultation_requests');
  const liViews = sumKpi(results, 'linkedin_profile_views');
  const webVisits = sumKpi(results, 'website_visits_from_linkedin');

  return `
    <div class="stat-grid">
      <div class="stat-tile">
        <div class="stat-tile-head"><span>${esc(kpiLabel('consultation_requests'))}</span></div>
        <p class="stat-tile-value stat-tile-accent">${consultations}</p>
        <p class="stat-tile-hint">Acumulado registrado</p>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-head"><span>${esc(kpiLabel('linkedin_profile_views'))}</span></div>
        <p class="stat-tile-value">${liViews}</p>
        <p class="stat-tile-hint">Acumulado registrado</p>
      </div>
      <div class="stat-tile">
        <div class="stat-tile-head"><span>${esc(kpiLabel('website_visits_from_linkedin'))}</span></div>
        <p class="stat-tile-value">${webVisits}</p>
        <p class="stat-tile-hint">Acumulado registrado</p>
      </div>
    </div>
  `;
}
