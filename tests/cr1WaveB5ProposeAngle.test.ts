/**
 * CR-1 Wave B5 — #15 ProposeAngle canonicalization + role reachability guards.
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
  createProposeAngle,
  type AdvisorCurationAnglePort,
  type CurationAnglePersistencePort,
  type CurationRepositoryPort,
  type CurationStrategicBriefReadPort,
  type CurationThesisReadPort,
  type SignalReadPort,
  type TrustedExecutionDeliveryContext,
} from '../src/application/executionDelivery';
import type { CurationEntry, PositioningThesis, Signal, StrategicBrief } from '../src/types';
import { composeExecutionDelivery } from '../src/composition/executionDelivery/composeExecutionDelivery';
import { authService } from '../src/services/auth';
import { auditService } from '../src/services/audit';
import { dbService } from '../src/services/db';
import {
  proposeAngle as proposeAngleConsumer,
  resetExecutionDeliveryConsumerForTest,
} from '../src/services/executionDeliveryConsumer';
import { renderClientPortal } from '../src/components/ClientPortal';
import { renderMainViewSource } from './helpers/legacyMainViewSource';
import {
  handleProposeAngleClick,
  THESIS_NOT_RESOLVED_MESSAGE,
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
    id: 'cur_b5_1',
    organizationId: 'org_ed',
    clientId: 'client_ed',
    signalId: 'sig_b5_1',
    title: 'Signal title',
    snippet: 'Signal snippet',
    destination: null,
    managerRationale: '',
    deliveryPackageId: null,
    createdAt: '2026-08-28T20:00:00.000Z',
    createdBy: 'admin_01',
    ...overrides,
  };
}

function baseThesis(overrides: Partial<PositioningThesis> = {}): PositioningThesis {
  return {
    id: 'thesis_b5_1',
    clientId: 'client_ed',
    title: 'Thesis title',
    expertIdentity: 'Expert',
    targetAudience: 'Leaders',
    domain: 'Governance',
    complianceRules: 'Be precise',
    status: 'ACTIVE',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  } as PositioningThesis;
}

function memoryB5Ports(options: {
  entry?: CurationEntry | null;
  brief?: StrategicBrief;
  signal?: Signal;
  thesis?: PositioningThesis;
  advisor?: AdvisorCurationAnglePort;
  deleteBeforePersist?: boolean;
}) {
  const store = options.entry ? [{ ...options.entry }] : [];
  let angleWrites = 0;
  let lastAngle: string | undefined;
  let advisorCalls = 0;
  let gateTitle = '';
  let gateSnippet = '';

  const curation: CurationRepositoryPort = {
    isSignalInCuration: () => false,
    addToCuration: (input) => {
      const created = {
        destination: null,
        managerRationale: '',
        deliveryPackageId: null,
        ...input,
        id: `cur_${store.length + 1}`,
        createdAt: '2026-08-28T20:00:00.000Z',
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

  const strategicBriefs: CurationStrategicBriefReadPort = {
    getById(briefId, clientId) {
      if (!options.brief || options.brief.id !== briefId || options.brief.clientId !== clientId) {
        return undefined;
      }
      return options.brief;
    },
  };

  const signals: SignalReadPort = {
    getById(signalId) {
      if (!options.signal || options.signal.id !== signalId) return undefined;
      return options.signal;
    },
  };

  const theses: CurationThesisReadPort = {
    getById(clientId, thesisId) {
      if (!options.thesis || options.thesis.clientId !== clientId || options.thesis.id !== thesisId) {
        return undefined;
      }
      return options.thesis;
    },
  };

  const advisor: AdvisorCurationAnglePort =
    options.advisor ??
    ({
      async generateAngle(params) {
        advisorCalls += 1;
        gateTitle = params.title;
        gateSnippet = params.snippet;
        return { angle: 'Live angle', usedLiveModel: true };
      },
    } satisfies AdvisorCurationAnglePort);

  const angles: CurationAnglePersistencePort = {
    setAngle(curationEntryId, aiAngle) {
      if (options.deleteBeforePersist) {
        const idx = store.findIndex((c) => c.id === curationEntryId);
        if (idx >= 0) store.splice(idx, 1);
        return;
      }
      const item = store.find((c) => c.id === curationEntryId);
      if (!item) return;
      item.aiAngle = aiAngle;
      angleWrites += 1;
      lastAngle = aiAngle;
    },
  };

  const propose = createProposeAngle({
    curation,
    strategicBriefs,
    signals,
    theses,
    advisor,
    angles,
  });

  return {
    propose,
    curation,
    getStore: () => store,
    getAngleWrites: () => angleWrites,
    getLastAngle: () => lastAngle,
    getAdvisorCalls: () => advisorCalls,
    getGateTitle: () => gateTitle,
    getGateSnippet: () => gateSnippet,
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

function mockButton(): HTMLButtonElement {
  return {
    disabled: false,
    textContent: 'Proponer ángulo',
  } as HTMLButtonElement;
}

function curationHost(overrides: Partial<CurationHandlerHost> = {}): CurationHandlerHost {
  return {
    resolveClientId: () => 'client_ed',
    showToast: vi.fn(),
    render: vi.fn(),
    ...overrides,
  } as CurationHandlerHost;
}

describe('CR-1 Wave B5 #15 — ProposeAngle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetExecutionDeliveryConsumerForTest();
  });

  it('normal live success — authoritative reload, live AI, aiAngle write, usedLiveModel true, zero audits', async () => {
    const ports = memoryB5Ports({
      entry: baseCurationEntry(),
      signal: {
        id: 'sig_b5_1',
        clientId: 'client_ed',
        organizationId: 'org_ed',
        routingDecision: { selectedThesisId: 'thesis_b5_1' },
      } as Signal,
      thesis: baseThesis(),
    });
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    const result = await ports.propose({
      trusted: adminTrusted(),
      curationEntryId: 'cur_b5_1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usedLiveModel).toBe(true);
      expect(result.angle).toBe('Live angle');
    }
    expect(ports.getAdvisorCalls()).toBe(1);
    expect(ports.getGateTitle()).toBe('Signal title');
    expect(ports.getGateSnippet()).toBe('Signal snippet');
    expect(ports.getAngleWrites()).toBe(1);
    expect(ports.getLastAngle()).toBe('Live angle');
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it('heuristic success — gateway unavailable path writes heuristic and usedLiveModel false', async () => {
    const ports = memoryB5Ports({
      entry: baseCurationEntry(),
      signal: {
        id: 'sig_b5_1',
        clientId: 'client_ed',
        organizationId: 'org_ed',
        routingDecision: { selectedThesisId: 'thesis_b5_1' },
      } as Signal,
      thesis: baseThesis(),
      advisor: {
        async generateAngle({ thesis, title }) {
          return {
            angle: `Qué implica "${title}" para ${thesis.targetAudience}: lectura desde ${thesis.domain} con las tres decisiones que deberían tomar esta semana.`,
            usedLiveModel: false,
          };
        },
      },
    });
    const result = await ports.propose({ trusted: adminTrusted(), curationEntryId: 'cur_b5_1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usedLiveModel).toBe(false);
      expect(result.angle).toContain('Signal title');
    }
    expect(ports.getAngleWrites()).toBe(1);
  });

  it('missing curation — silent compat, no AI, no write', async () => {
    const ports = memoryB5Ports({ entry: null });
    const result = await ports.propose({ trusted: adminTrusted(), curationEntryId: 'missing' });
    expect(result).toEqual({ ok: false, compat: 'CURATION_NOT_FOUND' });
    expect(ports.getAdvisorCalls()).toBe(0);
    expect(ports.getAngleWrites()).toBe(0);
  });

  it('missing thesis — warning compat, no AI, no write', async () => {
    const ports = memoryB5Ports({
      entry: baseCurationEntry({ signalId: 'sig_b5_1', strategicBriefId: undefined }),
      signal: { id: 'sig_b5_1', routingDecision: {} } as Signal,
    });
    const result = await ports.propose({ trusted: adminTrusted(), curationEntryId: 'cur_b5_1' });
    expect(result).toEqual({ ok: false, compat: 'THESIS_NOT_RESOLVED' });
    expect(ports.getAdvisorCalls()).toBe(0);
    expect(ports.getAngleWrites()).toBe(0);
  });

  it('authority — CLIENT, cross-tenant ADMIN, missing session, wrong client all fail before generation/write', async () => {
    const ports = memoryB5Ports({
      entry: baseCurationEntry(),
      signal: {
        id: 'sig_b5_1',
        routingDecision: { selectedThesisId: 'thesis_b5_1' },
      } as Signal,
      thesis: baseThesis(),
    });

    await expect(
      ports.propose({
        trusted: adminTrusted({ actorRole: 'CLIENT', actorId: 'client_01' }),
        curationEntryId: 'cur_b5_1',
      })
    ).rejects.toMatchObject({ code: 'ACTOR_NOT_AUTHORIZED' });
    expect(ports.getAdvisorCalls()).toBe(0);
    expect(ports.getAngleWrites()).toBe(0);

    await expect(
      ports.propose({
        trusted: adminTrusted({ clientId: 'other_client' }),
        curationEntryId: 'cur_b5_1',
      })
    ).rejects.toMatchObject({ code: 'TENANT_CONTEXT_INVALID' });
    expect(ports.getAdvisorCalls()).toBe(0);

    await expect(
      ports.propose({
        trusted: {
          actorId: '',
          actorRole: 'ADMIN',
          organizationId: 'org_ed',
          clientId: 'client_ed',
          now: '2026-08-28T20:00:00.000Z',
        },
        curationEntryId: 'cur_b5_1',
      })
    ).rejects.toMatchObject({ code: 'ACTOR_NOT_AUTHORIZED' });
  });

  it('thesis precedence — Brief thesis, routed Signal thesis, neither, no getPrimaryThesis', async () => {
    const briefThesis = memoryB5Ports({
      entry: baseCurationEntry({ strategicBriefId: 'brief_1', signalId: 'sig_b5_1' }),
      brief: {
        id: 'brief_1',
        clientId: 'client_ed',
        thesisId: 'thesis_from_brief',
      } as StrategicBrief,
      signal: {
        id: 'sig_b5_1',
        routingDecision: { selectedThesisId: 'thesis_from_signal' },
      } as Signal,
      thesis: baseThesis({ id: 'thesis_from_brief' }),
    });
    await briefThesis.propose({ trusted: adminTrusted(), curationEntryId: 'cur_b5_1' });
    expect(briefThesis.getAdvisorCalls()).toBe(1);

    const signalThesis = memoryB5Ports({
      entry: baseCurationEntry({ strategicBriefId: undefined }),
      signal: {
        id: 'sig_b5_1',
        routingDecision: { selectedThesisId: 'thesis_b5_1' },
      } as Signal,
      thesis: baseThesis(),
    });
    await signalThesis.propose({ trusted: adminTrusted(), curationEntryId: 'cur_b5_1' });
    expect(signalThesis.getAdvisorCalls()).toBe(1);

    const source = readFileSync(resolve('src/application/executionDelivery/ProposeAngle.ts'), 'utf8');
    expect(source).not.toMatch(/getPrimaryThesis|primaryThesis|theses\[0\]/);
  });

  it('stale source — gate-time title/snippet used; entry may disappear before persist; no post-AI reload', async () => {
    let resolveAdvisor!: (value: { angle: string; usedLiveModel: boolean }) => void;
    const advisorPromise = new Promise<{ angle: string; usedLiveModel: boolean }>((resolve) => {
      resolveAdvisor = resolve;
    });
    const ports = memoryB5Ports({
      entry: baseCurationEntry({ title: 'Gate title', snippet: 'Gate snippet' }),
      signal: {
        id: 'sig_b5_1',
        routingDecision: { selectedThesisId: 'thesis_b5_1' },
      } as Signal,
      thesis: baseThesis(),
      advisor: {
        async generateAngle(params) {
          expect(params.title).toBe('Gate title');
          expect(params.snippet).toBe('Gate snippet');
          ports.getStore()[0].title = 'Mutated title';
          return advisorPromise;
        },
      },
      deleteBeforePersist: true,
    });
    const pending = ports.propose({ trusted: adminTrusted(), curationEntryId: 'cur_b5_1' });
    resolveAdvisor!({ angle: 'Late angle', usedLiveModel: true });
    const result = await pending;
    expect(result.ok).toBe(true);
    expect(ports.getAngleWrites()).toBe(0);
    const source = readFileSync(resolve('src/application/executionDelivery/ProposeAngle.ts'), 'utf8');
    expect(source).not.toMatch(/getById\(curationEntryId\)[\s\S]*generateAngle[\s\S]*getById\(curationEntryId\)/);
  });

  it('handler missing curation compat — silent return without toast/render', async () => {
    setupAdminGate();
    const host = curationHost();
    const btn = mockButton();
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
    await handleProposeAngleClick(host, btn, 'missing');
    expect(host.showToast).not.toHaveBeenCalled();
    expect(host.render).not.toHaveBeenCalled();
    expect(btn.disabled).toBe(false);
  });

  it('handler missing thesis compat — exact warning, no final render', async () => {
    setupAdminGate();
    const host = curationHost();
    const btn = mockButton();
    resetExecutionDeliveryConsumerForTest(
      composeExecutionDelivery({
        curation: {
          isSignalInCuration: () => false,
          addToCuration: () => baseCurationEntry(),
          getById: () => baseCurationEntry({ signalId: 'sig_b5_1' }),
          decideCuration: () => null,
        },
        signals: { getById: () => ({ id: 'sig_b5_1', routingDecision: {} } as Signal) },
      })
    );
    await handleProposeAngleClick(host, btn, 'cur_b5_1');
    expect(host.showToast).toHaveBeenCalledWith(THESIS_NOT_RESOLVED_MESSAGE, 'warning');
    expect(host.render).not.toHaveBeenCalled();
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('Pensando…');
  });

  it('handler success preserves exact toast strings and render', async () => {
    setupAdminGate();
    const host = curationHost();
    const btn = mockButton();
    resetExecutionDeliveryConsumerForTest(
      composeExecutionDelivery({
        curation: {
          isSignalInCuration: () => false,
          addToCuration: () => baseCurationEntry(),
          getById: () => baseCurationEntry(),
          decideCuration: () => null,
        },
        signals: {
          getById: () =>
            ({
              id: 'sig_b5_1',
              routingDecision: { selectedThesisId: 'thesis_b5_1' },
            }) as Signal,
        },
        theses: { getById: () => baseThesis() },
        advisor: {
          async generateAngle() {
            return { angle: 'Angle', usedLiveModel: true };
          },
        },
        angles: { setAngle: vi.fn() },
      })
    );
    await handleProposeAngleClick(host, btn, 'cur_b5_1');
    expect(host.showToast).toHaveBeenCalledWith('Ángulo propuesto con modelo', 'success');
    expect(host.render).toHaveBeenCalled();
  });

  it('consumer CLIENT fails before generation/write', async () => {
    setupClientGate();
    await expect(
      proposeAngleConsumer({ requestedClientId: 'client_ed', curationEntryId: 'cur_b5_1' })
    ).rejects.toMatchObject({ code: 'ACTOR_NOT_AUTHORIZED' });
  });

  it('curation handler delegates #15 — no direct dbService.setCurationAngle or services/advisor proposeAngle', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/curationHandlers.ts'), 'utf8');
    const block = source.match(/export async function handleProposeAngleClick[\s\S]*?^}/m);
    expect(block).toBeTruthy();
    expect(block![0]).toMatch(/proposeAngle\s*\(/);
    expect(block![0]).not.toMatch(/dbService\.setCurationAngle/);
    expect(source).not.toMatch(/from ['"].*\/services\/advisor['"]/);
    expect(source).not.toMatch(/services\/advisor.*proposeAngle/);
  });

  it('ProposeAngle use case does not invoke #18, Brief gate, Planner, #27, #33, or raw provider SDK', () => {
    const source = readFileSync(resolve('src/application/executionDelivery/ProposeAngle.ts'), 'utf8');
    expect(source).not.toMatch(/SendDeliveryPackage|saveContent|addTask/);
    expect(source).not.toMatch(/gateStrategicDownstream|requirePlannedAuthorization/);
    expect(source).not.toMatch(/openai|fetch\(/);
    expect(source).toMatch(/requireAdminRole/);
    expect(source).not.toMatch(/getPrimaryThesis/);
  });

  it('B3 CurationRepositoryPort has no setAngle write method', () => {
    const source = readFileSync(
      resolve('src/application/executionDelivery/ports/CurationRepositoryPort.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/setAngle\s*\(/);
    expect(source).not.toMatch(/setAngle:/);
  });

  it('presentation blocks repeat when aiAngle exists', () => {
    const source = readFileSync(resolve('src/components/ClientWorkspace.ts'), 'utf8');
    const block = source.match(/function renderCurationEntry[\s\S]*?^}/m);
    expect(block).toBeTruthy();
    expect(block![0]).toMatch(/\$\{entry\.aiAngle[\s\S]*btn-suggest-angle/);
  });

  it('zero audits through consumer path', async () => {
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
        signals: {
          getById: () =>
            ({
              id: 'sig_b5_1',
              routingDecision: { selectedThesisId: 'thesis_b5_1' },
            }) as Signal,
        },
        theses: { getById: () => baseThesis() },
        advisor: {
          async generateAngle() {
            return { angle: 'A', usedLiveModel: false };
          },
        },
        angles: { setAngle: vi.fn() },
      })
    );
    await proposeAngleConsumer({ requestedClientId: 'client_ed', curationEntryId: 'cur_b5_1' });
    expect(auditSpy).not.toHaveBeenCalled();
  });
});

describe('CR-1 Wave B5 #15 — role reachability architecture guards', () => {
  it('ADMIN legacy main view can reach ClientWorkspace deliver surface', () => {
    const source = renderMainViewSource();
    expect(source).toMatch(/user\.role !== 'ADMIN'/);
    expect(source).toMatch(/renderClientWorkspace/);
    expect(source).toMatch(/renderClientPortal/);
  });

  it('CLIENT portal render path does not emit btn-suggest-angle', () => {
    vi.spyOn(dbService, 'getClientById').mockReturnValue({
      id: 'client_ed',
      displayName: 'Client',
    } as ReturnType<typeof dbService.getClientById>);
    const html = renderClientPortal('client-home', 'client_ed', null);
    expect(html).not.toMatch(/btn-suggest-angle/);
  });

  it('React workspace page blocks non-admin before deliver panel', () => {
    const source = readFileSync(
      resolve('src/ui/modules/pages/ReactClientWorkspacePage.tsx'),
      'utf8'
    );
    expect(source).toMatch(/if \(!isAdmin\)/);
    expect(source).toMatch(/react-ws-not-admin/);
    expect(source).not.toMatch(/btn-suggest-angle/);
  });

  it('missing session legacy renderMainView returns empty for unauthenticated user', () => {
    const source = renderMainViewSource();
    expect(source).toMatch(/if \(!user\) return ''/);
  });
});
