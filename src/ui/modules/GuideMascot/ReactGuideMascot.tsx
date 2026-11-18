/**
 * Aura — guía flotante paso a paso con navegación y señalización en pantalla.
 */

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { applyGuideCoach, clearGuideCoach, type CoachApplyResult } from './guideCoach';
import {
  getStep,
  getTour,
  GUIDE_TOURS,
  matchTourFromQuestion,
  stepProgress,
  suggestToursForUnknown,
  type GuideStep,
  type GuideTour,
} from './guideTours';

function AuraFace({ excited }: { excited: boolean }) {
  return (
    <svg className="guide-mascot-face" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="auraBody" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#7ee0d4" />
          <stop offset="55%" stopColor="#2d9e94" />
          <stop offset="100%" stopColor="#1f6f6a" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#auraBody)" />
      <ellipse cx="22" cy="28" rx="6" ry="7" fill="#0a1214" />
      <ellipse cx="42" cy="28" rx="6" ry="7" fill="#0a1214" />
      <circle cx="24" cy="27" r="2" fill="#eef3f4" />
      <circle cx="44" cy="27" r="2" fill="#eef3f4" />
      <path
        d={excited ? 'M22 40c3.5 6 16.5 6 20 0' : 'M24 40c2.8 3.8 12.2 3.8 16 0'}
        fill="none"
        stroke="#0a1214"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <ellipse cx="14" cy="36" rx="4" ry="2.5" fill="#f0b4a0" opacity="0.55" />
      <ellipse cx="50" cy="36" rx="4" ry="2.5" fill="#f0b4a0" opacity="0.55" />
    </svg>
  );
}

type GuideMode =
  | { kind: 'menu' }
  | { kind: 'tour'; tourId: string; stepId: string };

function audienceLabel(audience: GuideTour['audience']): string {
  if (audience === 'cliente') return 'Para clientes';
  if (audience === 'manager') return 'Para managers';
  return 'Para todos';
}

function coachStatusText(result: CoachApplyResult | null): string | null {
  if (!result || result.kind === 'none') return null;
  if (result.kind === 'highlighted') return `Señal en pantalla: ${result.label}`;
  return `No encontré esa zona. Señal en el menú: ${result.label}`;
}

export function ReactGuideMascot() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<GuideMode>({ kind: 'menu' });
  const [input, setInput] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [suggestedTourIds, setSuggestedTourIds] = useState<readonly string[]>([]);
  const [coachResult, setCoachResult] = useState<CoachApplyResult | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const coachRunId = useRef(0);

  const activeTour = mode.kind === 'tour' ? getTour(mode.tourId) : undefined;
  const activeStep: GuideStep | undefined =
    activeTour && mode.kind === 'tour' ? getStep(activeTour, mode.stepId) : undefined;
  const progress =
    activeTour && mode.kind === 'tour' ? stepProgress(activeTour, mode.stepId) : null;

  useEffect(() => {
    if (!open) return;
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode.kind !== 'tour' || !activeStep) {
      clearGuideCoach();
      setCoachResult(null);
      return;
    }

    const runId = ++coachRunId.current;
    let cancelled = false;

    void (async () => {
      const result = await applyGuideCoach(activeStep.coach);
      if (cancelled || runId !== coachRunId.current) return;
      setCoachResult(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, mode, activeStep]);

  useEffect(() => {
    return () => {
      clearGuideCoach();
    };
  }, []);

  const closePanel = () => {
    clearGuideCoach();
    setCoachResult(null);
    setOpen(false);
  };

  const startTour = (tourId: string) => {
    const tour = getTour(tourId);
    if (!tour) return;
    setHint(null);
    setSuggestedTourIds([]);
    setMode({ kind: 'tour', tourId: tour.id, stepId: tour.firstStepId });
    setOpen(true);
  };

  const goMenu = () => {
    clearGuideCoach();
    setCoachResult(null);
    setHint(null);
    setSuggestedTourIds([]);
    setMode({ kind: 'menu' });
  };

  const followChoice = (nextStepId: string) => {
    if (nextStepId === '__menu') {
      goMenu();
      return;
    }
    if (nextStepId.startsWith('__tour:')) {
      startTour(nextStepId.slice('__tour:'.length));
      return;
    }
    if (mode.kind !== 'tour') return;
    setMode({ kind: 'tour', tourId: mode.tourId, stepId: nextStepId });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;

    const tourId = matchTourFromQuestion(question);
    setInput('');
    if (tourId) {
      startTour(tourId);
      return;
    }

    const suggestions = suggestToursForUnknown(question)
      .map((id) => getTour(id))
      .filter((tour): tour is GuideTour => Boolean(tour));

    setHint(
      'No estoy segura de esa pregunta. Elige una de estas opciones cercanas, o mira el menú completo.'
    );
    setSuggestedTourIds(suggestions.map((tour) => tour.id));
    clearGuideCoach();
    setCoachResult(null);
    setMode({ kind: 'menu' });
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') closePanel();
  };

  const signalText = coachStatusText(coachResult);

  return (
    <div className={`guide-mascot ${open ? 'is-open' : ''}`} data-testid="guide-mascot">
      {open ? (
        <section
          id={panelId}
          className="guide-mascot-panel"
          role="dialog"
          aria-label="Aura, guía de POSTURA"
          aria-modal="false"
        >
          <header className="guide-mascot-header">
            <div className="guide-mascot-header-identity">
              <AuraFace excited />
              <div>
                <p className="guide-mascot-name">Aura</p>
                <p className="guide-mascot-tag">
                  {activeTour ? activeTour.title : 'Te guío paso a paso'}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="guide-mascot-close"
              aria-label="Cerrar guía"
              onClick={closePanel}
            >
              ×
            </button>
          </header>

          {progress ? (
            <p className="guide-mascot-progress" aria-live="polite">
              Paso {progress.current} de {progress.total}
            </p>
          ) : null}

          <div className="guide-mascot-body" ref={bodyRef}>
            {mode.kind === 'menu' ? (
              <>
                <div className="guide-mascot-bubble guide-mascot-bubble--aura">
                  <p>Hola, soy Aura.</p>
                  <p>
                    Elige un proceso. En cada paso intento llevarte a la pantalla correcta e
                    iluminar la zona de la que hablamos.
                  </p>
                </div>

                {hint ? (
                  <div className="guide-mascot-bubble guide-mascot-bubble--aura guide-mascot-bubble--hint">
                    <p>{hint}</p>
                  </div>
                ) : null}

                {suggestedTourIds.length > 0 ? (
                  <div className="guide-mascot-paths" aria-label="Sugerencias para tu pregunta">
                    {suggestedTourIds.map((id) => {
                      const tour = getTour(id);
                      if (!tour) return null;
                      return (
                        <button
                          key={tour.id}
                          type="button"
                          className="guide-mascot-path"
                          onClick={() => startTour(tour.id)}
                        >
                          <span className="guide-mascot-path-title">{tour.title}</span>
                          <span className="guide-mascot-path-sub">{tour.subtitle}</span>
                          <span className="guide-mascot-path-audience">
                            {audienceLabel(tour.audience)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="guide-mascot-paths" aria-label="Recorridos guiados">
                  {GUIDE_TOURS.map((tour) => (
                    <button
                      key={tour.id}
                      type="button"
                      className="guide-mascot-path"
                      onClick={() => startTour(tour.id)}
                    >
                      <span className="guide-mascot-path-title">{tour.title}</span>
                      <span className="guide-mascot-path-sub">{tour.subtitle}</span>
                      <span className="guide-mascot-path-audience">{audienceLabel(tour.audience)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : activeStep ? (
              <>
                <div className="guide-mascot-bubble guide-mascot-bubble--aura">
                  <p>{activeStep.say}</p>
                </div>

                {activeStep.doNow ? (
                  <div className="guide-mascot-donow" role="note">
                    <span className="guide-mascot-donow-label">Haz esto ahora</span>
                    <p>{activeStep.doNow}</p>
                  </div>
                ) : null}

                {signalText ? (
                  <p className="guide-mascot-signal" aria-live="polite">
                    {signalText}
                  </p>
                ) : null}

                <div className="guide-mascot-choices" aria-label="Siguiente paso">
                  {activeStep.choices.map((choice) => (
                    <button
                      key={`${activeStep.id}-${choice.label}`}
                      type="button"
                      className="guide-mascot-choice"
                      onClick={() => followChoice(choice.nextStepId)}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>

                <button type="button" className="guide-mascot-linkish" onClick={goMenu}>
                  ← Volver al menú de recorridos
                </button>
              </>
            ) : (
              <div className="guide-mascot-bubble guide-mascot-bubble--aura">
                <p>Ese paso ya no está. Volvamos al menú.</p>
                <button type="button" className="guide-mascot-choice" onClick={goMenu}>
                  Ir al menú
                </button>
              </div>
            )}
          </div>

          <form className="guide-mascot-form" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor={`${panelId}-input`}>
              Pregunta simple a Aura
            </label>
            <input
              id={`${panelId}-input`}
              ref={inputRef}
              className="guide-mascot-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ej: cómo uso el radar"
              autoComplete="off"
            />
            <button type="submit" className="guide-mascot-send" disabled={!input.trim()}>
              Ir
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className="guide-mascot-fab"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? 'Cerrar guía Aura' : 'Abrir guía Aura'}
        onClick={() => {
          if (open) closePanel();
          else setOpen(true);
        }}
      >
        <span className="guide-mascot-fab-pulse" aria-hidden="true" />
        <AuraFace excited={open} />
        <span className="guide-mascot-fab-label">Aura</span>
      </button>
    </div>
  );
}
