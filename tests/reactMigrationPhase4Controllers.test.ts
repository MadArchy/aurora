/**
 * SPEC-010 Phase 4 (T-010-402, T-010-405) — behavioural equivalence for the
 * extracted UI orchestration.
 *
 * §27 requires per-responsibility equivalence evidence, not a line count. These
 * tests exercise the extracted modules directly and assert the behaviour the
 * legacy controller had before the move — including the awkward parts, because a
 * refactor that quietly "improves" behaviour is still a behaviour change.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppUiState, PORTFOLIO_SCOPE } from '../src/controllers/appUiState';
import { ToastController, TOAST_TTL_MS } from '../src/controllers/toastController';
import {
  resolveTabTransition,
  NOTIFICATION_HIGHLIGHT_MS,
  NOTIFICATION_SCROLL_DELAY_MS,
} from '../src/controllers/navigationController';
import { textFile } from '../src/lib/fileDownload';

describe('T-010-402 — presentation state (AppUiState)', () => {
  let ui: AppUiState;
  beforeEach(() => {
    ui = new AppUiState();
  });

  it('starts at portfolio scope on the dashboard, as the controller did', () => {
    expect(ui.activeTab).toBe('dashboard');
    expect(ui.activeClientId).toBe(PORTFOLIO_SCOPE);
    expect(ui.currentClientId()).toBeNull();
    expect(ui.activeModal).toBeNull();
  });

  it('reports no current client at portfolio scope and the client inside a workspace', () => {
    expect(ui.currentClientId()).toBeNull();
    ui.enterClient('client_a');
    expect(ui.currentClientId()).toBe('client_a');
    ui.backToPortfolio();
    expect(ui.currentClientId()).toBeNull();
  });

  it('entering a client defaults to the briefing tab unless a workspace tab is given', () => {
    ui.enterClient('client_a');
    expect(ui.activeTab).toBe('ws-briefing');

    ui.enterClient('client_b', 'ws-radar');
    expect(ui.activeTab).toBe('ws-radar');

    // A non-workspace tab is not honoured — the legacy rule, preserved.
    ui.enterClient('client_c', 'dashboard');
    expect(ui.activeTab).toBe('ws-briefing');
  });

  it('entering a client clears the previous client\u2019s filters', () => {
    ui.filterState.searchQuery = 'quantum';
    ui.filterState.topicKey = 'topic_1';
    ui.filterState.priorityBand = 'HIGH';
    ui.filterState.sourceType = 'RSS';

    ui.enterClient('client_b');

    expect(ui.filterState.searchQuery).toBe('');
    expect(ui.filterState.topicKey).toBe('');
    expect(ui.filterState.priorityBand).toBe('ALL');
    expect(ui.filterState.sourceType).toBe('ALL');
  });

  it('leaves filters that are not client-scoped alone, exactly as before', () => {
    // The legacy controller reset only these four. Resetting more would be a
    // behaviour change dressed up as tidiness.
    ui.filterState.contentSearch = 'draft';
    ui.filterState.portfolioSearch = 'acme';
    ui.filterState.contentStatus = 'CLIENT_REVIEW';
    ui.filterState.thesisId = 'thesis_1';

    ui.enterClient('client_b');

    expect(ui.filterState.contentSearch).toBe('draft');
    expect(ui.filterState.portfolioSearch).toBe('acme');
    expect(ui.filterState.contentStatus).toBe('CLIENT_REVIEW');
    expect(ui.filterState.thesisId).toBe('thesis_1');
  });

  it('returning to the portfolio restores the dashboard', () => {
    ui.enterClient('client_a', 'ws-radar');
    ui.backToPortfolio();
    expect(ui.activeClientId).toBe(PORTFOLIO_SCOPE);
    expect(ui.activeTab).toBe('dashboard');
  });

  it('opening a modal without data leaves existing modal data untouched', () => {
    // main.ts sets modalData separately before calling openModal(id); the
    // extraction must not clear it.
    ui.modalData = { clientId: 'client_a', step: 3 };
    ui.openModal('onboarding');
    expect(ui.activeModal).toBe('onboarding');
    expect(ui.modalData).toEqual({ clientId: 'client_a', step: 3 });
  });

  it('closing a modal clears both the selection and its data', () => {
    ui.openModal('thesis-editor', { thesisId: 't1' });
    ui.closeModal();
    expect(ui.activeModal).toBeNull();
    expect(ui.modalData).toBeNull();
  });

  it('holds no authority: there is no tenant, actor or permission surface', () => {
    const surface = Object.keys(ui).concat(
      Object.getOwnPropertyNames(Object.getPrototypeOf(ui))
    );
    for (const forbidden of ['organizationId', 'actorId', 'role', 'isAuthorized', 'canWrite']) {
      expect(surface).not.toContain(forbidden);
    }
  });
});

describe('T-010-402 — tab transitions (navigationController)', () => {
  it('allows a portfolio tab with no client in scope', () => {
    const result = resolveTabTransition('dashboard', null);
    expect(result).toEqual({ ok: true, tab: 'dashboard' });
  });

  it('refuses a workspace tab when no client is in scope, with the legacy message', () => {
    const result = resolveTabTransition('ws-radar', null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('CLIENT_REQUIRED');
      expect(result.message).toBe('Entra primero a un cliente desde la cartera.');
    }
  });

  it('allows a workspace tab once a client is in scope', () => {
    const result = resolveTabTransition('ws-radar', 'client_a');
    expect(result).toEqual({ ok: true, tab: 'ws-radar' });
  });

  it('applies the legacy tab aliases', () => {
    // Aliases exist so old links keep working; the transition must resolve them
    // rather than activating a tab id that no longer renders anything.
    expect(resolveTabTransition('ws-curation', 'client_a')).toEqual({ ok: true, tab: 'ws-deliver' });
    expect(resolveTabTransition('ws-tasks', 'client_a')).toEqual({ ok: true, tab: 'ws-production' });
    expect(resolveTabTransition('client-feed', null)).toEqual({ ok: true, tab: 'client-home' });
  });

  it('resolves an alias before applying the workspace guard, not after', () => {
    // 'ws-results' aliases to 'ws-briefing', a workspace tab. If the guard ran on
    // the raw string the refusal could be skipped, so order matters.
    const result = resolveTabTransition('ws-results', null);
    expect(result.ok).toBe(false);
  });

  it('is a pure decision that needs no DOM at all', () => {
    // This suite runs in the node environment: there is no document here. The
    // legacy equivalent was a method on a DOM-driven controller and could not
    // have been called like this.
    expect(typeof document).toBe('undefined');
    expect(resolveTabTransition('ws-radar', null).ok).toBe(false);
    expect(resolveTabTransition('ws-radar', 'client_a').ok).toBe(true);
  });

  it('keeps the legacy scroll and highlight timings', () => {
    expect(NOTIFICATION_SCROLL_DELAY_MS).toBe(150);
    expect(NOTIFICATION_HIGHLIGHT_MS).toBe(4000);
  });
});

describe('T-010-402 — toasts (ToastController)', () => {
  /** Captures what would have been written to `#toast-container`. */
  const recordingSink = () => {
    const writes: string[] = [];
    return { writes, write: (html: string) => writes.push(html) };
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders the message and its type', () => {
    const sink = recordingSink();
    new ToastController(sink).show('Guardado', 'success');

    expect(sink.writes).toHaveLength(1);
    expect(sink.writes[0]).toContain('toast-success');
    expect(sink.writes[0]).toContain('Guardado');
  });

  it('defaults to info, matching the legacy signature', () => {
    const sink = recordingSink();
    new ToastController(sink).show('Nota');
    expect(sink.writes[0]).toContain('toast-info');
  });

  it('removes a toast after the legacy lifetime and re-renders empty', () => {
    const sink = recordingSink();
    const toasts = new ToastController(sink);
    toasts.show('Temporal');
    expect(toasts.peek()).toHaveLength(1);

    vi.advanceTimersByTime(TOAST_TTL_MS);

    expect(toasts.peek()).toHaveLength(0);
    expect(sink.writes.at(-1)).toBe('');
  });

  it('escapes the message, so a toast cannot inject markup', () => {
    const sink = recordingSink();
    new ToastController(sink).show('<img src=x onerror=alert(1)>');

    expect(sink.writes[0]).not.toContain('<img');
    expect(sink.writes[0]).toContain('&lt;img');
  });

  it('stacks concurrent toasts and expires them independently', () => {
    const toasts = new ToastController(recordingSink());
    toasts.show('Primero');
    vi.advanceTimersByTime(TOAST_TTL_MS / 2);
    toasts.show('Segundo');

    expect(toasts.peek()).toHaveLength(2);

    vi.advanceTimersByTime(TOAST_TTL_MS / 2);
    expect(toasts.peek().map((t) => t.message)).toEqual(['Segundo']);
  });

  it('owns only the toast container in its DOM sink', async () => {
    const source = (await import('node:fs')).readFileSync('src/controllers/toastController.ts', 'utf8');
    expect(source).toMatch(/getElementById\('toast-container'\)/);
    expect(source).not.toMatch(/getElementById\('app'\)|react-root/);
  });
});

describe('T-010-405 — UI logic left the domain-adjacent services', () => {
  it('a text file is built without touching the DOM', async () => {
    // No document exists in this environment, so building the file cannot have
    // used one — which is the point of the extraction.
    expect(typeof document).toBe('undefined');

    const file = textFile('dossier-acme-3.md', '# Dossier', 'text/markdown;charset=utf-8');

    expect(file.filename).toBe('dossier-acme-3.md');
    expect(file.blob.type).toBe('text/markdown;charset=utf-8');
    expect(await file.blob.text()).toBe('# Dossier');
  });

  it('the dossier service builds the export without driving a download', async () => {
    const module = await import('../src/services/dossierExport');
    expect(typeof module.buildDossierExport).toBe('function');

    const source = (await import('node:fs')).readFileSync('src/services/dossierExport.ts', 'utf8');
    // The service may still offer the convenience wrapper, but the DOM work must
    // not live here any more.
    expect(source).not.toMatch(/document\.createElement/);
    expect(source).toMatch(/from '\.\.\/lib\/fileDownload'/);
  });

  it('the recordings service no longer creates an anchor', async () => {
    const source = (await import('node:fs')).readFileSync('src/services/recordings.ts', 'utf8');
    expect(source).not.toMatch(/document\.createElement/);
    expect(source).toMatch(/downloadFile\(/);
  });

  it('there is exactly one DOM-driven download in src/', async () => {
    const { readdirSync, statSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (/\.tsx?$/.test(entry)) out.push(full);
      }
      return out;
    };
    const offenders = walk('src').filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /\.download\s*=/.test(source) && !file.replace(/\\/g, '/').endsWith('src/lib/fileDownload.ts');
    });
    expect(offenders.map((f) => f.replace(/\\/g, '/'))).toEqual([]);
  });
});
