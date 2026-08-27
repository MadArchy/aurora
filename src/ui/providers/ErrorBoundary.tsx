/**
 * SPEC-010 · React island error boundary.
 *
 * A React failure must stay a presentation failure: it cannot corrupt canonical
 * state, delete the legacy fallback, change authority or trigger a strategic
 * action. The boundary therefore renders a controlled recovery surface and
 * offers a return to the legacy presentation — it never retries a command and
 * never writes anything.
 *
 * Raw infrastructure internals are not presented as authority: the message is
 * shown as diagnostic text only, with no stack trace and no adapter payload.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
  readonly onFallbackToLegacy?: () => void;
}

interface State {
  readonly error: Error | null;
}

export class UiErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Diagnostic only. No canonical state is touched and no command is retried.
    console.error('[SPEC-010] React island failed', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="card" role="alert" data-testid="react-error-boundary">
        <h2>La interfaz React no pudo renderizarse</h2>
        <p className="muted">
          El estado del negocio no se modificó. Puedes volver a la interfaz anterior sin perder datos.
        </p>
        <p className="muted small">{error.message}</p>
        {this.props.onFallbackToLegacy ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={this.props.onFallbackToLegacy}
            data-testid="react-error-fallback"
          >
            Volver a la interfaz anterior
          </button>
        ) : null}
      </div>
    );
  }
}
