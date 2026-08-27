/**
 * SPEC-010 · React mount seam (§24 step 1).
 *
 * OWNERSHIP CONTRACT
 *
 *   #app        legacy controller owns this subtree exclusively
 *   #react-root React owns this subtree exclusively
 *
 * The containers are siblings in `index.html`. React never renders into #app and
 * the legacy controller never writes into #react-root, so the two owners cannot
 * collide (threat T-010-24). A legacy `innerHTML` replacement of #app cannot
 * destroy an active React root, and React never hydrates over a legacy subtree.
 *
 * MOUNT     creates the root once and renders the React shell into it.
 * UNMOUNT   unmounts the root, releasing React listeners and query
 *           subscriptions, and leaves #react-root empty — the declared empty
 *           state. The legacy UI is untouched throughout and remains operational,
 *           so unmounting is a complete rollback with no data migration.
 *
 * Mounting is idempotent: repeated calls do not create a second root.
 */

import './strangler/strangler.css';
import { applyUiModeAttribute, readUiMode, writeUiMode, type UiMode } from './strangler/toggle';

export const REACT_ROOT_ID = 'react-root';
export const LEGACY_ROOT_ID = 'app';

type ReactRootHandle = { unmount(): void };

let activeRoot: ReactRootHandle | null = null;

function reactContainer(): HTMLElement | null {
  return document.getElementById(REACT_ROOT_ID);
}

/** True when a React root is currently mounted. */
export function isReactMounted(): boolean {
  return activeRoot !== null;
}

/**
 * Mounts the React shell. Dynamic import keeps React out of the legacy startup
 * path, so a browser running in legacy mode never downloads or executes it.
 */
export async function mountReactShell(): Promise<boolean> {
  if (activeRoot) return true;

  const container = reactContainer();
  if (!container) return false;

  const [{ createRoot }, { createShellElement }] = await Promise.all([
    import('react-dom/client'),
    import('./shell/AppRoot'),
  ]);

  const root = createRoot(container);
  root.render(createShellElement());
  activeRoot = root;
  return true;
}

/** Unmounts the React shell and restores #react-root to its declared empty state. */
export function unmountReactShell(): void {
  if (!activeRoot) return;
  activeRoot.unmount();
  activeRoot = null;

  const container = reactContainer();
  if (container) container.innerHTML = '';
}

/**
 * Applies a presentation mode: publishes it, persists it, and mounts or unmounts
 * React accordingly. Canonical business state is never read or written here.
 */
export async function applyUiMode(mode: UiMode): Promise<void> {
  writeUiMode(mode);
  applyUiModeAttribute(mode);

  if (mode === 'react') {
    const mounted = await mountReactShell();
    if (!mounted) {
      // No container: fail closed to the legacy presentation rather than
      // leaving the user with nothing rendered.
      applyUiModeAttribute('legacy');
      writeUiMode('legacy');
    }
    return;
  }

  unmountReactShell();
}

/**
 * Boot entry called once by the legacy bootstrap.
 *
 * In legacy mode this only publishes the attribute — React is never imported.
 */
export async function initReactStrangler(): Promise<void> {
  const mode = readUiMode();
  applyUiModeAttribute(mode);
  if (mode === 'react') await applyUiMode('react');
}

/** Exposed for the E2E harness and manual rollback verification. */
export function exposeStranglerControls(): void {
  (window as unknown as Record<string, unknown>).__posturaUi = {
    applyUiMode,
    readUiMode,
    isReactMounted,
    REACT_ROOT_ID,
    LEGACY_ROOT_ID,
  };
}
