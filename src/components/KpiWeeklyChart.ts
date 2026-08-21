import { dbService } from '../services/db';
import { esc } from '../lib/escape';
import { icon } from '../lib/icons';
import { aggregateWeeklyKpis, primaryKpiSeries, sumKpi, sumKpiThisWeek } from '../domain/kpiWeekly';
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
  const weekConsultations = sumKpiThisWeek(results, 'consultation_requests');

  return `
    <div class="stat-grid">
      <div class="stat-tile">
        <div class="stat-tile-head"><span>${esc(kpiLabel('consultation_requests'))}</span></div>
        <p class="stat-tile-value stat-tile-accent">${consultations}</p>
        <p class="stat-tile-hint">${weekConsultations} esta semana · acumulado</p>
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

/** Dashboard semanal en home: tiles, gráfico y registro rápido de consultas. */
export function renderKpiHomeDashboard(clientId: string): string {
  const results = dbService.getResultsByClient(clientId);
  const weekConsultations = sumKpiThisWeek(results, 'consultation_requests');

  return `
    <section class="card kpi-home-dashboard">
      <div class="card-header">
        <div>
          <h3>${icon('chart', 16)} Dashboard semanal</h3>
          <p class="muted small">
            Esta semana llevas <strong>${weekConsultations}</strong> consulta(s) registrada(s).
            El gráfico se actualiza al instante.
          </p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-tab="client-results">Ver detalle</button>
      </div>
      ${renderKpiSummaryTiles(clientId)}
      ${renderKpiWeeklyChart(clientId, 'Tendencia semanal')}
      <form id="form-quick-kpi-consultation" class="kpi-quick-form" data-client-id="${esc(clientId)}">
        <p class="form-label">Registrar consulta recibida (+1)</p>
        <div class="kpi-quick-row" style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
          <input
            class="form-input"
            id="quick-kpi-note"
            placeholder="Ej. evaluación IA, estrategia patentes…"
            style="flex:1; min-width:200px;"
          />
          <button type="submit" class="btn btn-primary btn-sm">Registrar consulta</button>
        </div>
      </form>
    </section>
  `;
}
