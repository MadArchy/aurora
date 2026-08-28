/**
 * SPEC-010 · React thesis editor (wave 3, T-010-301) — DISPLAY_ONLY_REACT.
 *
 * Authority: presentation only.
 *
 * READ SOURCE: compatibility (`readThesisOptions`, `readThesisDetail`).
 *
 * COMMAND: none on this React surface. CR-1 Thesis Lifecycle owns
 * `SaveThesis` (#11); the legacy editor invokes `thesisLifecycleConsumer`
 * via `main.ts`. React does not call the consumer or mutate lifecycle state
 * (AUDIT010-09 disposition unchanged — presentation cutover still blocked).
 *
 * MULTI-THESIS — the point of this task. The thesis is chosen by explicit id and
 * nothing else:
 *   - the selector lists every thesis with its status, and starts unselected;
 *   - there is no `[0]`, no "primary", no highest-priority election;
 *   - `priority` is displayed as data, never used to pick;
 *   - an unresolved id renders an explicit error instead of silently becoming a
 *     new thesis, which is what the legacy editor does
 *     (`ThesisEditorModal.ts:126-128`). That legacy quirk is deliberately not
 *     reproduced; the deviation is recorded in `tasks.md`.
 *
 * FORMS: React Hook Form + Zod validate the shape of the review fields only.
 * Completeness, weight validation and review readiness are all computed by
 * `domain/thesisModelCore` inside the read facade, so no readiness rule exists
 * here (threat T-010-19). A passing Zod parse is never permission to save —
 * there is no save.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSession } from '../../providers/SessionProvider';
import { useThesisDetail, useThesisOptions } from '../../hooks/useWave3Data';
import { LegacyHandoff, PanelState } from './LegacyHandoff';

/**
 * Input-shape schema for the editable review fields.
 *
 * AUTHORITY: NONE. It carries no tenant, actor, role, status or lifecycle field,
 * and no completeness threshold — the domain owns all of those.
 */
const thesisReviewSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio'),
  expertIdentity: z.string().trim().min(1, 'La identidad experta es obligatoria'),
  differentiator: z.string().trim().optional().or(z.literal('')),
  perceptionTarget: z.string().trim().optional().or(z.literal('')),
});

type ThesisReviewFields = z.infer<typeof thesisReviewSchema>;

function CompletenessBar({ score }: { score: number }) {
  return (
    <div className="progress-track" data-testid="react-thesis-completeness">
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
    </div>
  );
}

function ThesisReviewForm({
  defaults,
}: {
  defaults: ThesisReviewFields;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ThesisReviewFields>({
    defaultValues: defaults,
    resolver: async (values) => {
      const parsed = thesisReviewSchema.safeParse(values);
      if (parsed.success) return { values, errors: {} };
      const fieldErrors: Record<string, { type: string; message: string }> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!fieldErrors[key]) fieldErrors[key] = { type: 'shape', message: issue.message };
      }
      return { values: {}, errors: fieldErrors };
    },
  });

  const [shapeOk, setShapeOk] = useState<boolean | null>(null);
  const error = (name: keyof ThesisReviewFields) => errors[name]?.message;

  const field = (
    name: keyof ThesisReviewFields,
    label: string,
    kind: 'input' | 'textarea' = 'input'
  ) => (
    <div className="form-group" key={name}>
      <label className="form-label" htmlFor={`react-thesis-${name}`}>
        {label}
      </label>
      {kind === 'textarea' ? (
        <textarea
          id={`react-thesis-${name}`}
          className="form-textarea"
          rows={3}
          aria-invalid={error(name) ? true : undefined}
          aria-describedby={error(name) ? `react-thesis-${name}-error` : undefined}
          {...register(name)}
        />
      ) : (
        <input
          id={`react-thesis-${name}`}
          type="text"
          className="form-input"
          aria-invalid={error(name) ? true : undefined}
          aria-describedby={error(name) ? `react-thesis-${name}-error` : undefined}
          {...register(name)}
        />
      )}
      {error(name) ? (
        <p className="form-error" id={`react-thesis-${name}-error`} role="alert">
          {error(name)}
        </p>
      ) : null}
    </div>
  );

  return (
    <form
      data-testid="react-thesis-form"
      onSubmit={handleSubmit(
        () => setShapeOk(true),
        () => setShapeOk(false)
      )}
    >
      {field('title', 'Título de la tesis')}
      {field('expertIdentity', 'Identidad experta', 'textarea')}
      {field('differentiator', 'Diferenciador', 'textarea')}
      {field('perceptionTarget', 'Percepción objetivo', 'textarea')}

      <div className="form-actions">
        <button type="submit" className="btn btn-secondary" data-testid="react-thesis-validate">
          Revisar formato
        </button>
        {/* Disabled for its real reason: thesis persistence has no canonical use case. */}
        <button
          type="button"
          className="btn btn-primary"
          disabled
          title="Guardar la tesis requiere la interfaz anterior (AUDIT010-09)"
          data-testid="react-thesis-save-disabled"
        >
          Guardar borrador
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled
          title="Enviar al cliente requiere la interfaz anterior (AUDIT010-09)"
          data-testid="react-thesis-submit-disabled"
        >
          Enviar al cliente
        </button>
      </div>

      {shapeOk === true ? (
        <p className="muted small" role="status" data-testid="react-thesis-shape-ok">
          Formato correcto. Guardar y enviar siguen en la interfaz anterior.
        </p>
      ) : null}
      {shapeOk === false ? (
        <p className="muted small" role="status" data-testid="react-thesis-shape-bad">
          Revisa los campos marcados.
        </p>
      ) : null}
    </form>
  );
}

export function ReactThesisEditorPage() {
  const { tenantScope } = useSession();
  // Starts unselected on purpose: no thesis is elected for the user.
  const [thesisId, setThesisId] = useState<string | null>(null);

  const options = useThesisOptions(tenantScope);
  const detail = useThesisDetail(tenantScope, thesisId);

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización — no se muestran tesis."
        testId="react-thesis-editor-no-scope"
      />
    );
  }

  if (options.isLoading) {
    return (
      <PanelState kind="loading" message="Cargando tesis…" testId="react-thesis-editor-loading" />
    );
  }

  if (options.isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar las tesis."
        testId="react-thesis-editor-error"
      />
    );
  }

  const theses = options.data ?? [];

  return (
    <section
      className="card thesis-editor-card"
      data-testid="react-thesis-editor"
      data-authority="DISPLAY_ONLY"
    >
      <div className="card-header">
        <div>
          <h3>Editor de tesis</h3>
          <p className="muted small">
            Selecciona explícitamente la tesis que quieres revisar. Ninguna tesis se elige por ti.
          </p>
        </div>
        <span className="badge badge-progress" data-testid="react-thesis-count">
          {theses.length} {theses.length === 1 ? 'tesis' : 'tesis'}
        </span>
      </div>

      {theses.length ? (
        <div className="form-group">
          <label className="form-label" htmlFor="react-thesis-select">
            Tesis
          </label>
          <select
            id="react-thesis-select"
            className="form-select"
            value={thesisId ?? ''}
            onChange={(event) => setThesisId(event.target.value || null)}
            data-testid="react-thesis-select"
          >
            <option value="">Selecciona una tesis…</option>
            {theses.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title} · {option.status}
                {option.awaitingClientAction ? ' · esperando al cliente' : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="empty-state" data-testid="react-thesis-editor-empty">
          Este cliente todavía no tiene tesis registradas.
        </p>
      )}

      {thesisId === null ? (
        <p className="muted small" data-testid="react-thesis-unselected">
          Sin tesis seleccionada.
        </p>
      ) : detail.isLoading ? (
        <p className="muted" data-testid="react-thesis-detail-loading">
          Cargando tesis…
        </p>
      ) : detail.isError ? (
        <p className="muted" role="alert" data-testid="react-thesis-detail-error">
          No se pudo cargar la tesis.
        </p>
      ) : !detail.data?.resolved ? (
        /* An unknown id is an error here, never a new empty thesis. */
        <p className="muted" role="alert" data-testid="react-thesis-unresolved">
          Esa tesis no existe para este cliente. No se ha creado ninguna tesis nueva.
        </p>
      ) : (
        <div data-testid="react-thesis-detail">
          <div className="thesis-detail-head">
            <h4>{detail.data.title}</h4>
            <span className="badge" data-testid="react-thesis-status">
              {detail.data.status} · cliente: {detail.data.clientApprovalStatus}
            </span>
          </div>

          <p className="muted small">
            Completitud {detail.data.completenessScore}% · autoridad{' '}
            {detail.data.strengthScore ?? '—'} · evidencia asignada {detail.data.assignedEvidence} ·
            prioridad declarada{' '}
            {theses.find((t) => t.id === detail.data!.id)?.priority ?? '—'}
          </p>
          <CompletenessBar score={detail.data.completenessScore} />

          {detail.data.missingBlocks.length ? (
            <div className="thesis-blockers" data-testid="react-thesis-missing">
              <strong className="small">Bloques incompletos</strong>
              <ul className="small">
                {detail.data.missingBlocks.map((block) => (
                  <li key={block}>{block}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!detail.data.weightsOk ? (
            <p className="form-error small" role="alert" data-testid="react-thesis-weights">
              Los pesos de objetivos suman {detail.data.weightsTotal} y deberían sumar 100.
            </p>
          ) : null}

          {detail.data.readinessBlockers.length ? (
            <div className="thesis-blockers" data-testid="react-thesis-readiness">
              <strong className="small">Pendiente para enviar al cliente</strong>
              <ul className="small">
                {detail.data.readinessBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted small" data-testid="react-thesis-ready">
              La tesis cumple los requisitos de revisión según el dominio.
            </p>
          )}

          <div className="thesis-blocks-grid">
            <div>
              <strong className="small">Audiencias</strong>
              {detail.data.audiences.length ? (
                <ul className="small">
                  {detail.data.audiences.map((audience) => (
                    <li key={`${audience.tier}-${audience.label}`}>
                      {audience.label} · {audience.tier}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Sin audiencias declaradas.</p>
              )}
            </div>
            <div>
              <strong className="small">Territorios</strong>
              {detail.data.territories.length ? (
                <ul className="small">
                  {detail.data.territories.map((territory) => (
                    <li key={territory}>{territory}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Sin territorios declarados.</p>
              )}
            </div>
            <div>
              <strong className="small">Objetivos</strong>
              {detail.data.objectives.length ? (
                <ul className="small">
                  {detail.data.objectives.map((objective) => (
                    <li key={objective.label}>
                      {objective.label} · {objective.weight}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Sin objetivos declarados.</p>
              )}
            </div>
            <div>
              <strong className="small">Límites</strong>
              <p className="muted small">
                {detail.data.hardBlocks.length} bloqueos duros ·{' '}
                {detail.data.softAvoid.length} evitar
              </p>
            </div>
          </div>

          {detail.data.activationBlockers.length ? (
            <div className="thesis-blockers" data-testid="react-thesis-activation">
              <strong className="small">No se puede activar todavía</strong>
              <ul className="small">
                {detail.data.activationBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <ThesisReviewForm
            key={detail.data.id}
            defaults={{
              title: detail.data.title,
              expertIdentity: detail.data.expertIdentity,
              differentiator: detail.data.differentiator,
              perceptionTarget: detail.data.perceptionTarget,
            }}
          />
        </div>
      )}

      <LegacyHandoff
        actions={[
          'guardar la tesis',
          'enviarla al cliente',
          'activarla',
          'el stress-test',
          'generar propuesta con IA',
        ]}
        testId="react-thesis-editor-handoff"
      />
    </section>
  );
}
