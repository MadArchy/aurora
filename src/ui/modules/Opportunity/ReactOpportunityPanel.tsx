/**
 * SPEC-010 · React OpportunityPanel (wave 2, T-010-202).
 *
 * This is the reference module for the fully canonical path: canonical read and
 * canonical command, end to end.
 *
 *   read:    useOpportunities → canonicalReads → opportunityScoutConsumer (SPEC-007)
 *   command: button → useOpportunityCommands → commandSeam → opportunityScoutConsumer
 *
 * The legacy handlers in `main.ts` call the very same consumer functions, so
 * migrating these buttons changed the caller and nothing else: identical use
 * case, identical Domain rules, identical lifecycle guard.
 *
 * Authority: presentation and intent only. Every status shown comes from the
 * canonical projection; this component never computes, assumes or advances a
 * lifecycle state (threat T-010-14). The buttons are enabled from flags the
 * projection supplies, and the canonical layer re-validates each command and may
 * refuse it — a disabled button is a hint, never the control.
 *
 * MULTI-THESIS: opportunities are listed for the client. No thesis is treated as
 * primary and no `[0]` is authoritative. The spotlight below is explicitly
 * DISPLAY_ONLY (threat T-010-15).
 *
 * No optimistic business mutation: after every command the tenant's canonical
 * cache is invalidated and the state is re-read (threats T-010-06, T-010-07).
 */

import { useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import { useOpportunities, useOpportunityCommands } from '../../hooks/useWave2Data';
import type { OpportunityCardView } from '../../data/canonicalReads';

function formatDeadline(deadline: string | null): string {
  if (!deadline) return 'Sin fecha límite';
  return new Date(deadline).toLocaleDateString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function OpportunityCard({
  opp,
  onIntent,
  pending,
}: {
  opp: OpportunityCardView;
  onIntent: ReturnType<typeof useOpportunityCommands>;
  pending: boolean;
}) {
  const [declineNotes, setDeclineNotes] = useState('');
  const [declineOpen, setDeclineOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function run(intent: Parameters<typeof onIntent.mutate>[0]) {
    setMessage(null);
    onIntent.mutate(intent, {
      onSuccess: (result) => {
        if (!result.ok) setMessage(result.message);
        else setDeclineOpen(false);
      },
    });
  }

  return (
    <article
      className="card opportunity-card"
      data-opp-id={opp.id}
      data-authority="CANONICAL"
      data-testid="react-opportunity-card"
    >
      <header className="opportunity-head">
        <div>
          <div className="opportunity-title-row">
            <h4>{opp.title}</h4>
            <span className="badge badge-progress" data-testid="react-opportunity-status">
              {opp.statusLabel}
            </span>
            {opp.isCle ? <span className="badge badge-ready">CLE</span> : null}
          </div>
          <p className="muted small">
            <strong>{opp.organization}</strong> · Cierre: {formatDeadline(opp.deadline)}
            {opp.deadlineSoon && opp.daysLeft !== null ? (
              <>
                {' · '}
                <strong className="warn-text">
                  en {opp.daysLeft} día{opp.daysLeft === 1 ? '' : 's'}
                </strong>
              </>
            ) : null}
          </p>
        </div>
      </header>

      <p className="opportunity-desc">{opp.description}</p>
      <details className="opportunity-rationale">
        <summary>Por qué encaja contigo</summary>
        <p>{opp.fitRationale}</p>
      </details>

      {opp.clientNotes ? (
        <p className="muted small">
          <em>Tus notas: {opp.clientNotes}</em>
        </p>
      ) : null}

      {message ? (
        <p className="muted small" role="alert" data-testid="react-opportunity-message">
          {message}
        </p>
      ) : null}

      {opp.canAcceptOrDecline ? (
        <div className="opportunity-actions">
          <button
            type="button"
            className="btn btn-success btn-sm"
            disabled={pending}
            data-testid="react-opportunity-accept"
            onClick={() =>
              run({
                kind: 'accept',
                opportunityId: opp.id,
                notes: 'Aceptado con disponibilidad completa.',
              })
            }
          >
            Aceptar
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pending}
            data-testid="react-opportunity-decline"
            onClick={() => setDeclineOpen((open) => !open)}
          >
            Declinar
          </button>
        </div>
      ) : null}

      {/*
        Declining requires notes, matching the legacy feedback modal which will
        not submit without them. The modal itself is not migrated (Phase 3,
        AUDIT010-06), so the notes are collected inline; the requirement and the
        canonical command behind it are unchanged.
      */}
      {declineOpen && opp.canAcceptOrDecline ? (
        <div className="opportunity-decline-form">
          <label className="form-label" htmlFor={`decline-notes-${opp.id}`}>
            Observaciones (requeridas para declinar)
          </label>
          <textarea
            id={`decline-notes-${opp.id}`}
            className="form-textarea"
            rows={3}
            value={declineNotes}
            onChange={(e) => setDeclineNotes(e.target.value)}
            data-testid="react-opportunity-decline-notes"
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={pending || !declineNotes.trim()}
            data-testid="react-opportunity-decline-confirm"
            onClick={() => run({ kind: 'decline', opportunityId: opp.id, notes: declineNotes })}
          >
            Enviar y declinar
          </button>
        </div>
      ) : null}

      {opp.canUseChecklist && opp.checklistTotal ? (
        <div className="opportunity-checklist">
          <div className="opportunity-checklist-head">
            <strong>Checklist de postulación</strong>
            <span className="muted small" data-testid="react-opportunity-progress">
              {opp.checklistDone}/{opp.checklistTotal}
            </span>
          </div>
          <ul className="opportunity-checklist-list">
            {opp.checklist.map((item) => (
              <li key={item.id}>
                <label className="opportunity-check-item">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={pending}
                    data-testid="react-opportunity-checklist-item"
                    onChange={(e) =>
                      run({
                        kind: 'toggle',
                        opportunityId: opp.id,
                        itemId: item.id,
                        done: e.target.checked,
                      })
                    }
                  />
                  <span>{item.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!opp.canSubmit || pending}
            data-testid="react-opportunity-submit"
            onClick={() => run({ kind: 'submit', opportunityId: opp.id })}
          >
            Marcar postulación enviada
          </button>
        </div>
      ) : null}

      {opp.status === 'SUBMITTED' ? (
        <p className="badge badge-ready">
          Postulación enviada
          {opp.submittedAt ? ` · ${new Date(opp.submittedAt).toLocaleDateString('es')}` : ''}
        </p>
      ) : null}
      {opp.status === 'DECLINED' ? <p className="badge badge-pending">Declinada</p> : null}
    </article>
  );
}

export function ReactOpportunityPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useOpportunities(tenantScope);
  const commands = useOpportunityCommands(tenantScope);

  if (!tenantScope) {
    return (
      <section className="card" data-testid="react-opportunities-no-scope">
        <p className="muted">
          Sesión sin contexto de organización — no se muestran oportunidades.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="card" data-testid="react-opportunities-loading">
        <p className="muted">Cargando oportunidades…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="card" role="alert" data-testid="react-opportunities-error">
        <p className="muted">No se pudieron cargar las oportunidades.</p>
      </section>
    );
  }

  const opportunities = data ?? [];

  return (
    <section className="card" data-testid="react-opportunities-panel">
      <div className="card-header">
        <div>
          <h3>Oportunidades (The Scout)</h3>
          <p className="muted small">
            Propuesta → aceptar/declinar → checklist → postulación enviada.
          </p>
        </div>
      </div>

      {opportunities.length ? (
        <div className="opportunity-list">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opp={opp}
              onIntent={commands}
              pending={commands.isPending}
            />
          ))}
        </div>
      ) : (
        <p className="empty-state" data-testid="react-opportunities-empty">
          No hay oportunidades activas por ahora.
        </p>
      )}
    </section>
  );
}

/**
 * DISPLAY_ONLY spotlight — T-010-202.
 *
 * Picks the nearest-deadline actionable opportunity purely to draw attention to
 * it. The pick is not thesis authority, not lifecycle authority and not command
 * authority: the card it renders is the same card, and every action inside still
 * goes through the canonical command path (threat T-010-15).
 */
export function ReactOpportunitySpotlight() {
  const { tenantScope } = useSession();
  const { data } = useOpportunities(tenantScope);
  const commands = useOpportunityCommands(tenantScope);

  const actionable = (data ?? []).filter(
    (o) => o.status === 'PROPOSED' || o.status === 'ACCEPTED' || o.status === 'CHECKLIST'
  );
  const pick = actionable.length ? actionable[0] : undefined;
  if (!pick) return null;

  return (
    <section
      className="card opportunity-spotlight"
      data-testid="react-opportunity-spotlight"
      data-authority="DISPLAY_ONLY"
    >
      <div className="card-header">
        <div>
          <h3>Oportunidad destacada</h3>
          <p className="muted small">
            {pick.status === 'PROPOSED'
              ? 'The Scout te propone esta convocatoria — acéptala para ver el checklist de postulación.'
              : 'Completa el checklist antes del cierre.'}
          </p>
        </div>
      </div>
      <OpportunityCard opp={pick} onIntent={commands} pending={commands.isPending} />
    </section>
  );
}
