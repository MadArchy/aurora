/**
 * SPEC-010 · React ClientWorkspace (wave 3, T-010-305) — HYBRID.
 *
 * Authority: presentation + intent only.
 *
 * The legacy file is 2,562 lines rendering seven tabs from one function. This is
 * the decomposed panel tree the task asks for: one component per tab, each with
 * its own declared read source and its own command disposition.
 *
 * READ SOURCES — one per panel:
 *   canonical      (SPEC-008) signal outcomes · (SPEC-003) strategic briefs
 *   compatibility  radar signals, curation/delivery, sources, tasks
 *
 * CANONICAL COMMANDS migrated (2):
 *   - signal outcome "¿sirvió?" → `registerSignalOutcomeIntent` (SPEC-008)
 *   - approve Strategic Brief   → `approveStrategicBrief` (SPEC-003)
 * Both are canonical in the legacy controller too, so the migration changes the
 * caller and nothing else.
 *
 * BLOCKED, left legacy — the large majority. Scoring/routing runs through a
 * canonical use case but is followed by direct `dbService` writes; curation
 * decisions, delivery assembly and sending, source registration and ingestion,
 * task assignment, evidence assignment and content generation all write business
 * state with no canonical Application use case (AUDIT010-09). Brief *creation*
 * is blocked for a different reason, recorded separately: its canonical consumer
 * requires the caller to pass the whole `CurationEntry` aggregate, which would
 * give the UI snapshot authority.
 *
 * DELIBERATELY NOT REPRODUCED — the legacy radar and sources tabs call
 * `runSourceDiscoveryAgent` during render (`ClientWorkspace:1983`, `:2247`), so
 * merely opening a tab runs an agent. That is an EFFECT_FIRST path: it is not
 * migrated, and the recommendation/discovery surfaces stay legacy-only.
 */

import { useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import {
  useApproveBrief,
  useRegisterSignalOutcome,
  useSignalOutcomes,
  useStrategicBriefs,
  useWorkspaceDeliver,
  useWorkspaceRadar,
  useWorkspaceSources,
  useWorkspaceTasks,
} from '../../hooks/useWave3Data';
import { ReactKpiWeeklyChart } from '../Kpi/ReactKpiWeeklyChart';
import { ReactMasterDossierPanel } from '../MasterDossier/ReactMasterDossierPanel';
import { ReactThesisEditorPage } from './ReactThesisEditorPage';
import { LegacyHandoff, PanelState } from './LegacyHandoff';

export type WorkspaceTab =
  | 'radar'
  | 'deliver'
  | 'positioning'
  | 'sources'
  | 'tasks'
  | 'results'
  | 'briefs';

/* ------------------------------------------------------------------ *
 * Radar — compatibility read + ONE canonical command
 * ------------------------------------------------------------------ */

function RadarPanel() {
  const { tenantScope } = useSession();
  const radar = useWorkspaceRadar(tenantScope);
  const outcomes = useSignalOutcomes(tenantScope);
  const register = useRegisterSignalOutcome(tenantScope);
  const [message, setMessage] = useState<string | null>(null);

  if (radar.isLoading) {
    return <PanelState kind="loading" message="Cargando radar…" testId="react-ws-radar-loading" />;
  }
  if (radar.isError) {
    return (
      <PanelState kind="error" message="No se pudo cargar el radar." testId="react-ws-radar-error" />
    );
  }

  const data = radar.data ?? {
    signals: [],
    activeThesisCount: 0,
    canScore: false,
    totalSignals: 0,
    newSignals: 0,
  };
  const outcomeBySignal = new Map((outcomes.data ?? []).map((o) => [o.signalId, o]));

  const submit = async (
    signalId: string,
    kind: 'USEFUL' | 'NOT_USEFUL',
    thesisId: string | null
  ) => {
    const result = await register.mutateAsync({ signalId, kind, thesisId });
    setMessage(result.ok ? 'Resultado registrado.' : result.message);
  };

  return (
    <div data-testid="react-ws-radar">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-value">{data.totalSignals}</span>
          <span className="stat-label">Señales</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{data.newSignals}</span>
          <span className="stat-label">Sin revisar</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value" data-testid="react-ws-active-theses">
            {data.activeThesisCount}
          </span>
          <span className="stat-label">Tesis activas</span>
        </div>
      </div>

      {/* Mirrors the legacy rule: scoring needs any ACTIVE thesis, not a primary one. */}
      {!data.canScore ? (
        <p className="muted small" data-testid="react-ws-cannot-score">
          Sin tesis activa no se puede puntuar ninguna señal.
        </p>
      ) : null}

      {data.signals.length ? (
        <ul className="signal-list" data-testid="react-ws-signal-list">
          {data.signals.map((signal) => {
            const outcome = outcomeBySignal.get(signal.id);
            return (
              <li className="signal-card" key={signal.id}>
                <div>
                  <strong>{signal.title}</strong>
                  <p className="muted small">
                    {signal.source} · {signal.status}
                    {signal.priorityBand ? ` · ${signal.priorityBand}` : ''}
                    {signal.score !== null ? ` · score ${signal.score}` : ''}
                  </p>
                  {/* Attribution is shown only when routing decided it. */}
                  <p className="muted small">
                    {signal.routingState === 'CLEAR' && signal.thesisId
                      ? `Tesis asignada: ${signal.thesisId}`
                      : signal.routingState === 'CONTESTED'
                        ? 'Atribución en disputa — decide en la interfaz anterior'
                        : 'Sin tesis estratégica asignada'}
                  </p>
                  {signal.inCuration ? (
                    <span className="badge badge-ready">En entrega</span>
                  ) : null}
                </div>

                <div className="signal-outcome-controls">
                  {outcome ? (
                    <span className="badge badge-ready" data-testid={`react-ws-outcome-${signal.id}`}>
                      {outcome.kind === 'USEFUL' ? 'Sirvió' : 'No sirvió'}
                    </span>
                  ) : (
                    <>
                      <span className="muted small">¿Sirvió?</span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={register.isPending}
                        onClick={() => void submit(signal.id, 'USEFUL', signal.thesisId)}
                        data-testid={`react-ws-useful-${signal.id}`}
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={register.isPending}
                        onClick={() => void submit(signal.id, 'NOT_USEFUL', signal.thesisId)}
                      >
                        No
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ws-radar-empty">
          Sin señales registradas.
        </p>
      )}

      {message ? (
        <p className="muted small" role="status" data-testid="react-ws-radar-message">
          {message}
        </p>
      ) : null}

      <LegacyHandoff
        actions={[
          'puntuar señales',
          'descartarlas',
          'investigarlas',
          'añadirlas a una entrega',
          'las fuentes recomendadas',
        ]}
        testId="react-ws-radar-handoff"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Deliver — compatibility read, all commands legacy
 * ------------------------------------------------------------------ */

function DeliverPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useWorkspaceDeliver(tenantScope);

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando entregas…" testId="react-ws-deliver-loading" />;
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar las entregas."
        testId="react-ws-deliver-error"
      />
    );
  }

  const deliver = data ?? { pending: [], ready: 0, draftItems: 0, sentDeliveries: [] };

  return (
    <div data-testid="react-ws-deliver">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-value">{deliver.pending.length}</span>
          <span className="stat-label">Por decidir</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{deliver.ready}</span>
          <span className="stat-label">Listas</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{deliver.draftItems}</span>
          <span className="stat-label">En el briefing</span>
        </div>
      </div>

      {deliver.pending.length ? (
        <ul className="curation-list" data-testid="react-ws-curation-list">
          {deliver.pending.map((entry) => (
            <li className="curation-row" key={entry.id}>
              <div>
                <strong>{entry.signalTitle}</strong>
                <p className="muted small">
                  Etapa {entry.stage}
                  {entry.destination ? ` · destino ${entry.destination}` : ' · sin destino'}
                  {entry.strategicBriefId ? ' · con Brief' : ''}
                </p>
                {entry.rationale ? <p className="small">{entry.rationale}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ws-curation-empty">
          Nada pendiente de decidir.
        </p>
      )}

      {deliver.sentDeliveries.length ? (
        <details data-testid="react-ws-sent-list">
          <summary className="small">Enviadas ({deliver.sentDeliveries.length})</summary>
          <ul className="delivery-list">
            {deliver.sentDeliveries.map((pkg) => (
              <li key={pkg.id}>
                {pkg.title || 'Sin título'} · {pkg.itemCount} elementos · {pkg.status}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <LegacyHandoff
        actions={[
          'decidir el destino',
          'proponer ángulo',
          'crear el Strategic Brief',
          'montar y enviar el briefing',
        ]}
        testId="react-ws-deliver-handoff"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Briefs — canonical read + ONE canonical command
 * ------------------------------------------------------------------ */

function BriefsPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useStrategicBriefs(tenantScope);
  const approve = useApproveBrief(tenantScope);
  const [message, setMessage] = useState<string | null>(null);

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando briefs…" testId="react-ws-briefs-loading" />;
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar los briefs."
        testId="react-ws-briefs-error"
      />
    );
  }

  const briefs = data ?? [];

  return (
    <div data-testid="react-ws-briefs">
      {briefs.length ? (
        <ul className="brief-list" data-testid="react-ws-brief-list">
          {briefs.map((brief) => (
            <li className="brief-row" key={brief.id}>
              <div>
                <strong>{brief.strategicAngle}</strong>
                <p className="muted small">
                  v{brief.version} · {brief.status}
                  {brief.authorizedAction ? ` · autoriza ${brief.authorizedAction}` : ''}
                  {brief.superseded ? ' · superado' : ''}
                </p>
                <p className="muted small">
                  {brief.territory} · {brief.primaryAudience}
                </p>
              </div>
              {/*
                Enabled from the canonical projection's own status. SPEC-003
                re-validates and may still refuse; nothing is marked approved here.
              */}
              {brief.status === 'DRAFT' && !brief.superseded ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={approve.isPending}
                  onClick={() =>
                    void approve
                      .mutateAsync({ briefId: brief.id })
                      .then((result) => setMessage(result.ok ? 'Brief aprobado.' : result.message))
                  }
                  data-testid={`react-ws-approve-brief-${brief.id}`}
                >
                  Aprobar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ws-briefs-empty">
          Sin Strategic Briefs registrados.
        </p>
      )}

      {message ? (
        <p className="muted small" role="status" data-testid="react-ws-briefs-message">
          {message}
        </p>
      ) : null}

      <LegacyHandoff
        actions={['crear un Strategic Brief desde un ítem curado']}
        testId="react-ws-briefs-handoff"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sources — compatibility read, all commands legacy
 * ------------------------------------------------------------------ */

function SourcesPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useWorkspaceSources(tenantScope);

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando fuentes…" testId="react-ws-sources-loading" />;
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar las fuentes."
        testId="react-ws-sources-error"
      />
    );
  }

  const sources = data ?? { sources: [], errors: 0, degraded: 0, paused: 0 };

  return (
    <div data-testid="react-ws-sources">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-value">{sources.sources.length}</span>
          <span className="stat-label">Fuentes</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{sources.errors}</span>
          <span className="stat-label">Con error</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{sources.degraded}</span>
          <span className="stat-label">Degradadas</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{sources.paused}</span>
          <span className="stat-label">Pausadas</span>
        </div>
      </div>

      {sources.sources.length ? (
        <ul className="source-list" data-testid="react-ws-source-list">
          {sources.sources.map((source) => (
            <li className="source-row" key={source.id}>
              <div>
                <strong>{source.name}</strong>
                <p className="muted small">
                  {source.type}
                  {source.url ? ` · ${source.url}` : ''}
                </p>
              </div>
              <span
                className={`badge ${source.healthStatus === 'ERROR' ? 'badge-pending' : 'badge-ready'}`}
              >
                {source.healthLabel}
                {source.acceptRate !== null ? ` · ${Math.round(source.acceptRate * 100)}%` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ws-sources-empty">
          Sin fuentes registradas.
        </p>
      )}

      <LegacyHandoff
        actions={[
          'registrar fuentes',
          'ingerirlas',
          'pausarlas o archivarlas',
          'el descubrimiento automático',
        ]}
        testId="react-ws-sources-handoff"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tasks — compatibility read, all commands legacy
 * ------------------------------------------------------------------ */

function TasksPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useWorkspaceTasks(tenantScope);

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando tareas…" testId="react-ws-tasks-loading" />;
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar las tareas."
        testId="react-ws-tasks-error"
      />
    );
  }

  const tasks = data ?? [];
  const active = tasks.filter((task) => !task.archived);
  const archived = tasks.filter((task) => task.archived);

  return (
    <div data-testid="react-ws-tasks">
      {active.length ? (
        <ul className="task-list" data-testid="react-ws-task-list">
          {active.map((task) => (
            <li className="task-row" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <p className="muted small">
                  {task.type}
                  {task.deadline ? ` · vence ${task.deadline}` : ''}
                  {task.thesisId ? ` · tesis ${task.thesisId}` : ''}
                </p>
              </div>
              <span className="badge badge-progress">{task.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ws-tasks-empty">
          Sin tareas activas.
        </p>
      )}

      {archived.length ? (
        <details data-testid="react-ws-tasks-archived">
          <summary className="small">Cerradas ({archived.length})</summary>
          <ul className="task-list">
            {archived.map((task) => (
              <li key={task.id}>
                {task.title} · {task.status}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <LegacyHandoff
        actions={['asignar tareas', 'cancelarlas', 'gestionar grabaciones']}
        testId="react-ws-tasks-handoff"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export function ReactClientWorkspacePage({ tab = 'radar' }: { tab?: WorkspaceTab }) {
  const { tenantScope, isAdmin } = useSession();

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización — no se muestra el workspace."
        testId="react-ws-no-scope"
      />
    );
  }

  // Visibility only, from the trusted session. This view never asserts a role.
  if (!isAdmin) {
    return (
      <PanelState kind="empty" message="Esta vista es para managers." testId="react-ws-not-admin" />
    );
  }

  return (
    <div className="page-content" data-testid="react-client-workspace" data-workspace-tab={tab}>
      {tab === 'radar' ? <RadarPanel /> : null}
      {tab === 'deliver' ? <DeliverPanel /> : null}
      {tab === 'briefs' ? <BriefsPanel /> : null}
      {tab === 'sources' ? <SourcesPanel /> : null}
      {tab === 'tasks' ? <TasksPanel /> : null}
      {tab === 'results' ? <ReactKpiWeeklyChart title="Resultados registrados" /> : null}
      {tab === 'positioning' ? (
        <>
          <ReactThesisEditorPage />
          <ReactMasterDossierPanel />
        </>
      ) : null}
    </div>
  );
}
