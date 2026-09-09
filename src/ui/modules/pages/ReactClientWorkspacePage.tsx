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
 * CANONICAL COMMANDS migrated:
 *   - signal outcome "¿sirvió?" → `registerSignalOutcomeIntent` (SPEC-008)
 *   - approve Strategic Brief   → `approveStrategicBrief` (SPEC-003)
 *   - #18 send delivery package → `SendDeliveryPackage` (P7)
 *   - #27 assign/cancel task    → `AssignClientTask` / `CancelClientTask` (P8 MANUAL)
 * Outcome/brief/#18/#27 change the caller only. #14–#17 assembly, #33 composite
 * recommendation→task path, and recordings remain legacy.
 *
 * BLOCKED, left legacy — the large majority. Scoring/routing runs through a
 * canonical use case but is followed by direct `dbService` writes; curation
 * decisions, delivery *assembly* (not send), source registration and ingestion,
 * #33 recommendation→task composite, evidence assignment and content generation
 * all write business state with no React parity yet (AUDIT010-09). Brief *creation*
 * is blocked for a different reason, recorded separately: its canonical consumer
 * requires the caller to pass the whole `CurationEntry` aggregate, which would
 * give the UI snapshot authority.
 *
 * DELIBERATELY NOT REPRODUCED — the legacy radar and sources tabs call
 * `runSourceDiscoveryAgent` during render (`ClientWorkspace:1983`, `:2247`), so
 * merely opening a tab runs an agent. That is an EFFECT_FIRST path: it is not
 * migrated, and the recommendation/discovery surfaces stay legacy-only.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useSession } from '../../providers/SessionProvider';
import { narrowToClient } from '../../query/tenantScope';
import {
  useApproveBrief,
  useAssignClientTaskManual,
  useCancelClientTask,
  useRegisterSignalOutcome,
  useSignalOutcomes,
  useStrategicBriefs,
  useWorkspaceDeliver,
  useWorkspaceRadar,
  useWorkspaceSources,
  useWorkspaceTasks,
} from '../../hooks/useWave3Data';
import type { TaskType } from '../../../types';
import { ReactKpiWeeklyChart } from '../Kpi/ReactKpiWeeklyChart';
import { ReactMasterDossierPanel } from '../MasterDossier/ReactMasterDossierPanel';
import { ReactThesisEditorPage } from './ReactThesisEditorPage';
import { ReactDeliveryPreviewModal } from './modals/ReactModals';
import { LegacyHandoff, PanelState } from './LegacyHandoff';

export type WorkspaceTab =
  | 'radar'
  | 'deliver'
  | 'positioning'
  | 'sources'
  | 'tasks'
  | 'results'
  | 'briefs';

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'RECORD_VIDEO', label: 'Grabar video' },
  { value: 'REVIEW_ARTICLE', label: 'Revisar artículo' },
  { value: 'APPROVE_OPPORTUNITY', label: 'Aprobar oportunidad' },
  { value: 'SUBMIT_INFO', label: 'Enviar información' },
];
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
 * Deliver — #18 send native (P7); #14–#17 assembly remains legacy
 * ------------------------------------------------------------------ */

function DeliverPanel({ workspaceClientId = null }: { workspaceClientId?: string | null }) {
  const { tenantScope } = useSession();
  const scope = useMemo(() => {
    if (!tenantScope) return null;
    if (tenantScope.clientId) return tenantScope;
    const requested = workspaceClientId?.trim();
    if (!requested || requested === 'all') return null;
    try {
      return narrowToClient(tenantScope, requested);
    } catch {
      return null;
    }
  }, [tenantScope, workspaceClientId]);
  const { data, isLoading, isError } = useWorkspaceDeliver(scope);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!scope) {
    return (
      <PanelState
        kind="no-scope"
        message="Selecciona un cliente en el workspace para ver entregas."
        testId="react-ws-deliver-no-client"
      />
    );
  }

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

  const deliver = data ?? {
    pending: [],
    ready: 0,
    draftItems: 0,
    draftPackage: null,
    sentDeliveries: [],
  };

  if (previewOpen && deliver.draftPackage) {
    return (
      <ReactDeliveryPreviewModal
        packageId={deliver.draftPackage.id}
        workspaceClientId={workspaceClientId}
        onClose={() => setPreviewOpen(false)}
        onSent={(message) => {
          setPreviewOpen(false);
          setStatusMessage({ kind: 'success', text: message });
        }}
      />
    );
  }

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

      {deliver.draftPackage ? (
        <div className="card" data-testid="react-ws-draft-package" data-authority="PRESENTATION">
          <p className="small">
            <strong>{deliver.draftPackage.title || 'Briefing en borrador'}</strong>
            {' · '}
            {deliver.draftPackage.itemCount} elementos · {deliver.draftPackage.status}
          </p>
          <ul className="muted small" data-testid="react-ws-draft-items">
            {deliver.draftPackage.itemTitles.map((title, index) => (
              <li key={`${index}-${title}`}>{title}</li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="react-ws-deliver-preview-send"
            onClick={() => {
              setStatusMessage(null);
              setPreviewOpen(true);
            }}
          >
            Vista previa y enviar
          </button>
        </div>
      ) : (
        <p className="muted small" data-testid="react-ws-draft-empty">
          No hay briefing en borrador listo para enviar.
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

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'error' ? 'form-error' : 'form-success'}
          role="status"
          data-testid={
            statusMessage.kind === 'error' ? 'react-ws-deliver-error-msg' : 'react-ws-deliver-success'
          }
        >
          {statusMessage.text}
        </p>
      ) : null}

      <LegacyHandoff
        actions={[
          'decidir el destino',
          'proponer ángulo',
          'crear el Strategic Brief',
          'montar el briefing',
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
 * Tasks — #27 MANUAL assign + cancel native (P8); recordings remain legacy
 * ------------------------------------------------------------------ */

function TasksPanel({ workspaceClientId = null }: { workspaceClientId?: string | null }) {
  const { tenantScope } = useSession();
  const scope = useMemo(() => {
    if (!tenantScope) return null;
    if (tenantScope.clientId) return tenantScope;
    const requested = workspaceClientId?.trim();
    if (!requested || requested === 'all') return null;
    try {
      return narrowToClient(tenantScope, requested);
    } catch {
      return null;
    }
  }, [tenantScope, workspaceClientId]);

  const { data, isLoading, isError } = useWorkspaceTasks(scope);
  const assign = useAssignClientTaskManual(scope);
  const cancel = useCancelClientTask(scope);
  const [showForm, setShowForm] = useState(false);
  const [thesisId, setThesisId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('RECORD_VIDEO');
  const [minutes, setMinutes] = useState('15');
  const [deadline, setDeadline] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!scope) {
    return (
      <PanelState
        kind="empty"
        message="Selecciona un cliente del workspace para gestionar tareas."
        testId="react-ws-tasks-no-client"
      />
    );
  }

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

  const tasks = data?.tasks ?? [];
  const activeTheses = data?.activeTheses ?? [];
  const active = tasks.filter((task) => !task.archived);
  const archived = tasks.filter((task) => task.archived);
  const busy = assign.isPending || cancel.isPending;

  const resetForm = () => {
    setThesisId('');
    setTitle('');
    setDescription('');
    setType('RECORD_VIDEO');
    setMinutes('15');
    setDeadline('');
    setShowForm(false);
  };

  const onAssign = async (event: FormEvent) => {
    event.preventDefault();
    if (!thesisId.trim()) {
      setStatusMessage({ kind: 'error', text: 'Selecciona una tesis ACTIVE para la tarea.' });
      return;
    }
    const estimatedMinutes = parseInt(minutes || '15', 10);
    const result = await assign.mutateAsync({
      thesisId: thesisId.trim(),
      type,
      title: title.trim(),
      description: description.trim(),
      estimatedMinutes,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
    });
    if (result.ok) {
      setStatusMessage({ kind: 'success', text: result.message });
      resetForm();
    } else {
      setStatusMessage({ kind: 'error', text: result.message });
    }
  };

  const onCancel = async (taskId: string) => {
    if (!confirm('¿Cancelar esta tarea? El cliente dejará de verla como pendiente.')) return;
    const result = await cancel.mutateAsync({ taskId });
    if (result.ok) {
      setStatusMessage({ kind: 'success', text: result.message });
    } else {
      setStatusMessage({ kind: 'error', text: result.message });
    }
  };

  return (
    <div data-testid="react-ws-tasks">
      <div className="onboarding-footer" style={{ justifyContent: 'flex-start', marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="react-ws-tasks-open-assign"
          disabled={busy}
          onClick={() => setShowForm((open) => !open)}
        >
          {showForm ? 'Cerrar formulario' : '+ Asignar tarea'}
        </button>
      </div>

      {showForm ? (
        <form
          className="card"
          data-testid="react-ws-tasks-assign-form"
          onSubmit={(e) => void onAssign(e)}
          style={{ marginBottom: '1rem', padding: '1rem' }}
        >
          <h3>Asignar tarea al cliente</h3>
          <p className="muted small">El cliente verá esta tarea en su portal de inmediato.</p>

          <div className="form-group">
            <label className="form-label" htmlFor="react-task-thesis">
              Tesis (explícita)
            </label>
            <select
              id="react-task-thesis"
              className="form-input"
              required
              value={thesisId}
              onChange={(e) => setThesisId(e.target.value)}
              data-testid="react-ws-tasks-thesis"
              disabled={busy}
            >
              <option value="">Selecciona una tesis ACTIVE…</option>
              {activeTheses.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-task-title">
              Título
            </label>
            <input
              id="react-task-title"
              className="form-input"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="react-ws-tasks-title"
              disabled={busy}
              placeholder="Ej. Grabar video sobre el nuevo marco regulatorio de IA"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-task-description">
              Instrucciones para el cliente
            </label>
            <textarea
              id="react-task-description"
              className="form-textarea"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="react-ws-tasks-description"
              disabled={busy}
              placeholder="Qué debe hacer y con qué enfoque."
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="react-task-type">
                Tipo de tarea
              </label>
              <select
                id="react-task-type"
                className="form-select"
                value={type}
                onChange={(e) => setType(e.target.value as TaskType)}
                data-testid="react-ws-tasks-type"
                disabled={busy}
              >
                {TASK_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="react-task-minutes">
                Tiempo estimado (min)
              </label>
              <input
                id="react-task-minutes"
                type="number"
                className="form-input"
                min={5}
                max={480}
                required
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                data-testid="react-ws-tasks-minutes"
                disabled={busy}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-task-deadline">
              Fecha límite (opcional)
            </label>
            <input
              id="react-task-deadline"
              type="date"
              className="form-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              data-testid="react-ws-tasks-deadline"
              disabled={busy}
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={resetForm}
              data-testid="react-ws-tasks-assign-cancel"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy}
              data-testid="react-ws-tasks-assign-submit"
            >
              {assign.isPending ? 'Asignando…' : 'Asignar al cliente'}
            </button>
          </div>
        </form>
      ) : null}

      {active.length ? (
        <ul className="task-list" data-testid="react-ws-task-list">
          {active.map((task) => (
            <li className="task-row" key={task.id} data-testid={`react-ws-task-row-${task.id}`}>
              <div>
                <strong>{task.title}</strong>
                <p className="muted small">
                  {task.type}
                  {task.deadline ? ` · vence ${task.deadline}` : ''}
                  {task.thesisId ? ` · tesis ${task.thesisId}` : ''}
                </p>
              </div>
              <div className="task-row-actions">
                <span className="badge badge-progress">{task.status}</span>
                {task.cancellable ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    data-testid={`react-ws-task-cancel-${task.id}`}
                    onClick={() => void onCancel(task.id)}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
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

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'error' ? 'form-error' : 'form-success'}
          role="status"
          data-testid={
            statusMessage.kind === 'error' ? 'react-ws-tasks-error-msg' : 'react-ws-tasks-success'
          }
        >
          {statusMessage.text}
        </p>
      ) : null}

      <LegacyHandoff
        actions={['gestionar grabaciones']}
        testId="react-ws-tasks-handoff"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export function ReactClientWorkspacePage({
  tab = 'radar',
  clientId = null,
}: {
  tab?: WorkspaceTab;
  /** Shell-selected workspace client — narrowed via trusted tenant scope, never forged. */
  clientId?: string | null;
}) {
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
      {tab === 'deliver' ? <DeliverPanel workspaceClientId={clientId} /> : null}
      {tab === 'briefs' ? <BriefsPanel /> : null}
      {tab === 'sources' ? <SourcesPanel /> : null}
      {tab === 'tasks' ? <TasksPanel workspaceClientId={clientId} /> : null}
      {tab === 'results' ? <ReactKpiWeeklyChart title="Resultados registrados" /> : null}
      {tab === 'positioning' ? (
        <>
          <ReactThesisEditorPage workspaceClientId={clientId} />
          <ReactMasterDossierPanel />
        </>
      ) : null}
    </div>
  );
}
