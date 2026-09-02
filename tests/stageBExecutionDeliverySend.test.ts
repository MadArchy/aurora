/**
 * Stage B blocker #18 — Execution Delivery send orchestration tests.
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.hoisted(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new (class {
    private store = new Map<string, string>();
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.store.set(key, value);
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
  })() as Storage;
});

import {
  ExecutionDeliveryError,
  createSendDeliveryPackage,
  type DeliverySendPort,
  type TrustedExecutionDeliveryContext,
} from '../src/application/executionDelivery';
import type { DeliveryItem, DeliveryPackage } from '../src/types';
import { composeExecutionDelivery } from '../src/composition/executionDelivery/composeExecutionDelivery';

function adminTrusted(
  overrides: Partial<TrustedExecutionDeliveryContext> = {}
): TrustedExecutionDeliveryContext {
  return {
    actorId: 'admin_01',
    actorRole: 'ADMIN',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    now: '2026-08-28T20:00:00.000Z',
    ...overrides,
  };
}

function draftPackage(overrides: Partial<DeliveryPackage> = {}): DeliveryPackage {
  return {
    id: 'pkg_1',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    title: 'Weekly briefing',
    strategicNote: '',
    periodLabel: 'week',
    status: 'DRAFT',
    createdAt: '2026-08-28T19:00:00.000Z',
    createdBy: 'admin_01',
    items: [],
    ...overrides,
  };
}

function buildPort(overrides: Partial<DeliverySendPort> = {}): DeliverySendPort {
  let marked: string[] | undefined;
  const base: DeliverySendPort = {
    getPackageById: () => draftPackage(),
    getCurationById: () => undefined,
    getThesisById: () => undefined,
    gateStrategicDownstream: () => ({ ok: false, message: 'denied' }),
    authorizeDeliveryItem: () => ({ ok: false, message: 'denied' }),
    generateContentDraft: async () => {
      throw new Error('AI should not run when denied');
    },
    saveGeneratedContent: () => {
      throw new Error('content write blocked');
    },
    addTask: () => {
      throw new Error('task write blocked');
    },
    addEvidenceItem: () => {
      throw new Error('evidence write blocked');
    },
    materializeOpportunity: () => {
      throw new Error('opportunity write blocked');
    },
    markDeliverySent(_packageId, convertedSignalIds) {
      marked = convertedSignalIds;
    },
    runInBatch(fn) {
      fn();
    },
    createContentId: () => 'cnt_test',
    ...overrides,
  };
  return {
    ...base,
    markDeliverySent(packageId, convertedSignalIds) {
      marked = convertedSignalIds;
      base.markDeliverySent(packageId, convertedSignalIds);
    },
    get marked() {
      return marked;
    },
  } as DeliverySendPort & { marked?: string[] };
}

describe('Stage B #18 SendDeliveryPackage', () => {
  it('rejects missing package', async () => {
    const send = createSendDeliveryPackage({
      delivery: buildPort({ getPackageById: () => undefined }),
    });
    await expect(
      send({ trusted: adminTrusted(), packageId: 'missing' })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects cross-tenant package reload', async () => {
    const send = createSendDeliveryPackage({
      delivery: buildPort({
        getPackageById: () => draftPackage({ clientId: 'client_other', organizationId: 'org_other' }),
      }),
    });
    await expect(send({ trusted: adminTrusted(), packageId: 'pkg_1' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });

  it('blocks send when strategic authorization fails (all-or-nothing)', async () => {
    const send = createSendDeliveryPackage({
      delivery: buildPort({
        getPackageById: () =>
          draftPackage({
            items: [{ id: 'i1', kind: 'TASK', title: 'Video', refId: 'cur_1', strategicBriefId: 'brief_1' }],
          }),
        getCurationById: () =>
          ({
            id: 'cur_1',
            clientId: 'client_ed',
            destination: 'TASK_VIDEO',
            strategicBriefId: 'brief_1',
          }) as import('../src/types').CurationEntry,
        authorizeDeliveryItem: () => ({ ok: false, message: 'Plan denied' }),
      }),
    });
    await expect(send({ trusted: adminTrusted(), packageId: 'pkg_1' })).rejects.toMatchObject({
      code: 'STRATEGIC_BRIEF_GATE_DENIED',
    });
  });

  it('does not call AI when preflight fails', async () => {
    const ai = vi.fn();
    const send = createSendDeliveryPackage({
      delivery: buildPort({
        getPackageById: () =>
          draftPackage({
            items: [{ id: 'i1', kind: 'TASK', title: 'Video', refId: 'cur_1', strategicBriefId: 'brief_1' }],
          }),
        getCurationById: () =>
          ({
            id: 'cur_1',
            clientId: 'client_ed',
            destination: 'TASK_VIDEO',
            strategicBriefId: 'brief_1',
          }) as import('../src/types').CurationEntry,
        authorizeDeliveryItem: () => ({ ok: false, message: 'denied' }),
        generateContentDraft: ai,
      }),
    });
    await expect(send({ trusted: adminTrusted(), packageId: 'pkg_1' })).rejects.toThrow();
    expect(ai).not.toHaveBeenCalled();
  });

  it('compose exposes sendDeliveryPackage', () => {
    const c = composeExecutionDelivery();
    expect(typeof c.sendDeliveryPackage).toBe('function');
    expect(Object.keys(c).sort()).toEqual([
      'reviewClientArticle',
      'saveContentDraft',
      'sendDeliveryPackage',
      'transitionClientTask',
    ]);
  });

  it('main.ts delegates sendDelivery to executionDeliveryConsumer', () => {
    const source = readFileSync(resolve('src/main.ts'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/sendDeliveryPackage\s*\(/);
    expect(code).not.toMatch(/materializeOpportunityForDelivery\s*\(/);
  });

  it('Application orchestrator has zero Brief/Plan/AI authority ownership', () => {
    const source = readFileSync(resolve('src/application/executionDelivery/SendDeliveryPackage.ts'), 'utf8');
    expect(source).not.toMatch(/approveStrategicBrief|SaveContentDraft|addOpportunity\s*\(/);
    expect(source).toMatch(/validateDeliveryForSend/);
  });
});
