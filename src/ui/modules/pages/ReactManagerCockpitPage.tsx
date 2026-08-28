/**
 * SPEC-010 · React ManagerCockpit (wave 3, T-010-303) — READ_ONLY_REACT.
 *
 * Authority: presentation only.
 *
 * READ SOURCE: compatibility (`readPortfolioOverview`, `readAiCenter`).
 *
 * COMMAND: none. Every mutating action of the legacy cockpit is blocked:
 *   - "+ Nuevo cliente"            → legacy modal → `clientLifecycleCommands` /
 *                                     `createClientWithInvite` (CR-1 Client Lifecycle)
 *   - "Subir local → Firestore"    → bulk Firestore write (`pushCurrentLocalToFirestore`)
 *   - "Ver como cliente"           → `authService.impersonateClient`, a session
 *                                     mutation owned by SPEC-009
 *   - "Redactar paper" / pipeline  → canonical gate followed by `dbService` writes
 * None has a canonical Application use case for its write, so all stay legacy
 * and are named in the handoff notice. Entering a client's workspace is
 * navigation plus an audit entry, which belongs to the legacy controller that
 * owns navigation, so it is exposed here as an intent the host may honour.
 *
 * Two legacy behaviours are deliberately not reproduced:
 *   - the directory row shows `getActiveTheses(id)[0]` and silently hides any
 *     other active thesis. This view shows the count and every title, so a
 *     multi-thesis client cannot look single-thesis (threat T-010-15).
 *   - the panel probes `aiService.isServerGatewayAvailable()` during render. A
 *     read must not make service calls with side-effect potential, so the
 *     gateway strip stays legacy-only and this view reports quota and history.
 */

import { useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import { useAiCenter, usePortfolioOverview } from '../../hooks/useWave3Data';
import { LegacyHandoff, PanelState } from './LegacyHandoff';

type CockpitTab = 'portfolio' | 'clients' | 'ai';

function PortfolioPanel({ onEnterClient }: { onEnterClient?: (clientId: string) => void }) {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = usePortfolioOverview(tenantScope);
  const [search, setSearch] = useState('');

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando cartera…" testId="react-cockpit-loading" />;
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar la cartera."
        testId="react-cockpit-error"
      />
    );
  }

  const overview = data ?? {
    rows: [],
    totalClients: 0,
    needingAttention: 0,
    totalActiveTheses: 0,
  };

  const term = search.trim().toLowerCase();
  const rows = term
    ? overview.rows.filter((row) =>
        `${row.displayName} ${row.profession} ${row.company}`.toLowerCase().includes(term)
      )
    : overview.rows;

  const queue = [...rows].sort((a, b) => b.attentionScore - a.attentionScore);

  return (
    <div data-testid="react-cockpit-portfolio">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-value">{overview.totalClients}</span>
          <span className="stat-label">Clientes</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value" data-testid="react-cockpit-attention">
            {overview.needingAttention}
          </span>
          <span className="stat-label">Requieren atención</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value" data-testid="react-cockpit-theses">
            {overview.totalActiveTheses}
          </span>
          <span className="stat-label">Tesis activas</span>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="react-cockpit-search">
          Buscar cliente
        </label>
        <input
          id="react-cockpit-search"
          type="search"
          className="form-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          data-testid="react-cockpit-search"
        />
      </div>

      {queue.length ? (
        <ul className="portfolio-queue" data-testid="react-cockpit-queue">
          {queue.map((row) => (
            <li className="portfolio-queue-row" key={row.clientId}>
              <div>
                <strong>{row.displayName}</strong>
                <p className="muted small">
                  {row.profession}
                  {row.company ? ` · ${row.company}` : ''}
                </p>
                {/* Every active thesis title, not just the first one. */}
                <p className="muted small" data-testid={`react-cockpit-theses-${row.clientId}`}>
                  {row.activeThesisCount === 0
                    ? 'Sin tesis activa'
                    : `${row.activeThesisCount} ${
                        row.activeThesisCount === 1 ? 'tesis activa' : 'tesis activas'
                      }: ${row.activeThesisTitles.join(' · ')}`}
                </p>
                {row.attentionReasons.length ? (
                  <ul className="small">
                    {row.attentionReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="portfolio-queue-meta">
                <span className={`badge ${row.attentionScore > 0 ? 'badge-pending' : 'badge-ready'}`}>
                  Atención {row.attentionScore}
                </span>
                <p className="muted small">
                  {row.unreviewedSignals} señales nuevas · {row.pendingCuration} por decidir
                </p>
                {onEnterClient ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onEnterClient(row.clientId)}
                  >
                    Abrir workspace
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-cockpit-empty">
          Ningún cliente coincide con la búsqueda.
        </p>
      )}
    </div>
  );
}

function AiCenterPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useAiCenter(tenantScope);

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando consumo…" testId="react-ai-center-loading" />;
  }
  if (isError || !data) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar el consumo de IA."
        testId="react-ai-center-error"
      />
    );
  }

  return (
    <div data-testid="react-ai-center">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-value">{data.tier}</span>
          <span className="stat-label">Plan · {data.status}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{data.aiRunsUsed}</span>
          <span className="stat-label">Ejecuciones este mes</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{data.tokensUsed}</span>
          <span className="stat-label">Tokens</span>
        </div>
      </div>

      {data.runs.length ? (
        <ul className="ai-run-list small" data-testid="react-ai-runs">
          {data.runs.map((run) => (
            <li key={run.id}>
              <span className={`badge ${run.ok ? 'badge-ready' : 'badge-pending'}`}>
                {run.status}
              </span>{' '}
              {run.agent} · {run.provider}/{run.modelName} · {run.createdAt}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ai-runs-empty">
          Sin ejecuciones registradas.
        </p>
      )}

      <p className="muted small">
        El estado del gateway se consulta en la interfaz anterior: esta vista no hace llamadas a
        servicios durante el render.
      </p>
    </div>
  );
}

export function ReactManagerCockpitPage({
  onEnterClient,
}: {
  onEnterClient?: (clientId: string) => void;
}) {
  const { tenantScope, isAdmin } = useSession();
  const [tab, setTab] = useState<CockpitTab>('portfolio');

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización — no se muestra la cartera."
        testId="react-cockpit-no-scope"
      />
    );
  }

  // Visibility only. The trusted session decides the role; this view never sets it.
  if (!isAdmin) {
    return (
      <PanelState
        kind="empty"
        message="Esta vista es para managers."
        testId="react-cockpit-not-admin"
      />
    );
  }

  return (
    <section
      className="card cockpit-card"
      data-testid="react-manager-cockpit"
      data-authority="READ_ONLY"
    >
      <div className="card-header">
        <div>
          <h3>Cartera</h3>
          <p className="muted small">Lectura de cartera, directorio y consumo de IA.</p>
        </div>
        <div className="tab-pills" role="tablist" aria-label="Secciones de cartera">
          {(
            [
              ['portfolio', 'Hoy'],
              ['clients', 'Clientes'],
              ['ai', 'IA'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={`btn btn-sm ${tab === value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'ai' ? <AiCenterPanel /> : <PortfolioPanel onEnterClient={onEnterClient} />}

      <LegacyHandoff
        actions={[
          'crear un cliente',
          'invitarlo',
          'ver la app como cliente',
          'subir datos a Firestore',
          'generar contenido y mover el pipeline',
        ]}
        testId="react-cockpit-handoff"
      />
    </section>
  );
}
