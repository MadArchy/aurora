/**
 * SPEC-010 · legacy handoff notice (wave 3).
 *
 * Every wave-3 page keeps some action on the legacy surface, because the action's
 * legacy handler writes business state with no canonical Application use case
 * (AUDIT010-09). This component states which action is affected and gives the
 * user the way to reach it, so a blocked action is visibly delegated rather than
 * silently missing — the difference between coexistence and capability loss.
 *
 * It is presentation only: it renders text and a UI-mode switch. It performs no
 * read and no command.
 */

import { applyUiMode } from '../../mount';

export function LegacyHandoff({
  actions,
  testId,
}: {
  /** The actions that remain on the legacy surface, in the user's words. */
  actions: readonly string[];
  testId: string;
}) {
  return (
    <p className="muted small" data-testid={testId} data-legacy-handoff="true">
      {actions.length === 1
        ? `${actions[0]} se sigue haciendo en la interfaz anterior.`
        : `Estas acciones se siguen haciendo en la interfaz anterior: ${actions.join(', ')}.`}{' '}
      <button type="button" className="link-btn" onClick={() => void applyUiMode('legacy')}>
        Abrir interfaz anterior
      </button>
    </p>
  );
}

/** Shared empty/loading/error shells so every wave-3 panel declares all three states. */
export function PanelState({
  kind,
  message,
  testId,
}: {
  kind: 'loading' | 'error' | 'empty' | 'no-scope';
  message: string;
  testId: string;
}) {
  return (
    <section
      className="card"
      role={kind === 'error' ? 'alert' : undefined}
      data-testid={testId}
      data-panel-state={kind}
    >
      <p className={kind === 'empty' ? 'empty-state' : 'muted'}>{message}</p>
    </section>
  );
}
