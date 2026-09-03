/**
 * SPEC-010 T-010-402 — navigation transition rules extracted from `main.ts`.
 *
 * Navigation is presentation: it decides what is on screen, never what is true.
 * These functions are pure — they return a decision and the caller performs the
 * effects (render, toast, audit) — so navigation can be tested without a DOM and
 * cannot acquire authority by accident.
 *
 * SPEC-010 routing decision remains **NONE**: there is no URL involvement here,
 * and this module does not read or write `location`/`history`. Adding a router
 * would create a second navigation authority during legacy/React coexistence.
 */
import { isWorkspaceTab, normalizeTab } from '../ui/presentation/pageTabMeta';

export type TabTransition =
  | { ok: true; tab: string }
  | { ok: false; reason: 'CLIENT_REQUIRED'; message: string };

/**
 * A workspace tab is meaningless without a client in scope, so the transition is
 * refused rather than silently showing an empty workspace.
 */
export function resolveTabTransition(requested: string, currentClientId: string | null): TabTransition {
  const target = normalizeTab(requested);
  if (isWorkspaceTab(target) && !currentClientId) {
    return {
      ok: false,
      reason: 'CLIENT_REQUIRED',
      message: 'Entra primero a un cliente desde la cartera.',
    };
  }
  return { ok: true, tab: target };
}

/** Delay before scrolling to a deep-linked item, so the tab has rendered first. */
export const NOTIFICATION_SCROLL_DELAY_MS = 150;
/** How long a deep-linked item stays highlighted. */
export const NOTIFICATION_HIGHLIGHT_MS = 4000;

/**
 * Resolves the element a notification points at. Returned rather than scrolled so
 * the caller keeps ownership of the DOM effect.
 */
export function findNotificationTarget(targetId: string): Element | null {
  return (
    document.getElementById(`client-task-${targetId}`) ||
    document.querySelector(`[data-task-id="${targetId}"]`)
  );
}
