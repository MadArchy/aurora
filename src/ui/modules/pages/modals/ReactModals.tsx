/**
 * SPEC-010 · `Modals.ts` decomposition (wave 3, T-010-302).
 *
 * The legacy file is one 834-line module holding 13 unrelated modals. This file
 * replaces that shape with one component per modal, which is the decomposition
 * the task asks for. Each component below states its own read source, its own
 * command disposition and its own authority.
 *
 * MIGRATED HERE (7 of 13):
 *   ReactComparativeModal       pure props, no read, no command
 *   ReactChallengeModal         pure props, navigation intents only
 *   ReactContentPreviewModal    compatibility read, no command
 *   ReactContentDiffModal       compatibility read, no command, ADMIN-gated
 *   ReactDeliveryPreviewModal   compatibility read, send stays legacy
 *   ReactFeedbackModal          ONE canonical branch migrated (see below)
 *   ReactBriefSelectionModal    canonical brief read, generation stays legacy
 *
 * NOT MIGRATED (6 of 13) — every one has a legacy write with no canonical
 * Application use case, so AUDIT010-09 forbids moving it, and the legacy modal
 * stays served: `create-client` (`createClientWithInvite` / CR-1 Client Lifecycle),
 * `add-evidence` (`addEvidenceItem`), `add-task` (`addTask`), `article-review`
 * (`saveClientArticleRevision`, `transitionContentPipeline`), `content-editor`
 * (`saveContent`), `teleprompter` (media capture + `confirmSendRecording`).
 *
 * Two legacy behaviours are deliberately not reproduced, both recorded in
 * `tasks.md`: the diff modal's unescaped `diffHtml` injection, and the
 * generate-content modal's `approvedBriefs[0]` pre-selection.
 */

import { useState } from 'react';
import { useSession } from '../../../providers/SessionProvider';
import {
  useContentAuthorizingBriefs,
  useContentDetail,
  useWorkspaceDeliver,
} from '../../../hooks/useWave3Data';
import { useOpportunityCommands } from '../../../hooks/useWave2Data';
import { LegacyHandoff, PanelState } from '../LegacyHandoff';

function ModalShell({
  title,
  subtitle,
  onClose,
  testId,
  authority,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  testId: string;
  authority: 'READ_ONLY' | 'DISPLAY_ONLY' | 'PRESENTATION_ONLY' | 'INTENT_ONLY';
  children: React.ReactNode;
}) {
  return (
    <section
      className="card modal-card"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid={testId}
      data-authority={authority}
    >
      <div className="card-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="muted small">{subtitle}</p> : null}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          Cerrar
        </button>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * 1. Comparative analysis — pure presentation
 * ------------------------------------------------------------------ */

export interface ComparativeView {
  readonly openaiOutput: string;
  readonly claudeOutput: string;
  readonly consensusScore: number;
  readonly divergenceSummary: string;
  readonly synthesizedRecommendation: string;
}

/**
 * READ SOURCE: none — the projection arrives as props.
 * COMMAND: none. No provider is called from React (threat T-010-04); the
 * comparison was produced elsewhere and this component only displays it.
 *
 * The legacy bottom button reads "Entendido y Aplicar Síntesis" but applies
 * nothing. Rather than reproduce a control that misdescribes itself, the button
 * here says what it does.
 */
export function ReactComparativeModal({
  result,
  onClose,
}: {
  result: ComparativeView;
  onClose: () => void;
}) {
  return (
    <ModalShell
      title="Análisis comparativo"
      subtitle={`Consenso ${result.consensusScore}%`}
      onClose={onClose}
      testId="react-comparative-modal"
      authority="PRESENTATION_ONLY"
    >
      <div className="grid-2">
        <div>
          <strong className="small">Modelo A</strong>
          <p className="small">{result.openaiOutput}</p>
        </div>
        <div>
          <strong className="small">Modelo B</strong>
          <p className="small">{result.claudeOutput}</p>
        </div>
      </div>
      <div className="form-group">
        <strong className="small">Divergencias</strong>
        <p className="small">{result.divergenceSummary}</p>
      </div>
      <div className="form-group">
        <strong className="small">Síntesis</strong>
        <p className="small">{result.synthesizedRecommendation}</p>
      </div>
      <button type="button" className="btn btn-secondary" onClick={onClose}>
        Entendido
      </button>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * 2. Thesis challenge — pure presentation + navigation intents
 * ------------------------------------------------------------------ */

export interface ChallengeView {
  readonly outcomeLabel: string;
  readonly summary: string;
  readonly weaknesses: readonly string[];
  readonly counterArguments: readonly string[];
}

/**
 * READ SOURCE: none — props.
 * COMMAND: none. The legacy buttons only open other surfaces; they persist
 * nothing. `onNavigate` receives the requested destination so the host decides,
 * which keeps navigation authority outside this component.
 */
export function ReactChallengeModal({
  thesisTitle,
  challenge,
  onNavigate,
  onClose,
}: {
  thesisTitle: string;
  challenge: ChallengeView;
  onNavigate: (destination: 'thesis-editor' | 'evidence-vault') => void;
  onClose: () => void;
}) {
  return (
    <ModalShell
      title={`Stress-test · ${thesisTitle}`}
      subtitle={challenge.outcomeLabel}
      onClose={onClose}
      testId="react-challenge-modal"
      authority="PRESENTATION_ONLY"
    >
      <p className="small">{challenge.summary}</p>

      {challenge.weaknesses.length ? (
        <div className="form-group">
          <strong className="small">Debilidades</strong>
          <ul className="small">
            {challenge.weaknesses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {challenge.counterArguments.length ? (
        <div className="form-group">
          <strong className="small">Contraargumentos</strong>
          <ul className="small">
            {challenge.counterArguments.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onNavigate('thesis-editor')}
        >
          Revisar la tesis
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onNavigate('evidence-vault')}
        >
          Revisar evidencia
        </button>
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * 3. Content preview — compatibility read, no command
 * ------------------------------------------------------------------ */

/**
 * READ SOURCE: compatibility (`readContentDetail`).
 * COMMAND: none, as in the legacy preview.
 */
export function ReactContentPreviewModal({
  contentId,
  onClose,
}: {
  contentId: string;
  onClose: () => void;
}) {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useContentDetail(tenantScope, contentId);

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización."
        testId="react-content-preview-no-scope"
      />
    );
  }
  if (isLoading) {
    return (
      <PanelState kind="loading" message="Cargando contenido…" testId="react-content-preview-loading" />
    );
  }
  if (isError || !data?.resolved) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar el contenido."
        testId="react-content-preview-error"
      />
    );
  }

  return (
    <ModalShell
      title={data.title}
      subtitle={`${data.platform} · ${data.type} · ${data.wordCount} palabras`}
      onClose={onClose}
      testId="react-content-preview-modal"
      authority="READ_ONLY"
    >
      {data.claimVerdict ? (
        <p className="muted small" data-testid="react-content-preview-claim">
          Claim-safety: {data.claimVerdict}
          {data.claimFlags.length ? ` · ${data.claimFlags.length} hallazgos` : ''}
        </p>
      ) : null}
      {/* Rendered as a text node: no HTML from the data layer is interpreted. */}
      <div className="content-preview-body small" data-testid="react-content-preview-body">
        {data.body.split('\n\n').map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * 4. Content diff / feedback history — compatibility read, ADMIN-gated
 * ------------------------------------------------------------------ */

/**
 * READ SOURCE: compatibility (`readContentDetail`).
 * COMMAND: none.
 *
 * `isAdmin` comes from the trusted session projection, which derives it from
 * `authService`. This component never reads or asserts a role itself, and the
 * gate here is visibility only — it grants nothing (threat T-010-11).
 *
 * The legacy modal injects `latestEdit.diffHtml` unescaped. This one renders the
 * feedback trail as text, so no markup from the data layer is interpreted.
 */
export function ReactContentDiffModal({
  contentId,
  onClose,
}: {
  contentId: string;
  onClose: () => void;
}) {
  const { tenantScope, isAdmin } = useSession();
  const { data, isLoading, isError } = useContentDetail(tenantScope, contentId);

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización."
        testId="react-content-diff-no-scope"
      />
    );
  }
  if (isLoading) {
    return <PanelState kind="loading" message="Cargando cambios…" testId="react-content-diff-loading" />;
  }
  if (isError || !data?.resolved) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar el historial."
        testId="react-content-diff-error"
      />
    );
  }

  return (
    <ModalShell
      title={`Revisión · ${data.title}`}
      subtitle={`Estado ${data.status}`}
      onClose={onClose}
      testId="react-content-diff-modal"
      authority="READ_ONLY"
    >
      {data.feedbackEvents.length ? (
        <ul className="feedback-trail small" data-testid="react-content-diff-events">
          {data.feedbackEvents.map((event) => (
            <li key={event.id}>
              <strong>{event.role}</strong> · {event.createdAt}
              {event.notes ? <p className="muted small">{event.notes}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-content-diff-empty">
          Sin feedback registrado todavía.
        </p>
      )}

      {isAdmin ? (
        <LegacyHandoff actions={['editar el contenido']} testId="react-content-diff-handoff" />
      ) : null}
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * 5. Delivery preview — compatibility read, send stays legacy
 * ------------------------------------------------------------------ */

/**
 * READ SOURCE: compatibility (`readWorkspaceDeliver`).
 * COMMAND: none. Sending a briefing runs a canonical authorization gate and then
 * a series of `dbService` writes plus notifications (`main.ts:3020+`). The gate
 * is canonical but the writes are not, so the whole action stays legacy: a
 * partially-canonical command is not a migratable command.
 */
export function ReactDeliveryPreviewModal({
  packageId,
  onClose,
}: {
  packageId: string;
  onClose: () => void;
}) {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useWorkspaceDeliver(tenantScope);

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización."
        testId="react-delivery-preview-no-scope"
      />
    );
  }
  if (isLoading) {
    return (
      <PanelState kind="loading" message="Cargando briefing…" testId="react-delivery-preview-loading" />
    );
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar el briefing."
        testId="react-delivery-preview-error"
      />
    );
  }

  const pkg = (data?.sentDeliveries ?? []).find((item) => item.id === packageId);

  return (
    <ModalShell
      title="Vista previa del briefing"
      subtitle={pkg ? `${pkg.itemCount} elementos · ${pkg.status}` : 'Briefing no encontrado'}
      onClose={onClose}
      testId="react-delivery-preview-modal"
      authority="READ_ONLY"
    >
      {pkg ? (
        <p className="small" data-testid="react-delivery-preview-body">
          {pkg.title || 'Sin título'}
          {pkg.sentAt ? ` · enviado ${pkg.sentAt}` : ''}
        </p>
      ) : (
        <p className="empty-state" data-testid="react-delivery-preview-empty">
          Ese briefing no está disponible en esta vista.
        </p>
      )}
      <LegacyHandoff
        actions={['enviar el briefing al cliente']}
        testId="react-delivery-preview-handoff"
      />
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * 6. Feedback — ONE canonical branch migrated
 * ------------------------------------------------------------------ */

/**
 * READ SOURCE: none.
 * COMMAND: canonical, for the Opportunity branch only.
 *
 * The legacy modal has three branches. Only `OPPORTUNITY` reaches a canonical
 * consumer (`declineClientOpportunity`), so only that branch is migrated. The
 * `TASK` branch (`updateTaskStatus`) and the `CONTENT` branch (`addFeedbackEvent`
 * + `saveContent`) are legacy business writes with no canonical use case, so
 * this component refuses to render a submit for them and delegates instead —
 * rather than presenting a form that would have to write illegally.
 */
export function ReactFeedbackModal({
  target,
  onClose,
}: {
  target: { kind: 'OPPORTUNITY'; opportunityId: string } | { kind: 'TASK' | 'CONTENT' };
  onClose: () => void;
}) {
  const { tenantScope } = useSession();
  const commands = useOpportunityCommands(tenantScope);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (target.kind !== 'OPPORTUNITY') {
    return (
      <ModalShell
        title="Solicitar ajustes"
        onClose={onClose}
        testId="react-feedback-modal-delegated"
        authority="DISPLAY_ONLY"
      >
        <LegacyHandoff
          actions={['solicitar ajustes en tareas y contenido']}
          testId="react-feedback-modal-handoff"
        />
      </ModalShell>
    );
  }

  const submit = async () => {
    const result = await commands.mutateAsync({
      kind: 'decline',
      opportunityId: target.opportunityId,
      notes,
    });
    setMessage(result.ok ? 'Observaciones enviadas.' : result.message);
    if (result.ok) onClose();
  };

  return (
    <ModalShell
      title="Declinar oportunidad"
      subtitle="Tus observaciones llegan al consumidor canónico de oportunidades."
      onClose={onClose}
      testId="react-feedback-modal"
      authority="INTENT_ONLY"
    >
      <div className="form-group">
        <label className="form-label" htmlFor="react-feedback-notes">
          Observaciones
        </label>
        <textarea
          id="react-feedback-notes"
          className="form-textarea"
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void submit()}
        disabled={commands.isPending}
        data-testid="react-feedback-submit"
      >
        {commands.isPending ? 'Enviando…' : 'Enviar y declinar'}
      </button>
      {message ? (
        <p className="muted small" role="status" data-testid="react-feedback-message">
          {message}
        </p>
      ) : null}
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * 7. Brief selection for content generation — canonical read
 * ------------------------------------------------------------------ */

/**
 * READ SOURCE: canonical (SPEC-003 `readContentAuthorizingBriefs`).
 * COMMAND: none. Generation calls a provider and then `dbService.saveContent`,
 * neither of which may originate in React (threats T-010-04, T-010-01).
 *
 * The selector starts empty. The legacy modal pre-selects `approvedBriefs[0]`,
 * which quietly biases the manager when several briefs authorize content; that
 * default is not reproduced, so the brief must be chosen explicitly
 * (threat T-010-16).
 */
export function ReactBriefSelectionModal({ onClose }: { onClose: () => void }) {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useContentAuthorizingBriefs(tenantScope);
  const [briefId, setBriefId] = useState<string>('');

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización."
        testId="react-brief-selection-no-scope"
      />
    );
  }
  if (isLoading) {
    return (
      <PanelState kind="loading" message="Cargando briefs…" testId="react-brief-selection-loading" />
    );
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar los briefs."
        testId="react-brief-selection-error"
      />
    );
  }

  const briefs = data ?? [];
  const selected = briefs.find((brief) => brief.id === briefId);

  return (
    <ModalShell
      title="Generar contenido"
      subtitle="Un Strategic Brief aprobado autoriza la creación de contenido."
      onClose={onClose}
      testId="react-brief-selection-modal"
      authority="READ_ONLY"
    >
      {briefs.length ? (
        <>
          <div className="form-group">
            <label className="form-label" htmlFor="react-brief-select">
              Strategic Brief
            </label>
            <select
              id="react-brief-select"
              className="form-select"
              value={briefId}
              onChange={(event) => setBriefId(event.target.value)}
              data-testid="react-brief-select"
            >
              <option value="">Selecciona un brief…</option>
              {briefs.map((brief) => (
                <option key={brief.id} value={brief.id}>
                  {brief.strategicAngle} · v{brief.version}
                </option>
              ))}
            </select>
          </div>

          {selected ? (
            <ul className="small" data-testid="react-brief-detail">
              <li>Territorio: {selected.territory}</li>
              <li>Audiencia: {selected.primaryAudience}</li>
              <li>
                Canal sugerido: {selected.recommendedChannel} · {selected.recommendedFormat}
              </li>
              <li>Acción autorizada: {selected.authorizedAction}</li>
            </ul>
          ) : (
            <p className="muted small" data-testid="react-brief-unselected">
              Sin brief seleccionado.
            </p>
          )}
        </>
      ) : (
        <p className="empty-state" data-testid="react-brief-selection-empty">
          No hay Strategic Briefs aprobados que autoricen contenido.
        </p>
      )}

      <LegacyHandoff
        actions={['generar el borrador de contenido']}
        testId="react-brief-selection-handoff"
      />
    </ModalShell>
  );
}
