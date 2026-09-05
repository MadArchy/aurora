/**
 * CR-1 Wave B6 — #16-R RemoveCuration / #16-O ReopenCuration + role reachability guards.
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
  createRemoveCuration,
  createReopenCuration,
  type CurationRemovalPersistencePort,
  type CurationReopenPersistencePort,
  type CurationRepositoryPort,
  type TrustedExecutionDeliveryContext,
} from '../src/application/executionDelivery';
import type { CurationEntry } from '../src/types';
import { composeExecutionDelivery } from '../src/composition/executionDelivery/composeExecutionDelivery';
import { authService } from '../src/services/auth';
import { auditService } from '../src/services/audit';
import { dbService } from '../src/services/db';
import {
  removeCuration as removeCurationConsumer,
  reopenCuration as reopenCurationConsumer,
  resetExecutionDeliveryConsumerForTest,
} from '../src/services/executionDeliveryConsumer';
import { renderClientPortal } from '../src/components/ClientPortal';
import { renderMainViewSource } from './helpers/legacyMainViewSource';
import {
  handleRemoveCurationClick,
  handleReopenCurationClick,
} from '../src/ui/legacy/handlers/curationHandlers';
import type { CurationHandlerHost } from '../src/ui/legacy/legacyAppHost';

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

function baseCurationEntry(overrides: Partial<CurationEntry> = {}): CurationEntry {
  return {
    id: 'cur_b6_1',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    signalId: 'sig_b6_1',
    thesisId: 'thesis_b6_1',
    title: 'Signal title',
    snippet: 'Signal snippet',
    destination: null,
    managerRationale: '',
    aiAngle: 'Existing angle',
    strategicBriefId: 'brief_b6_1',
    deliveryPackageId: null,
    createdAt: '2026-08-28T20:00:00.000Z',
    createdBy: 'admin_01',
    ...overrides,
  };
}

function memoryB6Ports(options: {
  entry?: CurationEntry | null;
  removal?: CurationRemovalPersistencePort;
  reopen?: CurationReopenPersistencePort;
}) {
  const store = options.entry ? [{ ...options.entry }] : [];
  let removeCalls = 0;
  let reopenCalls = 0;

  const curation: CurationRepositoryPort = {
    isSignalInCuration: () => false,
    addToCuration: (input) => {
      const created = {
        destination: null,
        managerRationale: '',
        deliveryPackageId: null,
        id: 'cur_new',
        createdAt: '2026-08-28T20:00:00.000Z',
        ...input,
      } as CurationEntry;
      store.unshift(created);
      return created;
    },
    getById(id) {
      return store.find((c) => c.id === id);
    },
    decideCuration() {
      return null;
    },
  };

  const removal: CurationRemovalPersistencePort =
    options.removal ??
    ({
      removeById(curationEntryId) {
        removeCalls += 1;
        const idx = store.findIndex((c) => c.id === curationEntryId);
        if (idx >= 0) store.splice(idx, 1);
      },
    } satisfies CurationRemovalPersistencePort);

  const reopen: CurationReopenPersistencePort =
    options.reopen ??
    ({
      reopenById(curationEntryId) {
        reopenCalls += 1;
        const item = store.find((c) => c.id === curationEntryId);
        if (!item) return;
        item.destination = null;
        item.managerRationale = '';
        item.decidedAt = undefined;
        item.decidedBy = undefined;
      },
    } satisfies CurationReopenPersistencePort);

  return {
    remove: createRemoveCuration({ curation, removal }),
    reopen: createReopenCuration({ curation, reopen }),
    getStore: () => store,
    getRemoveCalls: () => removeCalls,
    getReopenCalls: () => reopenCalls,
  };
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
  } as ReturnType<typeof dbService.getClientById>);
}

function curationHost(overrides: Partial<CurationHandlerHost> = {}): CurationHandlerHost {
  return {
    resolveClientId: () => 'client_ed',
    showToast: vi.fn(),
    render: vi.fn(),
    ...overrides,
  } as CurationHandlerHost;
}

describe('CR-1 Wave B6 #16-R — RemoveCuration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetExecutionDeliveryConsumerForTest();
  });

  it('normal ADMIN success — authoritative reload, physical delete, one persistence write', () => {
    const ports = memoryB6Ports({ entry: baseCurationEntry() });
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    const result = ports.remove({ trusted: adminTrusted(), curationEntryId: 'cur_b6_1' });
    expect(result.ok).toBe(true);
    expect(ports.getStore()).toHaveLength(0);
    expect(ports.getRemoveCalls()).toBe(1);
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it('missing curation — write 0 compat CURATION_NOT_FOUND', () => {
    const ports = memoryB6Ports({ entry: null });
    const result = ports.remove({ trusted: adminTrusted(), curationEntryId: 'missing' });
    expect(result).toEqual({ ok: false, compat: 'CURATION_NOT_FOUND' });
    expect(ports.getRemoveCalls()).toBe(0);
  });

  it('repeat remove — second call compat without persistence write', () => {
    const ports = memoryB6Ports({ entry: baseCurationEntry() });
    ports.remove({ trusted: adminTrusted(), curationEntryId: 'cur_b6_1' });
    const second = ports.remove({ trusted: adminTrusted(), curationEntryId: 'cur_b6_1' });
    expect(second).toEqual({ ok: false, compat: 'CURATION_NOT_FOUND' });
    expect(ports.getRemoveCalls()).toBe(1);
  });

  it('CLIENT cross-tenant and missing session deny write', () => {
    setupClientGate();
    expect(() =>
      removeCurationConsumer({ requestedClientId: 'client_ed', curationEntryId: 'cur_b6_1' })
    ).toThrow(/ADMIN role/);

    setupAdminGate('client_ed', 'org_ed');
    const ports = memoryB6Ports({
      entry: baseCurationEntry({ clientId: 'other_client', organizationId: 'org_other' }),
    });
    expect(() =>
      ports.remove({ trusted: adminTrusted({ clientId: 'client_ed' }), curationEntryId: 'cur_b6_1' })
    ).toThrow(/trusted client entitlement/);

    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    expect(() =>
      removeCurationConsumer({ requestedClientId: 'client_ed', curationEntryId: 'cur_b6_1' })
    ).toThrow(/Sesión no disponible/);
  });

  it('does not invoke #17, #20, #21, Brief, evidence, or opportunity cleanup ports', () => {
    const source = readFileSync(resolve('src/application/executionDelivery/RemoveCuration.ts'), 'utf8');
    expect(source).not.toMatch(/addCurationToDelivery|removeDeliveryItem|discardSignal|markSignalSaved/);
    expect(source).not.toMatch(/createBrief|approveStrategicBrief|evidenceVault|addOpportunity/);
    expect(source).toMatch(/requireAdminRole/);
  });
});

describe('CR-1 Wave B6 #16-O — ReopenCuration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetExecutionDeliveryConsumerForTest();
  });

  it('normal ADMIN success — exact decision reset and preserved fields', () => {
    const ports = memoryB6Ports({
      entry: baseCurationEntry({
        destination: 'TASK_VIDEO',
        managerRationale: 'Because governance',
        decidedAt: '2026-08-28T19:00:00.000Z',
        decidedBy: 'admin_01',
        deliveryPackageId: null,
      }),
    });
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    const result = ports.reopen({ trusted: adminTrusted(), curationEntryId: 'cur_b6_1' });
    expect(result.ok).toBe(true);
    const entry = ports.getStore()[0];
    expect(entry.destination).toBeNull();
    expect(entry.managerRationale).toBe('');
    expect(entry.decidedAt).toBeUndefined();
    expect(entry.decidedBy).toBeUndefined();
    expect(entry.aiAngle).toBe('Existing angle');
    expect(entry.strategicBriefId).toBe('brief_b6_1');
    expect(entry.deliveryPackageId).toBeNull();
    expect(entry.signalId).toBe('sig_b6_1');
    expect(entry.thesisId).toBe('thesis_b6_1');
    expect(ports.getReopenCalls()).toBe(1);
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it('missing curation — write 0 compat CURATION_NOT_FOUND', () => {
    const ports = memoryB6Ports({ entry: null });
    const result = ports.reopen({ trusted: adminTrusted(), curationEntryId: 'missing' });
    expect(result).toEqual({ ok: false, compat: 'CURATION_NOT_FOUND' });
    expect(ports.getReopenCalls()).toBe(0);
  });

  it('repeat reopen — success compatibility preserved', () => {
    const ports = memoryB6Ports({
      entry: baseCurationEntry({
        destination: 'TASK_VIDEO',
        managerRationale: 'Because governance',
        decidedAt: '2026-08-28T19:00:00.000Z',
        decidedBy: 'admin_01',
      }),
    });
    expect(ports.reopen({ trusted: adminTrusted(), curationEntryId: 'cur_b6_1' }).ok).toBe(true);
    expect(ports.reopen({ trusted: adminTrusted(), curationEntryId: 'cur_b6_1' }).ok).toBe(true);
    expect(ports.getReopenCalls()).toBe(2);
  });

  it('CLIENT cross-tenant and missing session deny write', () => {
    setupClientGate();
    expect(() =>
      reopenCurationConsumer({ requestedClientId: 'client_ed', curationEntryId: 'cur_b6_1' })
    ).toThrow(/ADMIN role/);

    setupAdminGate();
    const ports = memoryB6Ports({
      entry: baseCurationEntry({ clientId: 'other_client', organizationId: 'org_other' }),
    });
    expect(() =>
      ports.reopen({ trusted: adminTrusted(), curationEntryId: 'cur_b6_1' })
    ).toThrow(/trusted client entitlement/);

    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    expect(() =>
      reopenCurationConsumer({ requestedClientId: 'client_ed', curationEntryId: 'cur_b6_1' })
    ).toThrow(/Sesión no disponible/);
  });

  it('does not invoke DecideCuration, #17, Signal, Brief, evidence, or opportunity cleanup', () => {
    const source = readFileSync(resolve('src/application/executionDelivery/ReopenCuration.ts'), 'utf8');
    expect(source).not.toMatch(/decideCuration\s*\(/);
    expect(source).not.toMatch(/addCurationToDelivery|removeDeliveryItem|discardSignal|markSignalSaved/);
    expect(source).not.toMatch(/createBrief|approveStrategicBrief|evidenceVault|addOpportunity/);
    expect(source).not.toMatch(/setCurationAngle|ClearAiAngle|ResetAngle/);
  });
});

describe('CR-1 Wave B6 #16 — handler and consumer compatibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetExecutionDeliveryConsumerForTest();
  });

  it('missing remove handler compat — audit 1, toast 1, render 1, write 0', () => {
    setupAdminGate();
    const host = curationHost();
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    resetExecutionDeliveryConsumerForTest(
      composeExecutionDelivery({
        curation: {
          isSignalInCuration: () => false,
          addToCuration: () => baseCurationEntry(),
          getById: () => undefined,
          decideCuration: () => null,
        },
      })
    );
    handleRemoveCurationClick(host, 'missing');
    expect(auditSpy).toHaveBeenCalledWith(
      expect.anything(),
      'CURATION_REMOVED',
      'CurationEntry',
      'missing'
    );
    expect(host.showToast).toHaveBeenCalledWith('Ítem retirado de la mesa', 'info');
    expect(host.render).toHaveBeenCalledTimes(1);
  });

  it('missing reopen handler compat — audit 0, toast 1, render 1, write 0', () => {
    setupAdminGate();
    const host = curationHost();
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    resetExecutionDeliveryConsumerForTest(
      composeExecutionDelivery({
        curation: {
          isSignalInCuration: () => false,
          addToCuration: () => baseCurationEntry(),
          getById: () => undefined,
          decideCuration: () => null,
        },
      })
    );
    handleReopenCurationClick(host, 'missing');
    expect(auditSpy).not.toHaveBeenCalled();
    expect(host.showToast).toHaveBeenCalledWith('Ítem reabierto para volver a decidir', 'info');
    expect(host.render).toHaveBeenCalledTimes(1);
  });

  it('repeat remove handler preserves duplicate audit and success UX', () => {
    setupAdminGate();
    const host = curationHost();
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    resetExecutionDeliveryConsumerForTest(
      composeExecutionDelivery({
        curation: {
          isSignalInCuration: () => false,
          addToCuration: () => baseCurationEntry(),
          getById: () => undefined,
          decideCuration: () => null,
        },
      })
    );
    handleRemoveCurationClick(host, 'cur_b6_1');
    handleRemoveCurationClick(host, 'cur_b6_1');
    expect(auditSpy).toHaveBeenCalledTimes(2);
    expect(host.showToast).toHaveBeenCalledTimes(2);
    expect(host.render).toHaveBeenCalledTimes(2);
  });

  it('remove handler security denial — no audit, no success toast, no render', () => {
    setupClientGate();
    const host = curationHost();
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    handleRemoveCurationClick(host, 'cur_b6_1');
    expect(auditSpy).not.toHaveBeenCalled();
    expect(host.showToast).toHaveBeenCalledWith(expect.any(String), 'warning');
    expect(host.render).not.toHaveBeenCalled();
  });

  it('reopen handler security denial — no audit, no success toast, no render', () => {
    setupClientGate();
    const host = curationHost();
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    handleReopenCurationClick(host, 'cur_b6_1');
    expect(auditSpy).not.toHaveBeenCalled();
    expect(host.showToast).toHaveBeenCalledWith(expect.any(String), 'warning');
    expect(host.render).not.toHaveBeenCalled();
  });

  it('handlers delegate #16-R/#16-O — no direct dbService remove/reopen', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/curationHandlers.ts'), 'utf8');
    const removeBlock = source.match(/export function handleRemoveCurationClick[\s\S]*?^}/m);
    const reopenBlock = source.match(/export function handleReopenCurationClick[\s\S]*?^}/m);
    expect(removeBlock![0]).toMatch(/removeCuration\s*\(/);
    expect(removeBlock![0]).not.toMatch(/dbService\.removeCuration/);
    expect(reopenBlock![0]).toMatch(/reopenCuration\s*\(/);
    expect(reopenBlock![0]).not.toMatch(/dbService\.reopenCuration/);
  });

  it('consumer remove path emits zero audits', () => {
    setupAdminGate();
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    resetExecutionDeliveryConsumerForTest(
      composeExecutionDelivery({
        curation: {
          isSignalInCuration: () => false,
          addToCuration: () => baseCurationEntry(),
          getById: () => baseCurationEntry(),
          decideCuration: () => null,
        },
      })
    );
    removeCurationConsumer({ requestedClientId: 'client_ed', curationEntryId: 'cur_b6_1' });
    expect(auditSpy).not.toHaveBeenCalled();
  });
});

describe('CR-1 Wave B6 #16 — architecture guards', () => {
  it('B3 CurationRepositoryPort has no remove/reopen mutation methods', () => {
    const source = readFileSync(
      resolve('src/application/executionDelivery/ports/CurationRepositoryPort.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/removeById|reopenById|removeCuration|reopenCuration/);
  });

  it('two separate persistence ports and no generic combined command', () => {
    expect(readFileSync(resolve('src/application/executionDelivery/ports/CurationRemovalPersistencePort.ts'), 'utf8')).toMatch(
      /removeById/
    );
    expect(readFileSync(resolve('src/application/executionDelivery/ports/CurationReopenPersistencePort.ts'), 'utf8')).toMatch(
      /reopenById/
    );
    const composeSource = readFileSync(resolve('src/composition/executionDelivery/composeExecutionDelivery.ts'), 'utf8');
    expect(composeSource).toMatch(/removeCuration:/);
    expect(composeSource).toMatch(/reopenCuration:/);
    expect(composeSource).not.toMatch(/UpdateCurationStatus|SaveCuration|MutateCuration/);
  });

  it('presentation reachability — remove pending only, reopen loose only', () => {
    const source = readFileSync(resolve('src/components/ClientWorkspace.ts'), 'utf8');
    const pendingBlock = source.match(/function renderCurationEntry[\s\S]*?^}/m);
    const looseBlock = source.match(/briefing-loose[\s\S]*btn-reopen-curation/);
    expect(pendingBlock![0]).toMatch(/btn-remove-curation/);
    expect(pendingBlock![0]).not.toMatch(/btn-reopen-curation/);
    expect(looseBlock).toBeTruthy();
    expect(source).toMatch(/pending\.map\(\(e\) => renderCurationEntry\(e\)\)/);
  });

  it('packaged entry buttons remain presentation-only unreachable in current UI', () => {
    const dbSource = readFileSync(resolve('src/services/db.ts'), 'utf8');
    expect(dbSource).toMatch(/getReadyCurationByClient[\s\S]*!c\.deliveryPackageId/);
    expect(dbSource).toMatch(/getPendingCurationByClient[\s\S]*destination === null/);
  });
});

describe('CR-1 Wave B6 #16 — role reachability architecture guards', () => {
  it('ADMIN legacy main view can reach ClientWorkspace deliver surface', () => {
    const source = renderMainViewSource();
    expect(source).toMatch(/user\.role !== 'ADMIN'/);
    expect(source).toMatch(/renderClientWorkspace/);
  });

  it('CLIENT portal render path does not emit remove/reopen curation buttons', () => {
    vi.spyOn(dbService, 'getClientById').mockReturnValue({
      id: 'client_ed',
      displayName: 'Client',
    } as ReturnType<typeof dbService.getClientById>);
    const html = renderClientPortal('client-home', 'client_ed', null);
    expect(html).not.toMatch(/btn-remove-curation/);
    expect(html).not.toMatch(/btn-reopen-curation/);
  });

  it('React workspace page blocks non-admin before deliver panel', () => {
    const source = readFileSync(
      resolve('src/ui/modules/pages/ReactClientWorkspacePage.tsx'),
      'utf8'
    );
    expect(source).toMatch(/if \(!isAdmin\)/);
    expect(source).not.toMatch(/btn-remove-curation/);
    expect(source).not.toMatch(/btn-reopen-curation/);
  });

  it('missing session legacy renderMainView returns empty for unauthenticated user', () => {
    const source = renderMainViewSource();
    expect(source).toMatch(/if \(!user\) return ''/);
  });
});
