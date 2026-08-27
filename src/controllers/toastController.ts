/**
 * SPEC-010 T-010-402 — transient toast presentation extracted from `main.ts`.
 *
 * A toast is presentation only: it reports an outcome that has already been
 * decided elsewhere. This controller therefore never decides anything, never
 * persists and never notifies outside the browser tab. External notification
 * (`notifyClient` / `notifyManager`) remains a separate, gated concern in the
 * command paths that own it.
 */
import { esc } from '../lib/escape';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

/** How long a toast stays on screen. Matches the pre-extraction behaviour. */
export const TOAST_TTL_MS = 3500;

/**
 * Where rendered toasts go. The default writes to the `#toast-container` element;
 * injecting a sink lets the queue and the escaping be verified without a DOM,
 * which is one of the reasons this responsibility was worth extracting.
 */
export interface ToastSink {
  write(html: string): void;
}

const domSink: ToastSink = {
  write(html) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    container.innerHTML = html;
  },
};

export class ToastController {
  private toasts: ToastItem[] = [];

  constructor(private readonly sink: ToastSink = domSink) {}

  show(message: string, type: ToastType = 'info'): void {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9);
    this.toasts.push({ id, message, type });
    this.render();

    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
      this.render();
    }, TOAST_TTL_MS);
  }

  /**
   * Owns the `#toast-container` subtree and nothing else, so this never competes
   * with React for a mount point (SPEC-010 DOM ownership rule).
   */
  render(): void {
    this.sink.write(this.markup());
  }

  /** The rendered markup, with every message escaped. */
  markup(): string {
    return this.toasts
      .map(
        (t) => `
      <div class="toast toast-${t.type}">
        <div>${esc(t.message)}</div>
      </div>
    `,
      )
      .join('');
  }

  /** Test/inspection surface; not used by the running app. */
  peek(): readonly ToastItem[] {
    return this.toasts;
  }
}
