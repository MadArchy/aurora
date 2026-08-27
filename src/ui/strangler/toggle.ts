/**
 * SPEC-010 · strangler presentation toggle.
 *
 * Selects WHICH UI IMPLEMENTATION RENDERS. Nothing else.
 *
 * The toggle cannot change canonical data, business authority, tenant, actor or
 * domain state, and switching it requires no data migration — that is precisely
 * what makes it the rollback mechanism (acceptance A43, threat T-010-26).
 *
 * Default is `legacy`. React is opt-in for the whole of Phase 1: the legacy
 * application stays the served presentation until parity evidence exists, per
 * §24 step 7 and the parity gate.
 *
 * Persisted in `localStorage` as a per-browser presentation preference. This is
 * presentation state, not business state — losing it simply returns the user to
 * the legacy UI.
 */

export type UiMode = 'legacy' | 'react';

export const UI_MODE_STORAGE_KEY = 'postura_ui_mode';
export const UI_MODE_ATTRIBUTE = 'data-postura-ui';
export const DEFAULT_UI_MODE: UiMode = 'legacy';

function isUiMode(value: unknown): value is UiMode {
  return value === 'legacy' || value === 'react';
}

/** Reads the requested presentation mode. Never throws; unknown values fall back to legacy. */
export function readUiMode(): UiMode {
  try {
    const stored = localStorage.getItem(UI_MODE_STORAGE_KEY);
    return isUiMode(stored) ? stored : DEFAULT_UI_MODE;
  } catch {
    return DEFAULT_UI_MODE;
  }
}

export function writeUiMode(mode: UiMode): void {
  try {
    localStorage.setItem(UI_MODE_STORAGE_KEY, mode);
  } catch {
    // A browser that refuses storage simply gets the default on next load.
  }
}

/**
 * Publishes the active mode on the document root so exactly one presentation is
 * visible. CSS keys off this attribute; no element's own styles are mutated, so
 * legacy `innerHTML` writes cannot disturb it.
 */
export function applyUiModeAttribute(mode: UiMode): void {
  document.documentElement.setAttribute(UI_MODE_ATTRIBUTE, mode);
}
