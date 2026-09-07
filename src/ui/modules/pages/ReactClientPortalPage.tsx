/**
 * SPEC-010 · React ClientPortal (wave 3, T-010-304) — HYBRID.
 *
 * Authority: presentation + intent only.
 *
 * This is a HYBRID page, not a full cutover, and the classification is
 * load-bearing: the canonical parts of the portal run through React, and the
 * parts whose legacy handler writes business state without a canonical
 * Application use case stay on the legacy surface.
 *
 * READ SOURCES — one declared per panel:
 *   canonical      (SPEC-007) opportunities, via `readClientOpportunityCards`
 *   compatibility  tasks, content, theses, KPI results, latest client briefing
 *
 * BLOCKED, left legacy (AUDIT010-09): video teleprompter (`start` / video `complete`),
 * article review (#32), attach_evidence (ClientWorkspace re-upload), add evidence vault (#30).
 *
 * CANONICAL COMMANDS migrated: accept / decline / toggle-checklist / submit an Opportunity,
 * register a consultation result, acknowledge a briefing (`AcknowledgeDelivery`),
 * decide thesis client review (`DecideThesisClientReview`), and generic ClientPortal task
 * transitions (`TransitionClientTask` view / complete / request_changes for non-video,
 * non-article tasks — P3A partial #28 parity).
 *
 * MULTI-THESIS: the legacy portal selects `awaiting[0] || ACTIVE || theses[0]`
 * and that implicit pick feeds the approve/request-changes buttons' thesis id.
 * Here the client selects the thesis explicitly and nothing is pre-elected
 * (threat T-010-15).
 */

import { useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import {
  useAcknowledgeDelivery,
  useClientContent,
  useClientLatestBriefing,
  useClientTasks,
  useDecideThesisClientReview,
  useTransitionClientTask,
  useThesisDetail,
  useThesisOptions,
} from '../../hooks/useWave3Data';
import { ReactMasterDossierPanel } from '../MasterDossier/ReactMasterDossierPanel';
import { ReactOpportunityPanel } from '../Opportunity/ReactOpportunityPanel';
import { ReactKpiWeeklyChart } from '../Kpi/ReactKpiWeeklyChart';
import { ReactClientProfilePanel } from '../ClientProfile/ReactClientProfilePanel';
import { ReactProofWallPanel } from '../ProofWall/ReactProofWallPanel';
import { LegacyHandoff, PanelState } from './LegacyHandoff';

export type ClientPortalTab = 'home' | 'tasks' | 'content' | 'opportunities' | 'thesis' | 'results';

function isGenericClientTaskType(type: string): boolean {
  return type !== 'RECORD_VIDEO' && type !== 'REVIEW_ARTICLE';
}

function TaskSpecializedHandoff({ task }: { task: { id: string; type: string } }) {
  if (task.type === 'RECORD_VIDEO') {
    return (
      <LegacyHandoff
        actions={['grabar vídeo con el teleprompter']}
        testId={`react-portal-task-handoff-video-${task.id}`}
      />
    );
  }
  if (task.type === 'REVIEW_ARTICLE') {
    return (
      <LegacyHandoff
        actions={['revisar el artículo', 'aprobar el artículo']}
        testId={`react-portal-task-handoff-article-${task.id}`}
      />
    );
  }
  return null;
}

function GenericTaskActions({
  task,
}: {
  task: { id: string; status: string; title: string };
}) {
  const { tenantScope } = useSession();
  const transition = useTransitionClientTask(tenantScope);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  const canView = task.status === 'ASSIGNED' || task.status === 'DRAFT';

  const runTransition = (
    intent: 'view' | 'complete' | 'request_changes',
    clientNotes?: string,
    successText?: string,
    errorFallback?: string
  ) => {
    setStatusMessage(null);
    transition.mutate(
      { taskId: task.id, intent, clientNotes },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setStatusMessage({
              kind: 'error',
              text: result.message || errorFallback || 'No se pudo actualizar la tarea',
            });
            return;
          }
          if (successText) {
            setStatusMessage({ kind: 'success', text: successText });
          }
          if (intent === 'request_changes') {
            setNotes('');
            setFeedbackOpen(false);
          }
        },
        onError: () => {
          setStatusMessage({
            kind: 'error',
            text: errorFallback || 'No se pudo actualizar la tarea',
          });
        },
      }
    );
  };

  return (
    <div className="task-actions" data-testid={`react-portal-task-actions-${task.id}`}>
      <div className="btn-row">
        {canView ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            data-testid={`react-portal-task-view-${task.id}`}
            disabled={transition.isPending}
            onClick={() => runTransition('view')}
          >
            Abrir acción
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          data-testid={`react-portal-task-request-changes-${task.id}`}
          disabled={transition.isPending}
          onClick={() => {
            setStatusMessage(null);
            setFeedbackOpen(true);
          }}
        >
          Solicitar Ajustes
        </button>
        <button
          type="button"
          className="btn btn-success btn-sm"
          data-testid={`react-portal-task-complete-${task.id}`}
          disabled={transition.isPending}
          onClick={() => runTransition('complete', undefined, 'Tarea completada')}
        >
          Aprobar y Marcar como Listo
        </button>
      </div>

      {feedbackOpen ? (
        <div className="task-feedback" data-testid={`react-portal-task-feedback-${task.id}`}>
          <label className="form-label" htmlFor={`react-task-feedback-${task.id}`}>
            Observaciones para tu Brand Manager
          </label>
          <textarea
            id={`react-task-feedback-${task.id}`}
            className="form-textarea"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            data-testid={`react-portal-task-feedback-notes-${task.id}`}
          />
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              data-testid={`react-portal-task-feedback-cancel-${task.id}`}
              onClick={() => {
                setFeedbackOpen(false);
                setNotes('');
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              data-testid={`react-portal-task-feedback-submit-${task.id}`}
              disabled={transition.isPending || !notes.trim()}
              onClick={() =>
                runTransition(
                  'request_changes',
                  notes.trim(),
                  'Observaciones enviadas a tu Brand Manager',
                  'No se pudo actualizar la tarea'
                )
              }
            >
              Enviar observaciones
            </button>
          </div>
        </div>
      ) : null}

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'success' ? 'form-success' : 'form-error'}
          data-testid={
            statusMessage.kind === 'success'
              ? `react-portal-task-success-${task.id}`
              : `react-portal-task-failure-${task.id}`
          }
          role="status"
        >
          {statusMessage.text}
        </p>
      ) : null}
    </div>
  );
}

function TasksPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useClientTasks(tenantScope);

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando acciones…" testId="react-portal-tasks-loading" />;
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar tus acciones."
        testId="react-portal-tasks-error"
      />
    );
  }

  const tasks = data ?? [];
  const open = tasks.filter((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED');

  return (
    <div data-testid="react-portal-tasks">
      {open.length ? (
        <ul className="task-list">
          {open.map((task) => (
            <li className="task-row" key={task.id} data-testid={`react-portal-task-row-${task.id}`}>
              <div>
                <strong>{task.title}</strong>
                {task.description ? <p className="muted small">{task.description}</p> : null}
                <p className="muted small">
                  {task.type} · {task.estimatedMinutes} min
                  {task.deadline ? ` · vence ${task.deadline}` : ''}
                </p>
              </div>
              <span className="badge badge-progress" data-testid={`react-portal-task-status-${task.id}`}>
                {task.status}
              </span>
              {isGenericClientTaskType(task.type) ? (
                <GenericTaskActions task={task} />
              ) : (
                <TaskSpecializedHandoff task={task} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-portal-tasks-empty">
          No tienes acciones pendientes.
        </p>
      )}
    </div>
  );
}

function BriefingPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useClientLatestBriefing(tenantScope);
  const acknowledge = useAcknowledgeDelivery(tenantScope);
  const [note, setNote] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  if (isLoading) {
    return (
      <PanelState kind="loading" message="Cargando briefing…" testId="react-portal-briefing-loading" />
    );
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar tu briefing."
        testId="react-portal-briefing-error"
      />
    );
  }

  if (!data) {
    return (
      <section className="card" data-testid="react-portal-briefing">
        <div className="section-heading">
          <div className="section-heading-copy">
            <p className="section-kicker">Contexto</p>
            <h2>Último briefing</h2>
            <p>La selección más reciente de tu Brand Manager y por qué importa.</p>
          </div>
        </div>
        <p className="empty-state" data-testid="react-portal-briefing-empty">
          Tu Brand Manager aún no te ha enviado un briefing.
        </p>
      </section>
    );
  }

  const isSent = data.status === 'SENT';
  const isAcknowledged = data.status === 'ACKNOWLEDGED';

  return (
    <section className="card" data-testid="react-portal-briefing">
      <div className="section-heading">
        <div className="section-heading-copy">
          <p className="section-kicker">Contexto</p>
          <h2>Último briefing</h2>
          <p>La selección más reciente de tu Brand Manager y por qué importa.</p>
        </div>
        {isSent ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            data-testid="react-portal-briefing-ack"
            disabled={acknowledge.isPending}
            onClick={() => {
              setStatusMessage(null);
              const trimmedNote = note.trim() || undefined;
              acknowledge.mutate(
                { packageId: data.id, clientAckNote: trimmedNote },
                {
                  onSuccess: (result) => {
                    if (result.ok) {
                      setNote('');
                      setStatusMessage({ kind: 'success', text: 'Briefing marcado como visto' });
                    } else {
                      setStatusMessage({
                        kind: 'error',
                        text: result.message || 'No se pudo marcar el briefing',
                      });
                    }
                  },
                  onError: () => {
                    setStatusMessage({ kind: 'error', text: 'No se pudo marcar el briefing' });
                  },
                }
              );
            }}
          >
            Marcar como leído
          </button>
        ) : isAcknowledged ? (
          <span className="badge badge-ready" data-testid="react-portal-briefing-read">
            Leído
          </span>
        ) : null}
      </div>

      <article className="briefing-card" data-testid="react-portal-briefing-card">
        <header className="briefing-card-header">
          <div>
            <h3>{data.title}</h3>
            <p className="muted small">
              {data.periodLabel ? `${data.periodLabel} · ` : ''}
              {data.itemCount} {data.itemCount === 1 ? 'elemento' : 'elementos'} · {data.statusLabel}
            </p>
          </div>
        </header>

        {data.strategicNote ? (
          <blockquote className="briefing-note">{data.strategicNote}</blockquote>
        ) : null}

        <ul className="briefing-items">
          {data.items.map((item) => (
            <li key={item.id}>
              <span className="badge badge-progress">{item.kindLabel}</span>
              <strong>{item.title}</strong>
              {item.rationale ? (
                <details className="briefing-rationale">
                  <summary>Por qué se incluyó</summary>
                  <p className="muted small">{item.rationale}</p>
                </details>
              ) : null}
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  Ver fuente
                </a>
              ) : null}
            </li>
          ))}
        </ul>

        {isSent ? (
          <div className="briefing-ack-note">
            <label className="form-label" htmlFor={`react-ack-note-${data.id}`}>
              Nota para tu Brand Manager (opcional)
            </label>
            <textarea
              id={`react-ack-note-${data.id}`}
              className="form-textarea"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Lo reviso el jueves / necesito más contexto en el punto 2"
              data-testid="react-portal-briefing-note"
            />
          </div>
        ) : null}

        {data.clientAckNote ? (
          <p className="muted small">
            <em>Tu nota: {data.clientAckNote}</em>
          </p>
        ) : null}
      </article>

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'success' ? 'form-success' : 'form-error'}
          data-testid={
            statusMessage.kind === 'success'
              ? 'react-portal-briefing-success'
              : 'react-portal-briefing-failure'
          }
          role="status"
        >
          {statusMessage.text}
        </p>
      ) : null}
    </section>
  );
}

function ContentPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useClientContent(tenantScope);

  if (isLoading) {
    return (
      <PanelState kind="loading" message="Cargando contenido…" testId="react-portal-content-loading" />
    );
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar tu contenido."
        testId="react-portal-content-error"
      />
    );
  }

  const pending = data?.pending ?? [];
  const decided = data?.decided ?? [];

  return (
    <div data-testid="react-portal-content">
      <h4 className="small">Pendiente de tu revisión</h4>
      {pending.length ? (
        <ul className="content-list">
          {pending.map((item) => (
            <li className="content-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p className="muted small">
                  {item.platform} · {item.type} · {item.wordCount} palabras
                </p>
              </div>
              <span className="badge badge-pending">{item.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-portal-content-empty">
          Nada pendiente de revisión.
        </p>
      )}

      {decided.length ? (
        <details data-testid="react-portal-content-decided">
          <summary className="small">Ya revisado ({decided.length})</summary>
          <ul className="content-list">
            {decided.map((item) => (
              <li className="content-row" key={item.id}>
                <strong>{item.title}</strong>
                <span className="badge badge-ready">{item.status}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <LegacyHandoff
        actions={['aprobar contenido', 'pedir cambios', 'editar el artículo']}
        testId="react-portal-content-handoff"
      />
    </div>
  );
}

function ThesisReviewPanel() {
  const { tenantScope } = useSession();
  const [thesisId, setThesisId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );
  const options = useThesisOptions(tenantScope);
  const detail = useThesisDetail(tenantScope, thesisId);
  const decideReview = useDecideThesisClientReview(tenantScope);

  if (options.isLoading) {
    return <PanelState kind="loading" message="Cargando tesis…" testId="react-portal-thesis-loading" />;
  }
  if (options.isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar tus tesis."
        testId="react-portal-thesis-error"
      />
    );
  }

  const theses = options.data ?? [];
  const awaiting = theses.filter((thesis) => thesis.awaitingClientAction);
  const resolved = detail.data?.resolved ? detail.data : null;

  const handleDecision = (decision: 'approve' | 'request_changes') => {
    if (!thesisId) return;
    setStatusMessage(null);
    const fallback =
      decision === 'approve' ? 'No se pudo aprobar la tesis' : 'No se pudo solicitar cambios';
    decideReview.mutate(
      {
        thesisId,
        decision,
        feedback: decision === 'request_changes' ? feedback : undefined,
      },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setStatusMessage({ kind: 'error', text: result.message || fallback });
            return;
          }
          if (result.decision === 'approve') {
            setStatusMessage({
              kind: 'success',
              text: result.appliedRevision
                ? 'Revisión aplicada. La tesis activa queda actualizada.'
                : result.awaitsManagerActivation
                  ? 'Tesis aprobada. Tu Brand Manager la activará.'
                  : 'Tesis aprobada.',
            });
          } else {
            setStatusMessage({ kind: 'success', text: 'Cambios solicitados al manager' });
          }
          if (decision === 'request_changes') {
            setFeedback('');
          }
        },
        onError: () => {
          setStatusMessage({ kind: 'error', text: fallback });
        },
      }
    );
  };

  return (
    <div data-testid="react-portal-thesis">
      {awaiting.length ? (
        <p className="muted small" data-testid="react-portal-thesis-awaiting">
          {awaiting.length === 1
            ? '1 tesis espera tu decisión.'
            : `${awaiting.length} tesis esperan tu decisión.`}
        </p>
      ) : null}

      {theses.length ? (
        <div className="form-group">
          <label className="form-label" htmlFor="react-portal-thesis-select">
            Tesis
          </label>
          <select
            id="react-portal-thesis-select"
            className="form-select"
            value={thesisId ?? ''}
            onChange={(event) => {
              setThesisId(event.target.value || null);
              setStatusMessage(null);
            }}
            data-testid="react-portal-thesis-select"
          >
            <option value="">Selecciona una tesis…</option>
            {theses.map((thesis) => (
              <option key={thesis.id} value={thesis.id}>
                {thesis.title} · {thesis.status}
                {thesis.awaitingClientAction ? ' · espera tu decisión' : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="empty-state" data-testid="react-portal-thesis-empty">
          Todavía no hay tesis para revisar.
        </p>
      )}

      {thesisId && resolved ? (
        <div className="card" data-testid="react-portal-thesis-detail">
          <div className="card-header">
            <div>
              <h3>
                {resolved.status === 'UNDER_REVIEW'
                  ? 'Tesis en revisión'
                  : 'Tu tesis de posicionamiento'}
              </h3>
            </div>
            <span className="badge badge-pending">
              {resolved.status} · {resolved.clientApprovalStatus}
            </span>
          </div>

          {resolved.hasPendingRevision ? (
            <p className="warn-strip" data-testid="react-portal-thesis-pending-revision">
              Hay una revisión pendiente propuesta por tu Brand Manager.
            </p>
          ) : null}

          <h4>{resolved.title}</h4>
          {resolved.expertIdentity ? <p className="small">{resolved.expertIdentity}</p> : null}
          {resolved.differentiator ? (
            <p className="small">
              <strong>Diferenciador:</strong> {resolved.differentiator}
            </p>
          ) : null}
          {resolved.audiences.length ? (
            <p className="muted small">
              Audiencias: {resolved.audiences.map((a) => a.label).join(' · ')}
            </p>
          ) : null}
          {resolved.proofPoints.length ? (
            <ul className="policy-list" data-testid="react-portal-thesis-proof-points">
              {resolved.proofPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}

          {resolved.needsAction ? (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="react-portal-thesis-change-notes">
                  Si pides cambios, indica qué debe ajustar el manager
                </label>
                <textarea
                  id="react-portal-thesis-change-notes"
                  className="form-textarea"
                  rows={2}
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Ej. La audiencia comercial está demasiado amplia."
                  data-testid="react-portal-thesis-change-notes"
                />
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-success"
                  data-testid="react-portal-thesis-approve"
                  disabled={decideReview.isPending}
                  onClick={() => handleDecision('approve')}
                >
                  Aprobar tesis
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-testid="react-portal-thesis-request-changes"
                  disabled={decideReview.isPending}
                  onClick={() => handleDecision('request_changes')}
                >
                  Pedir cambios
                </button>
              </div>
            </>
          ) : resolved.status === 'UNDER_REVIEW' && resolved.clientApprovalStatus === 'APPROVED' ? (
            <p className="info-strip" data-testid="react-portal-thesis-approved-info">
              Aprobaste esta tesis. Tu Brand Manager la activará para el radar y el contenido.
            </p>
          ) : null}
        </div>
      ) : thesisId ? (
        <p className="muted small" data-testid="react-portal-thesis-unresolved">
          Esa tesis no está disponible.
        </p>
      ) : null}

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'success' ? 'form-success' : 'form-error'}
          data-testid={
            statusMessage.kind === 'success'
              ? 'react-portal-thesis-success'
              : 'react-portal-thesis-failure'
          }
          role="status"
        >
          {statusMessage.text}
        </p>
      ) : null}

      <ReactProofWallPanel />

      <LegacyHandoff
        actions={['añadir evidencia al vault']}
        testId="react-portal-thesis-handoff"
      />

      <ReactMasterDossierPanel />
    </div>
  );
}

export function ReactClientPortalPage({ tab = 'home' }: { tab?: ClientPortalTab }) {
  const { tenantScope } = useSession();

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización — no se muestra el portal."
        testId="react-portal-no-scope"
      />
    );
  }

  return (
    <div className="page-content" data-testid="react-client-portal" data-portal-tab={tab}>
      {tab === 'home' ? (
        <>
          <TasksPanel />
          <BriefingPanel />
          <ReactOpportunityPanel />
        </>
      ) : null}

      {tab === 'tasks' ? <TasksPanel /> : null}
      {tab === 'content' ? <ContentPanel /> : null}
      {tab === 'opportunities' ? <ReactOpportunityPanel /> : null}
      {tab === 'thesis' ? <ThesisReviewPanel /> : null}

      {tab === 'results' ? (
        <>
          <ReactKpiWeeklyChart title="Tus resultados" />
          <ReactClientProfilePanel />
        </>
      ) : null}
    </div>
  );
}
