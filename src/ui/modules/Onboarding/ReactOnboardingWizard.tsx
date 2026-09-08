/**
 * SPEC-010 · React OnboardingWizard (wave 2 + P6 #10 write parity).
 *
 * Authority: presentation only.
 *
 * READ SOURCE: compatibility (`readOnboardingContext`).
 *
 * COMMAND: #10 ApplyOnboardingStep via `masterProfileCommands.applyOnboardingStep`.
 * Form field names map to frozen canonical write keys before the seam call.
 *
 * Post-complete thesis hop: presentation-owned navigation to `client-thesis`
 * after canonical `completed` (no AI generateProposal; no #11/#12/#13 writes).
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSession } from '../../providers/SessionProvider';
import { useApplyOnboardingStep, useOnboardingContext } from '../../hooks/useWave2Data';
import { publishShellNavigation } from '../../legacy/navigationBridge';
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

/**
 * Map presentation field names → frozen ApplyOnboardingStep write keys.
 * Presentation owns labels; Application owns persistence keys.
 */
function toCanonicalFields(step: number, values: StepFields): Record<string, string> {
  const trim = (key: string) => (values[key] ?? '').trim();
  if (step === 1) {
    return {
      displayName: trim('displayName'),
      selfDescription: trim('selfDescription'),
      profession: trim('profession'),
      role: trim('currentRole'),
      company: trim('company'),
    };
  }
  if (step === 2) {
    return {
      primaryGoal: trim('primaryGoal'),
      secondaryGoals: trim('secondaryGoals'),
    };
  }
  if (step === 3) {
    return {
      targetAudience: trim('targetAudience'),
      industries: trim('industries'),
      countries: trim('countries'),
    };
  }
  if (step === 4) {
    return {
      education: trim('education'),
      highlights: trim('highlights'),
    };
  }
  if (step === 5) {
    return {
      linkedin: trim('linkedin'),
      website: trim('website'),
    };
  }
  return {
    tone: trim('tone'),
    avoid: trim('topicsToAvoid'),
    compliance: trim('complianceGuidelines'),
  };
}

function StepForm({
  step,
  context,
  busy,
  onSave,
}: {
  step: number;
  context: OnboardingContextRead;
  busy: boolean;
  onSave: (fields: Record<string, string>) => void;
}) {
  const schema = onboardingSchemaForStep(step);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StepFields>({
    defaultValues: defaultsForStep(step, context),
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

  const runSave = () => {
    void handleSubmit(
      (values) => {
        setShapeOk(true);
        onSave(toCanonicalFields(step, values));
      },
      () => setShapeOk(false)
    )();
  };

  return (
    <form
      data-testid="react-onboarding-form"
      data-onboarding-step={step}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit(
          () => setShapeOk(true),
          () => setShapeOk(false)
        )();
      }}
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
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          data-testid="react-onboarding-save"
          onClick={runSave}
        >
          {step === 6 ? 'Finalizar y crear tesis' : 'Guardar y continuar'}
        </button>
      </div>

      {shapeOk === true ? (
        <p className="muted small" role="status" data-testid="react-onboarding-shape-ok">
          Formato correcto.
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
  const applyStep = useApplyOnboardingStep(tenantScope);
  const [step, setStep] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

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

  const effectiveStep = step ?? data.suggestedStep;
  const meta = ONBOARDING_STEPS[effectiveStep - 1] ?? ONBOARDING_STEPS[0];

  const handleSave = (fields: Record<string, string>) => {
    setStatusMessage(null);
    applyStep.mutate(
      { step: effectiveStep, fields },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setStatusMessage({
              kind: 'error',
              text: result.message || 'No se pudo guardar el onboarding',
            });
            return;
          }
          if (result.completed) {
            setStatusMessage({
              kind: 'success',
              text: result.message || 'Onboarding completado. Abriendo propuesta de tesis…',
            });
            // Presentation hop only — no AI generateProposal, no #11/#12/#13 writes.
            publishShellNavigation({ tab: 'client-thesis' });
            return;
          }
          setStatusMessage({ kind: 'success', text: 'Paso guardado.' });
          setStep(Math.min(6, effectiveStep + 1));
        },
        onError: () => {
          setStatusMessage({ kind: 'error', text: 'No se pudo guardar el onboarding' });
        },
      }
    );
  };

  return (
    <section
      className="card onboarding-card"
      data-testid="react-onboarding-wizard"
      data-authority="PRESENTATION"
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

      <div className="onboarding-coverage-grid">
        {data.coverageSections.map((section, index) => (
          <button
            type="button"
            key={section.label}
            className={`onboarding-coverage-chip ${section.complete ? 'is-complete' : ''} ${
              effectiveStep === index + 1 ? 'is-active' : ''
            }`}
            onClick={() => {
              setStep(index + 1);
              setStatusMessage(null);
            }}
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

      <StepForm
        key={effectiveStep}
        step={effectiveStep}
        context={data}
        busy={applyStep.isPending}
        onSave={handleSave}
      />

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'error' ? 'form-error' : 'form-success'}
          role="status"
          data-testid={
            statusMessage.kind === 'error' ? 'react-onboarding-error-msg' : 'react-onboarding-success'
          }
        >
          {statusMessage.text}
        </p>
      ) : null}

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
