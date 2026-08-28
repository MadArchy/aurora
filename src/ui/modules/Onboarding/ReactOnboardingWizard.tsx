/**
 * SPEC-010 · React OnboardingWizard (wave 2, T-010-205).
 *
 * Scope per the Phase-0 migration matrix, which records this component as
 * **2 compatibility reads and 0 writes**: the wizard is a form surface, and the
 * onboarding step is applied by the legacy controller (`main.ts`), which the
 * matrix lists as the owner of *all* UI-originated commands and whose extraction
 * belongs to Phase 4. Migrating this component therefore means migrating its
 * presentation and reads, not a command it never held.
 *
 * READ SOURCE: compatibility (`readOnboardingContext`). The suggested step and
 * coverage figures are computed by `domain/profileCoverage` inside the facade, so
 * no completion rule or threshold is evaluated here (threat T-010-19).
 *
 * COMMAND: none in this React surface. Persistence authority for registry #10 is
 * CR-1 Master Profile Application (canonical consumer invoked from the retained
 * legacy form via `main.ts`). Wrapping that write here remains out of this
 * component's presentation scope (AUDIT010-09 disposition `DISPLAY_ONLY_REACT`).
 *
 * Because saving is not available here, the submit control is disabled with its
 * real reason and the user is handed to the legacy wizard, which is still served.
 * The notice appears **before** any field, so nobody can type a long answer
 * believing it will be stored. Capability is preserved at system level and the
 * limitation is stated rather than hidden.
 *
 * FORMS: React Hook Form + Zod, input shape only (acceptance A13). No tenant,
 * actor or role value is present in any schema or field (acceptance A18).
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSession } from '../../providers/SessionProvider';
import { useOnboardingContext } from '../../hooks/useWave2Data';
import { applyUiMode } from '../../mount';
import { ONBOARDING_STEPS, onboardingSchemaForStep } from './onboardingStepSchemas';
import type { OnboardingContextRead } from '../../data/compatibilityReads';

type StepFields = Record<string, string>;

const PRIMARY_GOALS = [
  'Desarrollar una práctica profesional de alto valor',
  'Conseguir nuevos clientes corporativos',
  'Posicionarme como autoridad técnica y referente de opinión',
  'Conseguir invitaciones a conferencias, keynotes y paneles',
  'Acceder a juntas directivas o comités asesores',
];

const TONES = [
  { value: 'authoritative', label: 'Autoritativo y Sobrio (Rigor, análisis técnico, sin hype)' },
  { value: 'academic', label: 'Académico (Citas formales y jurisprudencia comparada)' },
  { value: 'conversational', label: 'Conversacional Directo (Claro, práctico y accesible)' },
  { value: 'provocative', label: 'Visionario / Provocador (Debates de frontera)' },
];

/** Field set per step, mirroring the legacy wizard's own step composition. */
function defaultsForStep(step: number, context: OnboardingContextRead): StepFields {
  switch (step) {
    case 1:
      return {
        displayName: context.displayName,
        profession: context.profession,
        currentRole: context.currentRole,
        company: context.company,
        selfDescription: context.selfDescription,
      };
    case 2:
      return { primaryGoal: context.primaryGoal, secondaryGoals: context.secondaryGoals };
    case 3:
      return {
        targetAudience: context.targetAudience,
        industries: context.industries,
        countries: context.countries,
      };
    case 4:
      return { education: context.education, highlights: context.highlights };
    case 5:
      return { linkedin: context.linkedin, website: context.website };
    default:
      return {
        tone: context.tone,
        topicsToAvoid: context.topicsToAvoid,
        complianceGuidelines: context.complianceGuidelines,
      };
  }
}

function StepForm({ step, context }: { step: number; context: OnboardingContextRead }) {
  const schema = onboardingSchemaForStep(step);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StepFields>({
    defaultValues: defaultsForStep(step, context),
    // Zod validates the shape of what was typed. It is not a gate on anything.
    resolver: async (values) => {
      const parsed = schema.safeParse(values);
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
  const error = (name: string) => errors[name as keyof StepFields]?.message;

  function field(name: string, label: string, kind: 'input' | 'textarea' | 'url' = 'input') {
    return (
      <div className="form-group" key={name}>
        <label className="form-label" htmlFor={`react-onb-${name}`}>
          {label}
        </label>
        {kind === 'textarea' ? (
          <textarea
            id={`react-onb-${name}`}
            className="form-textarea"
            rows={3}
            aria-invalid={error(name) ? true : undefined}
            aria-describedby={error(name) ? `react-onb-${name}-error` : undefined}
            {...register(name)}
          />
        ) : (
          <input
            id={`react-onb-${name}`}
            type={kind === 'url' ? 'url' : 'text'}
            className="form-input"
            aria-invalid={error(name) ? true : undefined}
            aria-describedby={error(name) ? `react-onb-${name}-error` : undefined}
            {...register(name)}
          />
        )}
        {error(name) ? (
          <p className="form-error" id={`react-onb-${name}-error`} role="alert">
            {error(name)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      data-testid="react-onboarding-form"
      /*
        Submitting validates the shape and reports the result. It performs no
        write, because the write has no canonical use case. This is the honest
        end of the migrated scope, not a stubbed-out save.
      */
      onSubmit={handleSubmit(() => setShapeOk(true), () => setShapeOk(false))}
    >
      {step === 1 ? (
        <>
          <h4>ONB-01: Identidad Profesional &amp; Descripción Esencial</h4>
          <div className="grid-2">
            {field('displayName', 'Nombre Completo')}
            {field('profession', 'Profesión / Especialidad')}
          </div>
          <div className="grid-2">
            {field('currentRole', 'Cargo Actual / Rol')}
            {field('company', 'Firma / Organización')}
          </div>
          {field('selfDescription', '¿Cómo describirías lo que haces profesionalmente?', 'textarea')}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h4>ONB-02: Objetivo Estratégico de Posicionamiento</h4>
          <div className="form-group">
            <label className="form-label" htmlFor="react-onb-primaryGoal">
              Objetivo Principal
            </label>
            <select id="react-onb-primaryGoal" className="form-select" {...register('primaryGoal')}>
              <option value="">Selecciona un objetivo</option>
              {PRIMARY_GOALS.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
            {error('primaryGoal') ? (
              <p className="form-error" role="alert">
                {error('primaryGoal')}
              </p>
            ) : null}
          </div>
          {field('secondaryGoals', 'Objetivos Secundarios (opcional)')}
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h4>ONB-03: Audiencia Objetivo &amp; Mercados</h4>
          {field('targetAudience', 'Descripción de tu Audiencia Primaria')}
          <div className="grid-2">
            {field('industries', 'Sectores / Industrias Clave')}
            {field('countries', 'Países / Mercados Principales')}
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <h4>ONB-04: Evidence Vault (Autoridad &amp; Credenciales Reales)</h4>
          {field('education', 'Títulos Académicos y Universidades', 'textarea')}
          {field('highlights', 'Hitos de Carrera / Casos de Éxito', 'textarea')}
        </>
      ) : null}

      {step === 5 ? (
        <>
          <h4>ONB-05: Presencia Digital &amp; Enlaces</h4>
          <div className="grid-2">
            {field('linkedin', 'Perfil de LinkedIn', 'url')}
            {field('website', 'Sitio Web / Blog Personal', 'url')}
          </div>
        </>
      ) : null}

      {step === 6 ? (
        <>
          <h4>ONB-06: Estilo de Voz &amp; Límites Deontológicos</h4>
          <div className="form-group">
            <label className="form-label" htmlFor="react-onb-tone">
              Tono de Comunicación Preferido
            </label>
            <select id="react-onb-tone" className="form-select" {...register('tone')}>
              <option value="">Sin preferencia registrada</option>
              {TONES.map((tone) => (
                <option key={tone.value} value={tone.value}>
                  {tone.label}
                </option>
              ))}
            </select>
          </div>
          {field('topicsToAvoid', 'Temas a Evitar (Límites y Compliance)')}
          {field('complianceGuidelines', 'Reglas Deontológicas Profesionales')}
        </>
      ) : null}

      <div className="onboarding-footer">
        <button
          type="submit"
          className="btn btn-secondary"
          data-testid="react-onboarding-validate"
        >
          Revisar este paso
        </button>

        {/*
          Disabled for its real reason: this React surface is presentation-only
          (AUDIT010-09 DISPLAY_ONLY_REACT). Persistence runs on the legacy form.
        */}
        <button
          type="button"
          className="btn btn-primary"
          disabled
          title="Guardar requiere la interfaz anterior (AUDIT010-09)"
          data-testid="react-onboarding-save-disabled"
        >
          Guardar
        </button>
      </div>

      {shapeOk === true ? (
        <p className="muted small" role="status" data-testid="react-onboarding-shape-ok">
          Formato correcto. Guardar sigue haciéndose en la interfaz anterior.
        </p>
      ) : null}
      {shapeOk === false ? (
        <p className="muted small" role="status" data-testid="react-onboarding-shape-bad">
          Revisa los campos marcados.
        </p>
      ) : null}
    </form>
  );
}

export function ReactOnboardingWizard() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useOnboardingContext(tenantScope);
  const [step, setStep] = useState<number | null>(null);

  if (!tenantScope) {
    return (
      <section className="card" data-testid="react-onboarding-no-scope">
        <p className="muted">Sesión sin contexto de organización — no se muestra el onboarding.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="card" data-testid="react-onboarding-loading">
        <p className="muted">Cargando onboarding…</p>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="card" role="alert" data-testid="react-onboarding-error">
        <p className="muted">No se pudo cargar el onboarding.</p>
      </section>
    );
  }

  // The domain's suggested step is the default; changing step is presentation.
  const effectiveStep = step ?? data.suggestedStep;
  const meta = ONBOARDING_STEPS[effectiveStep - 1] ?? ONBOARDING_STEPS[0];

  return (
    <section
      className="card onboarding-card"
      data-testid="react-onboarding-wizard"
      data-authority="PRESENTATION_ONLY"
    >
      <div className="card-header">
        <div>
          <div className="onboarding-step-head">
            <span className="badge badge-progress">Paso {effectiveStep} de 6</span>
            <span className="muted small">{meta.code}</span>
          </div>
          <h3>Onboarding Progresivo de Autoridad</h3>
          <p className="muted small" data-testid="react-onboarding-coverage">
            {data.totalConfirmed} facts confirmados · {data.sectionsWithFacts}/5 secciones con
            cobertura
          </p>
        </div>
      </div>

      {/* Stated before any field, so no answer is typed in the belief it will be stored. */}
      <div className="warn-strip" data-testid="react-onboarding-delegation">
        <strong>Esta vista todavía no guarda.</strong> Puedes revisar y validar el formato de cada
        paso, pero guardar el onboarding se sigue haciendo en la interfaz anterior.{' '}
        <button type="button" className="link-btn" onClick={() => void applyUiMode('legacy')}>
          Abrir interfaz anterior
        </button>
      </div>

      <div className="onboarding-coverage-grid">
        {data.coverageSections.map((section, index) => (
          <button
            type="button"
            key={section.label}
            className={`onboarding-coverage-chip ${section.complete ? 'is-complete' : ''} ${
              effectiveStep === index + 1 ? 'is-active' : ''
            }`}
            onClick={() => setStep(index + 1)}
          >
            {section.complete ? '✓' : '○'} {section.label}
          </button>
        ))}
      </div>

      <div className="onboarding-step-bar">
        {ONBOARDING_STEPS.map((s) => (
          <div
            key={s.num}
            className={`onboarding-step-segment ${s.num <= effectiveStep ? 'is-filled' : ''}`}
          />
        ))}
      </div>

      {/* Remounted per step so each step's defaults and schema apply cleanly. */}
      <StepForm key={effectiveStep} step={effectiveStep} context={data} />

      <div className="onboarding-nav">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={effectiveStep <= 1}
          onClick={() => setStep(Math.max(1, effectiveStep - 1))}
          data-testid="react-onboarding-prev"
        >
          ← Anterior
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={effectiveStep >= 6}
          onClick={() => setStep(Math.min(6, effectiveStep + 1))}
          data-testid="react-onboarding-next"
        >
          Siguiente →
        </button>
      </div>
    </section>
  );
}
