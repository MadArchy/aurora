/**
 * SPEC-010 · PRET604-R5 — Correction C: the client article review never announces
 * "aprobado y enviado al manager" before the server confirmed the decision's writes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Outcome =
  | { status: 'local' }
  | { status: 'confirmed' }
  | { status: 'pending' }
  | { status: 'rejected'; message: string }
  | { status: 'failed'; message: string };

const events: string[] = [];
let resolveConfirmation: ((outcome: Outcome) => void) | null = null;
let reviewThrows: Error | null = null;

vi.mock('../src/services/auth', () => ({
  authService: { getCurrentUser: () => null },
}));

vi.mock('../src/services/audit', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../src/services/notifications', () => ({
  notifyManager: () => {
    events.push('notify');
    return true;
  },
}));

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  beginClientArticleReviewPersistence: () => {
    events.push('begin');
    return { since: 7 };
  },
  reviewClientArticle: (intent: { contentId: string; decision: string; title?: string }) => {
    events.push(`review:${intent.decision}`);
    if (reviewThrows) throw reviewThrows;
    return {
      content: { id: intent.contentId, clientId: 'client_a', title: intent.title || 'Draft' },
      decision: intent.decision,
      feedbackEvent: intent.decision === 'save_revision' ? { diffSummary: { added: 1, removed: 0 } } : null,
    };
  },
  confirmClientArticleReviewPersistence: (scope: { since: number }) => {
    events.push(`confirm:${scope.since}`);
    return new Promise<Outcome>((resolve) => {
      resolveConfirmation = resolve;
    });
  },
}));

vi.mock('../src/services/db', () => ({ dbService: {} }));

const ROOT = join(__dirname, '..');
const code = (path: string) =>
  readFileSync(join(ROOT, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

async function startApproval(decision: 'approve' | 'save_revision' | 'request_changes' = 'approve') {
  const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
  let settled = false;
  const pending = executionDeliveryCommands
    .reviewClientArticleConfirmed({
      requestedClientId: 'client_a',
      contentId: 'cnt_1',
      decision,
      reason: decision === 'request_changes' ? 'Más ejemplos' : undefined,
      taskId: 'task_article',
    })
    .then((result) => {
      settled = true;
      return result;
    });
  await Promise.resolve();
  await Promise.resolve();
  return { pending, isSettled: () => settled };
}

beforeEach(() => {
  events.length = 0;
  resolveConfirmation = null;
  reviewThrows = null;
  vi.resetModules();
});

describe('R4 — no visual success before server confirmation', () => {
  it('opens the persistence scope before the decision and awaits it afterwards', async () => {
    const run = await startApproval();
    expect(events).toEqual(['begin', 'review:approve', 'notify', 'confirm:7']);
    expect(run.isSettled()).toBe(false);
    resolveConfirmation?.({ status: 'confirmed' });
    const result = await run.pending;
    expect(result).toMatchObject({ ok: true, persistence: 'confirmed', message: 'Artículo aprobado y enviado al manager' });
  });

  it('a still-pending server write is reported as pending, never as sent to the manager', async () => {
    const run = await startApproval();
    resolveConfirmation?.({ status: 'pending' });
    const result = await run.pending;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.persistence).toBe('pending');
    expect(result.message).not.toMatch(/enviado al manager/i);
    expect(result.message).toMatch(/pendiente de confirmación/i);
  });

  it('local-only mode (no Firebase) keeps the original message', async () => {
    const run = await startApproval();
    resolveConfirmation?.({ status: 'local' });
    expect(await run.pending).toMatchObject({ ok: true, persistence: 'local' });
  });
});

describe('R5 — remote failures are never announced as persisted', () => {
  it('rules rejection surfaces as an error', async () => {
    const run = await startApproval();
    resolveConfirmation?.({ status: 'rejected', message: 'PERMISSION_DENIED' });
    const result = await run.pending;
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/rechazó la aprobación/);
    expect(result.message).not.toMatch(/aprobado y enviado/i);
  });

  it('network failure surfaces as an error that invites a retry', async () => {
    const run = await startApproval('request_changes');
    resolveConfirmation?.({ status: 'failed', message: 'unavailable' });
    const result = await run.pending;
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/No se pudo confirmar el rechazo/);
  });

  it('a domain error skips confirmation entirely', async () => {
    reviewThrows = new Error('Contenido no disponible');
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = await executionDeliveryCommands.reviewClientArticleConfirmed({
      requestedClientId: 'client_a',
      contentId: 'cnt_1',
      decision: 'approve',
    });
    expect(result).toEqual({ ok: false, message: 'Contenido no disponible' });
    expect(events.some((event) => event.startsWith('confirm'))).toBe(false);
  });
});

describe('R4 — React wiring', () => {
  it('the review hook awaits confirmed persistence and the portal uses that hook', () => {
    const hooks = code('src/ui/hooks/useWave3Data.ts');
    const hook = hooks.slice(hooks.indexOf('export function useReviewClientArticle'));
    expect(hook.slice(0, hook.indexOf('\n}\n'))).toMatch(/executionDeliveryCommands\.reviewClientArticleConfirmed\(/);
    const portal = code('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/useReviewClientArticle\(/);
    expect(portal).not.toMatch(/executionDeliveryCommands\.reviewClientArticle\b/);
  });
});
