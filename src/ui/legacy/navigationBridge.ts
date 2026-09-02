/**
 * SPEC-010 T-010-403 — presentation-only navigation bridge.
 *
 * Legacy islands may request top-level shell navigation; ReactAppShell is the
 * sole normal-mode authority for tab and workspace selection. This module carries
 * intents one way (legacy → React) and never stores business state.
 */

export type ShellNavigationIntent = {
  readonly tab: string;
  readonly clientId?: string;
};

type ShellNavigationListener = (intent: ShellNavigationIntent) => void;

const listeners = new Set<ShellNavigationListener>();

export function subscribeShellNavigation(listener: ShellNavigationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishShellNavigation(intent: ShellNavigationIntent): void {
  for (const listener of listeners) listener(intent);
}
