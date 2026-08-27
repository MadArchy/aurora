/**
 * SPEC-010 · React KpiWeeklyChart (wave 2, T-010-203).
 *
 * Authority: presentation and intent only.
 *
 * READ SOURCE: compatibility (`readKpiWeekly`). The weekly aggregation is done
 * by `domain/kpiWeekly` inside the facade, so this component receives finished
 * numbers and only draws bars — no KPI is summed, bucketed or ranked here
 * (threat T-010-19).
 *
 * COMMAND: registering a received consultation → CANONICAL_CONSUMER
 * (`registerResultRecordIntent`, SPEC-008), the same consumer the legacy quick
 * form calls. The consumer resolves trusted context itself and ignores any
 * caller-supplied actor.
 *
 * The counter is never incremented locally on submit: the command runs, the
 * compatibility cache is invalidated and the new total is re-read. A number on
 * screen therefore always reflects recorded state (threat T-010-06).
 */

import { useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import { useKpiWeekly, useRegisterConsultation } from '../../hooks/useWave2Data';

export function ReactKpiWeeklyChart({ title = 'KPIs semanales' }: { title?: string }) {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useKpiWeekly(tenantScope);
  const register = useRegisterConsultation(tenantScope);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (!tenantScope) {
    return (
      <section className="card" data-testid="react-kpi-no-scope">
        <p className="muted">Sesión sin contexto de organización — no se muestran KPIs.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="card" data-testid="react-kpi-loading">
        <p className="muted">Cargando KPIs…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="card" role="alert" data-testid="react-kpi-error">
        <p className="muted">No se pudieron cargar los KPIs.</p>
      </section>
    );
  }

  const kpi = data ?? {
    weekLabels: [],
    series: [],
    tiles: [],
    consultationsThisWeek: 0,
  };

  return (
    <section className="card kpi-chart-card" data-testid="react-kpi-panel">
      <div className="card-header">
        <div>
          <h3>{title}</h3>
          <p className="muted small">
            Esta semana llevas <strong data-testid="react-kpi-week-count">{kpi.consultationsThisWeek}</strong>{' '}
            consulta(s) registrada(s).
          </p>
        </div>
      </div>

      <div className="stat-grid">
        {kpi.tiles.map((tile) => (
          <div className="stat-tile" key={tile.label}>
            <div className="stat-tile-head">
              <span>{tile.label}</span>
            </div>
            <p className="stat-tile-value">{tile.value}</p>
            <p className="stat-tile-hint">Acumulado registrado</p>
          </div>
        ))}
      </div>

      {kpi.weekLabels.length ? (
        <>
          <div className="kpi-chart-legend">
            {kpi.series.map((s) => (
              <span className="kpi-legend-item" key={s.kpiType} data-kpi={s.kpiType}>
                {s.label}
              </span>
            ))}
          </div>

          <div className="kpi-chart-grid" role="img" aria-label="Gráfico semanal de KPIs">
            {kpi.weekLabels.map((weekLabel, bucketIndex) => (
              <div className="kpi-chart-column" key={weekLabel + bucketIndex}>
                <div className="kpi-chart-bars">
                  {kpi.series.map((s, index) => {
                    const value = s.values[bucketIndex] || 0;
                    const height = Math.max(4, Math.round((value / s.max) * 100));
                    return (
                      <div
                        className={`kpi-bar kpi-bar-${index}`}
                        key={s.kpiType}
                        style={{ height: `${height}%` }}
                        title={`${s.label}: ${value}`}
                      />
                    );
                  })}
                </div>
                <span className="kpi-chart-label">{weekLabel}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="empty-state" data-testid="react-kpi-empty">
          Sin datos KPI todavía.
        </p>
      )}

      <form
        className="kpi-quick-form"
        data-testid="react-kpi-form"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          register.mutate(note, {
            onSuccess: (result) => {
              setMessage(result.ok ? 'Consulta registrada.' : result.message);
              if (result.ok) setNote('');
            },
          });
        }}
      >
        <p className="form-label">Registrar consulta recibida (+1)</p>
        <div className="kpi-quick-row">
          <input
            className="form-input"
            value={note}
            placeholder="Ej. evaluación IA, estrategia patentes…"
            aria-label="Nota de la consulta"
            data-testid="react-kpi-note"
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={register.isPending}
            data-testid="react-kpi-submit"
          >
            Registrar consulta
          </button>
        </div>
        {message ? (
          <p className="muted small" role="status" data-testid="react-kpi-message">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
