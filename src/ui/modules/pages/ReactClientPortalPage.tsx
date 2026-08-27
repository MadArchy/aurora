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
 *   compatibility  tasks, content, theses, KPI results
 *
 * CANONICAL COMMANDS migrated (5): accept / decline / toggle-checklist / submit
 * an Opportunity, and register a consultation result. Each reaches the same
 * consumer the legacy handler reaches.
 *
 * BLOCKED, left legacy (AUDIT010-09): approve or request changes on a thesis
 * (`saveThesis`), open/complete/request-changes on a task (`updateTaskStatus`),
 * approve or reject content (`addFeedbackEvent`, `saveContent`), acknowledge a
 * briefing (`acknowledgeDelivery`), add evidence (`addEvidenceItem`).
 *
 * MULTI-THESIS: the legacy portal selects `awaiting[0] || ACTIVE || theses[0]`
 * and that implicit pick feeds the approve/request-changes buttons' thesis id.
 * Here the client selects the thesis explicitly and nothing is pre-elected
 * (threat T-010-15).
 */

import { useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import { useClientContent, useClientTasks, useThesisDetail, useThesisOptions } from '../../hooks/useWave3Data';
import { ReactOpportunityPanel } from '../Opportunity/ReactOpportunityPanel';
import { ReactKpiWeeklyChart } from '../Kpi/ReactKpiWeeklyChart';
import { ReactClientProfilePanel } from '../ClientProfile/ReactClientProfilePanel';
import { ReactProofWallPanel } from '../ProofWall/ReactProofWallPanel';
import { LegacyHandoff, PanelState } from './LegacyHandoff';

export type ClientPortalTab = 'home' | 'tasks' | 'content' | 'opportunities' | 'thesis' | 'results';

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
            <li className="task-row" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                {task.description ? <p className="muted small">{task.description}</p> : null}
                <p className="muted small">
                  {task.type} · {task.estimatedMinutes} min
                  {task.deadline ? ` · vence ${task.deadline}` : ''}
                </p>
              </div>
              <span className="badge badge-progress">{task.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-portal-tasks-empty">
          No tienes acciones pendientes.
        </p>
      )}

      <LegacyHandoff
        actions={['abrir una acción', 'grabar vídeo', 'aprobarla', 'pedir ajustes']}
        testId="react-portal-tasks-handoff"
      />
    </div>
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
  const options = useThesisOptions(tenantScope);
  const detail = useThesisDetail(tenantScope, thesisId);

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
            onChange={(event) => setThesisId(event.target.value || null)}
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

      {thesisId && detail.data?.resolved ? (
        <div data-testid="react-portal-thesis-detail">
          <h4>{detail.data.title}</h4>
          <p className="muted small">
            {detail.data.status} · tu decisión: {detail.data.clientApprovalStatus}
          </p>
          {detail.data.expertIdentity ? <p className="small">{detail.data.expertIdentity}</p> : null}
          {detail.data.differentiator ? (
            <p className="small">
              <strong>Diferenciador:</strong> {detail.data.differentiator}
            </p>
          ) : null}
          {detail.data.audiences.length ? (
            <p className="muted small">
              Audiencias: {detail.data.audiences.map((a) => a.label).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : thesisId ? (
        <p className="muted small" data-testid="react-portal-thesis-unresolved">
          Esa tesis no está disponible.
        </p>
      ) : null}

      <ReactProofWallPanel />

      <LegacyHandoff
        actions={['aprobar la tesis', 'pedir cambios', 'añadir evidencia al vault']}
        testId="react-portal-thesis-handoff"
      />
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
