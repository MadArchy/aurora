/**
 * CR-1 Wave B7 — #19 AcknowledgeDelivery + role reachability architecture guards.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  createAcknowledgeDelivery,
  type DeliveryAcknowledgementPersistencePort,
  type DeliveryAssemblyRepositoryPort,
  type TrustedExecutionDeliveryContext,
} from '../src/application/executionDelivery';
import type { DeliveryPackage } from '../src/types';
import { composeExecutionDelivery } from '../src/composition/executionDelivery/composeExecutionDelivery';
import { renderDeliveryBriefingCard } from '../src/components/ClientPortal';
import { authService } from '../src/services/auth';
import { auditService } from '../src/services/audit';
import { dbService } from '../src/services/db';
import {
  acknowledgeDelivery as acknowledgeDeliveryConsumer,
  resetExecutionDeliveryConsumerForTest,
} from '../src/services/executionDeliveryConsumer';
function clientTrusted(
  overrides: Partial<TrustedExecutionDeliveryContext> = {}
): TrustedExecutionDeliveryContext {
  return {
    actorId: 'client_01',
    actorRole: 'CLIENT',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    now: '2026-08-28T22:00:00.000Z',
    ...overrides,
  };
}

function baseDeliveryPackage(overrides: Partial<DeliveryPackage> = {}): DeliveryPackage {
  return {
    id: 'pkg_b7_1',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    title: 'Briefing test',
    strategicNote: 'Strategic note',
    periodLabel: 'Aug 2026',
    items: [{ id: 'ditem_1', kind: 'ADVICE', title: 'Advice item', rationale: 'Because' }],
    status: 'SENT',
    createdAt: '2026-08-28T20:00:00.000Z',
    createdBy: 'admin_01',
    sentAt: '2026-08-28T21:00:00.000Z',
    ...overrides,
  };
}

function memoryB7Ports(options: { pkg?: DeliveryPackage | null } = {}) {
  const store = options.pkg
    ? [
        {
          ...options.pkg,
          items: options.pkg.items.map((item) => ({ ...item })),
        },
      ]
    : [];
  let markCalls = 0;

  const assembly: Pick<DeliveryAssemblyRepositoryPort, 'getPackageById'> = {
    getPackageById(id) {
      const pkg = store.find((row) => row.id === id);
      return pkg ? { ...pkg, items: pkg.items.map((item) => ({ ...item })) } : undefined;
    },
  };

  const acknowledgement: DeliveryAcknowledgementPersistencePort = {
    markAcknowledged(packageId, input) {
      const pkg = store.find((row) => row.id === packageId);
      if (!pkg) return null;
      if (pkg.status !== 'SENT') {
        throw new Error(`DELIVERY_INVALID_TRANSITION:${pkg.status}->ACKNOWLEDGED`);
      }
      markCalls += 1;
      pkg.status = 'ACKNOWLEDGED';
      pkg.acknowledgedAt = input.acknowledgedAt;
      if (input.clientAckNote?.trim()) pkg.clientAckNote = input.clientAckNote.trim();
      return { ...pkg, items: pkg.items.map((item) => ({ ...item })) };
    },
  };

  return {
    acknowledge: createAcknowledgeDelivery({ assembly, acknowledgement }),
    getStore: () => store,
    getMarkCalls: () => markCalls,
  };
}

function setupClientGate(clientId = 'client_ed', organizationId = 'org_ed') {
  vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
    uid: 'client_01',
    email: 'c@x.com',
    displayName: 'Client',
    role: 'CLIENT',
    status: 'ACTIVE',
    organizationId,
    clientId,
    mustCompleteOnboarding: false,
    aiKeyManagementAllowed: false,
    locale: 'es',
    timezone: 'UTC',
  } as ReturnType<typeof authService.getCurrentUser>);
  vi.spyOn(dbService, 'getClientById').mockReturnValue({
    id: clientId,
    organizationId,
    displayName: 'Client ED',
  } as ReturnType<typeof dbService.getClientById>);
}

function setupAdminGate(clientId = 'client_ed', organizationId = 'org_ed') {
  vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
    uid: 'admin_01',
    email: 'a@x.com',
    displayName: 'Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    organizationId,
    clientId: null,
    mustCompleteOnboarding: false,
    aiKeyManagementAllowed: false,
    locale: 'es',
    timezone: 'UTC',
  } as ReturnType<typeof authService.getCurrentUser>);
  vi.spyOn(dbService, 'getClientById').mockReturnValue({
    id: clientId,
    organizationId,
  } as ReturnType<typeof dbService.getClientById>);
}

describe('CR-1 Wave B7 #19 — AcknowledgeDelivery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetExecutionDeliveryConsumerForTest();
  });

  it('normal CLIENT success — authoritative reload, SENT→ACKNOWLEDGED, trusted timestamp, optional note', () => {
    const ports = memoryB7Ports({ pkg: baseDeliveryPackage() });
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    const result = ports.acknowledge({
      trusted: clientTrusted(),
      packageId: 'pkg_b7_1',
      clientAckNote: '  Reviso el jueves  ',
    });
    expect(result).toEqual({ ok: true, packageId: 'pkg_b7_1', clientId: 'client_ed' });
    const stored = ports.getStore()[0];
    expect(stored.status).toBe('ACKNOWLEDGED');
    expect(stored.acknowledgedAt).toBe('2026-08-28T22:00:00.000Z');
    expect(stored.clientAckNote).toBe('Reviso el jueves');
    expect(stored.sentAt).toBe('2026-08-28T21:00:00.000Z');
    expect(stored.title).toBe('Briefing test');
    expect(stored.strategicNote).toBe('Strategic note');
    expect(stored.organizationId).toBe('org_ed');
    expect(stored.clientId).toBe('client_ed');
    expect(stored.createdBy).toBe('admin_01');
    expect(stored.items).toHaveLength(1);
    expect(ports.getMarkCalls()).toBe(1);
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it('empty clientAckNote leaves clientAckNote unset', () => {
    const ports = memoryB7Ports({ pkg: baseDeliveryPackage({ clientAckNote: undefined }) });
    ports.acknowledge({ trusted: clientTrusted(), packageId: 'pkg_b7_1', clientAckNote: '   ' });
    expect(ports.getStore()[0].clientAckNote).toBeUndefined();
  });

  it('missing package — write 0 compat DELIVERY_NOT_FOUND', () => {
    const ports = memoryB7Ports({ pkg: null });
    const result = ports.acknowledge({ trusted: clientTrusted(), packageId: 'missing' });
    expect(result).toEqual({ ok: false, compat: 'DELIVERY_NOT_FOUND' });
    expect(ports.getMarkCalls()).toBe(0);
  });

  it('CLIENT wrong client and cross-tenant deny write', () => {
    setupClientGate('client_ed', 'org_ed');
    const ports = memoryB7Ports({
      pkg: baseDeliveryPackage({ clientId: 'other_client', organizationId: 'org_other' }),
    });
    expect(() =>
      ports.acknowledge({ trusted: clientTrusted(), packageId: 'pkg_b7_1' })
    ).toThrow(/trusted client entitlement/);
    expect(ports.getMarkCalls()).toBe(0);

    expect(() =>
      ports.acknowledge({
        trusted: clientTrusted({ organizationId: 'org_other' }),
        packageId: 'pkg_b7_1',
        claimedOrganizationId: 'org_ed',
      })
    ).toThrow(/Caller-supplied organizationId does not match trusted session organization/);
  });

  it('bare ADMIN and missing session deny write', () => {
    setupAdminGate();
    expect(() =>
      acknowledgeDeliveryConsumer({ requestedClientId: 'client_ed', packageId: 'pkg_b7_1' })
    ).toThrow(/CLIENT role/);

    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    expect(() =>
      acknowledgeDeliveryConsumer({ requestedClientId: 'client_ed', packageId: 'pkg_b7_1' })
    ).toThrow(/Sesión no disponible/);
  });

  it('invalid transition DRAFT and ACKNOWLEDGED — persistence 0, existing failure', () => {
    const draftPorts = memoryB7Ports({ pkg: baseDeliveryPackage({ status: 'DRAFT' }) });
    expect(() =>
      draftPorts.acknowledge({ trusted: clientTrusted(), packageId: 'pkg_b7_1' })
    ).toThrow(/DELIVERY_INVALID_TRANSITION:DRAFT->ACKNOWLEDGED/);
    expect(draftPorts.getMarkCalls()).toBe(0);

    const ackPorts = memoryB7Ports({
      pkg: baseDeliveryPackage({
        status: 'ACKNOWLEDGED',
        acknowledgedAt: '2026-08-28T21:30:00.000Z',
      }),
    });
    expect(() =>
      ackPorts.acknowledge({ trusted: clientTrusted(), packageId: 'pkg_b7_1' })
    ).toThrow(/DELIVERY_INVALID_TRANSITION:ACKNOWLEDGED->ACKNOWLEDGED/);
    expect(ackPorts.getStore()[0].acknowledgedAt).toBe('2026-08-28T21:30:00.000Z');
    expect(ackPorts.getMarkCalls()).toBe(0);
  });

  it('consumer missing package returns compat without notification path', () => {
    setupClientGate();
    const markSpy = vi.fn();
    resetExecutionDeliveryConsumerForTest(
      composeExecutionDelivery({
        assembly: { getPackageById: () => undefined } as DeliveryAssemblyRepositoryPort,
        acknowledgement: { markAcknowledged: markSpy },
      })
    );
    const result = acknowledgeDeliveryConsumer({
      requestedClientId: 'client_ed',
      packageId: 'missing',
    });
    expect(result).toEqual({ ok: false, compat: 'DELIVERY_NOT_FOUND' });
    expect(markSpy).not.toHaveBeenCalled();
  });

  it('does not invoke #17, #18, #27, #28, #32, Brief approval, or task transition', () => {
    const source = readFileSync(resolve('src/application/executionDelivery/AcknowledgeDelivery.ts'), 'utf8');
    expect(source).toMatch(/requireClientRole/);
    expect(source).not.toMatch(/requireAdminRole/);
    expect(source).not.toMatch(/SendDeliveryPackage|markDeliverySent/);
    expect(source).not.toMatch(/addTask|updateTaskStatus|transitionClientTask/);
    expect(source).not.toMatch(/reviewClientArticle|approveStrategicBrief/);
    expect(source).not.toMatch(/addCurationToDelivery|removeDeliveryItem/);
  });
});

describe('CR-1 Wave B7 #19 — handler and presentation guards', () => {
  it('deliveryHandlers delegates acknowledge — no direct dbService.acknowledgeDelivery', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/deliveryHandlers.ts'), 'utf8');
    expect(source).toMatch(/acknowledgeDeliveryCmd\s*\(/);
    expect(source).not.toMatch(/dbService\.acknowledgeDelivery/);
    expect(source).toMatch(/notifyManager\s*\(/);
    expect(source).toMatch(/Briefing marcado como visto/);
    expect(source).toMatch(/No se pudo marcar el briefing/);
  });

  it('legacy client portal renders ack button only for SENT packages', () => {
    const sent = renderDeliveryBriefingCard(baseDeliveryPackage(), { showAckControls: true });
    expect(sent).toMatch(/btn-acknowledge-delivery/);
    expect(sent).toMatch(/Marcar como leído/);

    const acknowledged = renderDeliveryBriefingCard(
      baseDeliveryPackage({ status: 'ACKNOWLEDGED', acknowledgedAt: '2026-08-28T22:00:00.000Z' }),
      { showAckControls: true }
    );
    expect(acknowledged).not.toMatch(/btn-acknowledge-delivery/);
    expect(acknowledged).toMatch(/Leído/);
  });

  it('React client portal home documents blocked acknowledgeDelivery authority', () => {
    const source = readFileSync(resolve('src/ui/modules/pages/ReactClientPortalPage.tsx'), 'utf8');
    expect(source).toMatch(/acknowledgeDelivery/);
    expect(source).not.toMatch(/btn-acknowledge-delivery/);
  });

  it('handler performs manager notification after successful ack only', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/deliveryHandlers.ts'), 'utf8');
    const ackBlock = source.slice(source.indexOf('.btn-acknowledge-delivery'));
    expect(ackBlock).toMatch(/acknowledgeDeliveryCmd\s*\(/);
    expect(ackBlock).toMatch(/if\s*\(\s*!result\.ok\s*\)/);
    expect(ackBlock).toMatch(/notifyManager\s*\(\s*pkg\.clientId/);
    expect(ackBlock).toMatch(/type:\s*'BRIEFING'/);
    expect(ackBlock).toMatch(/Briefing visto por el cliente/);
    expect(ackBlock).toMatch(/href:\s*'ws-deliver'/);
    expect(ackBlock).toMatch(/Briefing marcado como visto/);
    expect(ackBlock.indexOf('notifyManager')).toBeGreaterThan(ackBlock.indexOf('acknowledgeDeliveryCmd'));
  });

  it('notification failure is best-effort — ack success still toasts and renders', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/deliveryHandlers.ts'), 'utf8');
    const ackBlock = source.slice(source.indexOf('.btn-acknowledge-delivery'));
    expect(ackBlock).not.toMatch(/notifyManager[\s\S]*return/);
    expect(ackBlock).toMatch(/notifyManager[\s\S]*host\.showToast\('Briefing marcado como visto'/);
    expect(ackBlock).toMatch(/host\.showToast\('Briefing marcado como visto'[\s\S]*host\.render\(\)/);
  });
});

describe('CR-1 Wave B7 #19 — architecture guards', () => {
  it('compose exposes seventeen commands including AcknowledgeDelivery', () => {
    const c = composeExecutionDelivery();
    expect(typeof c.acknowledgeDelivery).toBe('function');
    expect(typeof c.createContentDraft).toBe('function');
    expect(Object.keys(c)).toHaveLength(17);
  });

  it('single production persistence authority remains dbService.acknowledgeDelivery via adapter only', () => {
    const adapter = readFileSync(
      resolve('src/infrastructure/executionDelivery/DbAcknowledgeDeliveryAdapter.ts'),
      'utf8'
    );
    expect(adapter).toMatch(/dbService\.acknowledgeDelivery/);
    const handler = readFileSync(resolve('src/ui/legacy/handlers/deliveryHandlers.ts'), 'utf8');
    expect(handler).not.toMatch(/dbService\.acknowledgeDelivery/);
  });
});
