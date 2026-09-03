/**
 * CR-1 Workstream 4 — Signal Intake Application tests.
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
  SignalIntakeError,
  createDiscardSignal,
  createRegisterManualSignal,
  createRegisterSource,
  type SignalIntakePort,
  type SourceRegistryPort,
  type TrustedSignalIntakeContext,
} from '../src/application/signalIntake';
import type { Signal, Source, User } from '../src/types';
import {
  discardSignal,
  registerSource,
  resetSignalIntakeConsumerForTest,
} from '../src/services/signalIntakeConsumer';
import * as signalIntakeConsumer from '../src/services/signalIntakeConsumer';
import { composeSignalIntake } from '../src/composition/signalIntake/composeSignalIntake';
import { authService } from '../src/services/auth';
import { auditService } from '../src/services/audit';
import { dbService } from '../src/services/db';
import { handleRadarDiscardSignalClick } from '../src/ui/legacy/handlers/radarHandlers';
import type { RadarHandlerHost } from '../src/ui/legacy/legacyAppHost';

function adminTrusted(
  overrides: Partial<TrustedSignalIntakeContext> = {}
): TrustedSignalIntakeContext {
  return {
    actorId: 'admin_01',
    actorRole: 'ADMIN',
    organizationId: 'org_trust',
    clientId: 'client_trust',
    now: '2026-08-28T18:00:00.000Z',
    ...overrides,
  };
}

function memorySources() {
  const store: Source[] = [];
  const repo: SourceRegistryPort = {
    add(source) {
      const created: Source = {
        ...source,
        id: `src_${store.length + 1}`,
        itemCount: 0,
        createdAt: '2026-08-28T18:00:00.000Z',
      };
      store.unshift(created);
      return created;
    },
    listByClient(clientId) {
      return store.filter((s) => s.clientId === clientId);
    },
    getById(sourceId) {
      return store.find((s) => s.id === sourceId);
    },
    listPollableByClient(clientId) {
      return store.filter(
        (s) => s.clientId === clientId && s.url && s.status !== 'ARCHIVED' && s.status !== 'PAUSED'
      );
    },
    recordSourceRun() {
      // test stub
    },
  };
  return { repo, store };
}

function memorySignals() {
  const store: Signal[] = [];
  const repo: SignalIntakePort = {
    add(signal) {
      if (!signal.clientId) throw new Error('SIGNAL_CLIENT_REQUIRED');
      const canonical = `${(signal.sourceUrl || '').toLowerCase().split(/[?#]/)[0]}|${signal.title.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
      const fingerprint = `fp_${canonical.substring(0, 64)}`;
      const existing = store.find(
        (s) => s.fingerprint === fingerprint && s.clientId === signal.clientId
      );
      if (existing) return { signal: existing, isDuplicate: true };
      const created: Signal = {
        aiStatus: 'PENDING_AI',
        managerDecision: 'UNREVIEWED',
        sourceQuality: 'UNASSESSED',
        ...signal,
        id: `sig_${store.length + 1}`,
        fingerprint,
        detectedAt: '2026-08-28T18:00:00.000Z',
      };
      store.unshift(created);
      return { signal: created, isDuplicate: false };
    },
    getById(signalId) {
      return store.find((s) => s.id === signalId);
    },
    decideManagerOutcome({ signalId, decision, reason }) {
      const sig = store.find((s) => s.id === signalId);
      if (!sig) throw new Error(`Signal not found: ${signalId}`);
      sig.managerDecision = decision;
      if (decision === 'DISCARDED') {
        sig.status = 'DISCARDED';
        sig.discardReason = reason;
      }
      if (decision === 'CONVERTED') sig.status = 'CONVERTED';
      return { ...sig };
    },
  };
  return { repo, store };
}

function seedSignal(overrides: Partial<Signal> & Pick<Signal, 'id'>): Signal {
  return {
    organizationId: 'org_trust',
    clientId: 'client_trust',
    title: 'Seed signal',
    sourceType: 'MANUAL',
    sourceName: 'test',
    contentSnippet: 'snippet',
    status: 'NEW',
    aiStatus: 'PENDING_AI',
    managerDecision: 'UNREVIEWED',
    sourceQuality: 'UNASSESSED',
    fingerprint: 'fp_seed',
    detectedAt: '2026-08-28T18:00:00.000Z',
    ...overrides,
  };
}

describe('CR-1 Signal Intake — RegisterSource', () => {
  it('registers source with trusted ownership (not caller org/actor)', () => {
    const { repo, store } = memorySources();
    const register = createRegisterSource({ sources: repo });
    const result = register({
      trusted: adminTrusted(),
      name: 'IP Watch',
      type: 'RSS',
      url: 'https://example.com/feed',
    });
    expect(result.source.organizationId).toBe('org_trust');
    expect(result.source.clientId).toBe('client_trust');
    expect(result.source.createdBy).toBe('admin_01');
    expect(result.source.status).toBe('ACTIVE');
    expect(store).toHaveLength(1);
  });

  it('#8 and #24 share the same RegisterSource command', () => {
    const { repo } = memorySources();
    const register = createRegisterSource({ sources: repo });
    const fromModal = register({
      trusted: adminTrusted(),
      name: 'Modal Source',
      type: 'WEB',
    });
    const fromWorkspace = register({
      trusted: adminTrusted(),
      name: 'Workspace Source',
      type: 'RSS',
      url: 'https://ws.example/feed',
      fetchIntervalMinutes: 180,
    });
    expect(fromModal.source.id).toBeTruthy();
    expect(fromWorkspace.source.fetchIntervalMinutes).toBe(180);
    expect(typeof register).toBe('function');
  });

  it('ATTACK: CLIENT cannot register source', () => {
    const register = createRegisterSource({ sources: memorySources().repo });
    expect(() =>
      register({
        trusted: adminTrusted({ actorRole: 'CLIENT', actorId: 'client_01' }),
        name: 'X',
        type: 'RSS',
      })
    ).toThrow(/ADMIN/);
  });

  it('ATTACK: org spoof denied', () => {
    const register = createRegisterSource({ sources: memorySources().repo });
    expect(() =>
      register({
        trusted: adminTrusted(),
        name: 'X',
        type: 'RSS',
        claimedOrganizationId: 'org_evil',
      })
    ).toThrow(/organization/i);
  });

  it('ATTACK: routing/score spoof denied on source', () => {
    const register = createRegisterSource({ sources: memorySources().repo });
    expect(() =>
      register({
        trusted: adminTrusted(),
        name: 'X',
        type: 'RSS',
        claimedMatchedThesisId: 'thesis_x',
        claimedScore: 99,
      })
    ).toThrow(/routing|scoring|thesis/i);
  });
});

describe('CR-1 Signal Intake — RegisterManualSignal', () => {
  it('registers manual signal with trusted ownership', () => {
    const { repo, store } = memorySignals();
    const register = createRegisterManualSignal({ signals: repo });
    const result = register({
      trusted: adminTrusted(),
      title: 'USPTO AI guidance update',
    });
    expect(result.isDuplicate).toBe(false);
    expect(result.signal.organizationId).toBe('org_trust');
    expect(result.signal.clientId).toBe('client_trust');
    expect(result.signal.sourceType).toBe('MANUAL');
    expect(store).toHaveLength(1);
  });

  it('same-client duplicate → isDuplicate', () => {
    const { repo } = memorySignals();
    const register = createRegisterManualSignal({ signals: repo });
    register({ trusted: adminTrusted(), title: 'Same Title' });
    const dup = register({ trusted: adminTrusted(), title: 'Same Title' });
    expect(dup.isDuplicate).toBe(true);
  });

  it('same-org different client → allowed (client-scoped dedup)', () => {
    const { repo, store } = memorySignals();
    const register = createRegisterManualSignal({ signals: repo });
    register({
      trusted: adminTrusted({ clientId: 'client_a' }),
      title: 'Shared Headline',
      sourceUrl: 'https://news.example/a',
    });
    const other = register({
      trusted: adminTrusted({ clientId: 'client_b' }),
      title: 'Shared Headline',
      sourceUrl: 'https://news.example/a',
    });
    expect(other.isDuplicate).toBe(false);
    expect(store).toHaveLength(2);
  });

  it('cross-org same content → allowed', () => {
    const { repo, store } = memorySignals();
    const register = createRegisterManualSignal({ signals: repo });
    register({
      trusted: adminTrusted({ organizationId: 'org_a', clientId: 'c_a' }),
      title: 'Global Story',
    });
    const other = register({
      trusted: adminTrusted({ organizationId: 'org_b', clientId: 'c_b' }),
      title: 'Global Story',
    });
    expect(other.isDuplicate).toBe(false);
    expect(store).toHaveLength(2);
  });

  it('ATTACK: cannot declare matched thesis / score / routing', () => {
    const register = createRegisterManualSignal({ signals: memorySignals().repo });
    expect(() =>
      register({
        trusted: adminTrusted(),
        title: 'X',
        claimedMatchedThesisId: 't1',
      })
    ).toThrow(/routing|scoring|thesis/i);
    expect(() =>
      register({
        trusted: adminTrusted(),
        title: 'X',
        claimedScore: 88,
        claimedRoutingDecision: 'ROUTE',
      })
    ).toThrow(/routing|scoring|thesis/i);
  });

  it('ATTACK: CLIENT cannot register manual signal', () => {
    const register = createRegisterManualSignal({ signals: memorySignals().repo });
    expect(() =>
      register({
        trusted: adminTrusted({ actorRole: 'CLIENT' }),
        title: 'X',
      })
    ).toThrow(/ADMIN/);
  });
});

describe('CR-1 Signal Intake — dbService client-scoped dedup (F6 §186)', () => {
  it('does not leak duplicate across clients', () => {
    const clientA = dbService.createClient({
      organizationId: 'org_dedup',
      primaryManagerId: 'u',
      firstName: 'A',
      lastName: 'A',
      displayName: 'A',
      primaryEmail: `a_${Date.now()}@ex.com`,
      onboardingStatus: 'IN_PROGRESS',
      profileCompleteness: 10,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u',
      updatedBy: 'u',
    });
    const clientB = dbService.createClient({
      organizationId: 'org_dedup',
      primaryManagerId: 'u',
      firstName: 'B',
      lastName: 'B',
      displayName: 'B',
      primaryEmail: `b_${Date.now()}@ex.com`,
      onboardingStatus: 'IN_PROGRESS',
      profileCompleteness: 10,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u',
      updatedBy: 'u',
    });
    const title = `Dedup Story ${Date.now()}`;
    const first = dbService.addSignal({
      organizationId: 'org_dedup',
      clientId: clientA.id,
      title,
      sourceType: 'MANUAL',
      sourceName: 't',
      contentSnippet: 'x',
      status: 'NEW',
    });
    expect(first.isDuplicate).toBe(false);
    const second = dbService.addSignal({
      organizationId: 'org_dedup',
      clientId: clientB.id,
      title,
      sourceType: 'MANUAL',
      sourceName: 't',
      contentSnippet: 'x',
      status: 'NEW',
    });
    expect(second.isDuplicate).toBe(false);
    const sameClient = dbService.addSignal({
      organizationId: 'org_dedup',
      clientId: clientA.id,
      title,
      sourceType: 'MANUAL',
      sourceName: 't',
      contentSnippet: 'x',
      status: 'NEW',
    });
    expect(sameClient.isDuplicate).toBe(true);
  });
});

describe('CR-1 Signal Intake consumer gate', () => {
  beforeEach(() => {
    resetSignalIntakeConsumerForTest();
    vi.restoreAllMocks();
  });

  it('denies missing session', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    expect(() =>
      registerSource({
        requestedClientId: 'c1',
        name: 'X',
        type: 'RSS',
      })
    ).toThrow(SignalIntakeError);
  });

  it('legitimate ADMIN registerSource via consumer', () => {
    const admin: User = {
      uid: 'u_admin',
      email: 'a@x.com',
      displayName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org_sess',
      clientId: null,
      mustCompleteOnboarding: false,
      aiKeyManagementAllowed: false,
      locale: 'es',
      timezone: 'UTC',
    };
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(admin);
    const client = dbService.createClient({
      organizationId: 'org_sess',
      primaryManagerId: 'u_admin',
      firstName: 'A',
      lastName: 'B',
      displayName: 'A B',
      primaryEmail: `si_${Date.now()}@ex.com`,
      onboardingStatus: 'IN_PROGRESS',
      profileCompleteness: 20,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });
    const result = registerSource({
      requestedClientId: client.id,
      name: 'Consumer Source',
      type: 'RSS',
      url: 'https://consumer.example/rss',
    });
    expect(result.source.organizationId).toBe('org_sess');
    expect(result.source.clientId).toBe(client.id);
  });
});

describe('CR-1 Signal Intake — DiscardSignal (#20)', () => {
  it('ADMIN discards signal in own tenant with default legacy reason', () => {
    const { repo, store } = memorySignals();
    store.push(seedSignal({ id: 'sig_discard_1' }));
    const discard = createDiscardSignal({ signals: repo });
    const result = discard({ trusted: adminTrusted(), signalId: 'sig_discard_1' });
    expect(result.signal.status).toBe('DISCARDED');
    expect(result.signal.managerDecision).toBe('DISCARDED');
    expect(result.signal.discardReason).toBe('Descartado por el manager en el radar.');
    expect(store).toHaveLength(1);
  });

  it('authoritative reload rejects stale caller tenant claims', () => {
    const { repo, store } = memorySignals();
    store.push(seedSignal({ id: 'sig_stale', clientId: 'client_trust' }));
    const discard = createDiscardSignal({ signals: repo });
    expect(() =>
      discard({
        trusted: adminTrusted({ clientId: 'client_evil' }),
        signalId: 'sig_stale',
      })
    ).toThrow(/client entitlement/i);
    expect(store[0].status).toBe('NEW');
  });

  it('missing signal fails safely without persist', () => {
    const calls: string[] = [];
    const repo: SignalIntakePort = {
      ...memorySignals().repo,
      getById(id) {
        calls.push(`get:${id}`);
        return undefined;
      },
      decideManagerOutcome() {
        calls.push('decide');
        throw new Error('should not persist');
      },
    };
    const discard = createDiscardSignal({ signals: repo });
    expect(() => discard({ trusted: adminTrusted(), signalId: 'sig_missing' })).toThrow(
      /not found/i
    );
    expect(calls).toEqual(['get:sig_missing']);
  });

  it('ATTACK: CLIENT role denied', () => {
    const { repo, store } = memorySignals();
    store.push(seedSignal({ id: 'sig_role' }));
    const discard = createDiscardSignal({ signals: repo });
    expect(() =>
      discard({ trusted: adminTrusted({ actorRole: 'CLIENT' }), signalId: 'sig_role' })
    ).toThrow(/ADMIN/);
    expect(store[0].status).toBe('NEW');
  });

  it('ATTACK: cross-tenant organization denied', () => {
    const { repo, store } = memorySignals();
    store.push(seedSignal({ id: 'sig_org', organizationId: 'org_other' }));
    const discard = createDiscardSignal({ signals: repo });
    expect(() => discard({ trusted: adminTrusted(), signalId: 'sig_org' })).toThrow(
      /organization/i
    );
    expect(store[0].status).toBe('NEW');
  });

  it('ATTACK: caller client spoof denied', () => {
    const discard = createDiscardSignal({ signals: memorySignals().repo });
    expect(() =>
      discard({
        trusted: adminTrusted(),
        signalId: 'sig_x',
        claimedClientId: 'client_evil',
      })
    ).toThrow(/clientId/i);
  });

  it('ATTACK: caller organization spoof denied', () => {
    const discard = createDiscardSignal({ signals: memorySignals().repo });
    expect(() =>
      discard({
        trusted: adminTrusted(),
        signalId: 'sig_x',
        claimedOrganizationId: 'org_evil',
      })
    ).toThrow(/organization/i);
  });

  it('repeat discard stays idempotent (single record, reason may update)', () => {
    const { repo, store } = memorySignals();
    store.push(seedSignal({ id: 'sig_dup' }));
    const discard = createDiscardSignal({ signals: repo });
    discard({ trusted: adminTrusted(), signalId: 'sig_dup' });
    const again = discard({
      trusted: adminTrusted(),
      signalId: 'sig_dup',
      reason: 'Updated discard reason',
    });
    expect(store).toHaveLength(1);
    expect(again.signal.status).toBe('DISCARDED');
    expect(again.signal.discardReason).toBe('Updated discard reason');
  });

  it('GATE_FIRST: unauthorized role denied before signal reload', () => {
    const calls: string[] = [];
    const repo: SignalIntakePort = {
      add: memorySignals().repo.add,
      getById() {
        calls.push('getById');
        return seedSignal({ id: 'sig_gate' });
      },
      decideManagerOutcome() {
        calls.push('decideManagerOutcome');
        throw new Error('should not persist');
      },
    };
    const discard = createDiscardSignal({ signals: repo });
    expect(() =>
      discard({ trusted: adminTrusted({ actorRole: 'CLIENT' }), signalId: 'sig_gate' })
    ).toThrow(/ADMIN/);
    expect(calls).toEqual([]);
  });

  it('GATE_FIRST: cross-client denial before persist', () => {
    const calls: string[] = [];
    const repo: SignalIntakePort = {
      add: memorySignals().repo.add,
      getById() {
        calls.push('getById');
        return seedSignal({ id: 'sig_gate', clientId: 'client_other' });
      },
      decideManagerOutcome() {
        calls.push('decideManagerOutcome');
        throw new Error('should not persist');
      },
    };
    const discard = createDiscardSignal({ signals: repo });
    expect(() => discard({ trusted: adminTrusted(), signalId: 'sig_gate' })).toThrow(/client/i);
    expect(calls).toEqual(['getById']);
  });
});

describe('CR-1 Signal Intake consumer — DiscardSignal (#20)', () => {
  beforeEach(() => {
    resetSignalIntakeConsumerForTest();
    vi.restoreAllMocks();
  });

  it('denies missing session', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    expect(() =>
      discardSignal({ requestedClientId: 'c1', signalId: 'sig_1' })
    ).toThrow(SignalIntakeError);
  });

  it('legitimate ADMIN discard via consumer persists DISCARDED', () => {
    const admin: User = {
      uid: 'u_admin',
      email: 'a@x.com',
      displayName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org_sess',
      clientId: null,
      mustCompleteOnboarding: false,
      aiKeyManagementAllowed: false,
      locale: 'es',
      timezone: 'UTC',
    };
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(admin);
    const client = dbService.createClient({
      organizationId: 'org_sess',
      primaryManagerId: 'u_admin',
      firstName: 'A',
      lastName: 'B',
      displayName: 'A B',
      primaryEmail: `discard_${Date.now()}@ex.com`,
      onboardingStatus: 'IN_PROGRESS',
      profileCompleteness: 20,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });
    const created = dbService.addSignal({
      organizationId: 'org_sess',
      clientId: client.id,
      title: `Discard me ${Date.now()}`,
      sourceType: 'MANUAL',
      sourceName: 't',
      contentSnippet: 'x',
      status: 'NEW',
    });
    const result = discardSignal({
      requestedClientId: client.id,
      signalId: created.signal.id,
    });
    expect(result.signal.status).toBe('DISCARDED');
    expect(result.signal.managerDecision).toBe('DISCARDED');
    expect(dbService.getSignalById(created.signal.id)?.status).toBe('DISCARDED');
  });

  it('USER INTENT : CANONICAL INVOCATION = 1 : 1 (no duplicate dbService decide)', () => {
    const admin: User = {
      uid: 'u_admin',
      email: 'a@x.com',
      displayName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org_sess',
      clientId: null,
      mustCompleteOnboarding: false,
      aiKeyManagementAllowed: false,
      locale: 'es',
      timezone: 'UTC',
    };
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(admin);
    const client = dbService.createClient({
      organizationId: 'org_sess',
      primaryManagerId: 'u_admin',
      firstName: 'A',
      lastName: 'B',
      displayName: 'A B',
      primaryEmail: `discard2_${Date.now()}@ex.com`,
      onboardingStatus: 'IN_PROGRESS',
      profileCompleteness: 20,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });
    const created = dbService.addSignal({
      organizationId: 'org_sess',
      clientId: client.id,
      title: `Discard me 2 ${Date.now()}`,
      sourceType: 'MANUAL',
      sourceName: 't',
      contentSnippet: 'x',
      status: 'NEW',
    });
    const decideSpy = vi.spyOn(dbService, 'decideSignal');
    discardSignal({ requestedClientId: client.id, signalId: created.signal.id });
    expect(decideSpy).toHaveBeenCalledTimes(1);
    expect(decideSpy).toHaveBeenCalledWith(
      created.signal.id,
      'DISCARDED',
      'Descartado por el manager en el radar.'
    );
  });
});

function radarHandlerHost(overrides: Partial<RadarHandlerHost> = {}): RadarHandlerHost {
  return {
    resolveClientId: () => 'client_trust',
    showToast: vi.fn(),
    refreshMain: vi.fn(),
    ...overrides,
  } as RadarHandlerHost;
}

describe('CR-1 Wave A1 #20 — radar discard missing-signal compatibility', () => {
  beforeEach(() => {
    resetSignalIntakeConsumerForTest();
    vi.restoreAllMocks();
  });

  it('stale signal ID: canonical throw translated to legacy success observables', () => {
    const host = radarHandlerHost();
    const discardSpy = vi
      .spyOn(signalIntakeConsumer, 'discardSignal')
      .mockImplementation(() => {
        throw new SignalIntakeError('SIGNAL_NOT_FOUND', 'Signal not found: sig_stale');
      });
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);

    handleRadarDiscardSignalClick(host, 'sig_stale');

    expect(discardSpy).toHaveBeenCalledTimes(1);
    expect(discardSpy).toHaveBeenCalledWith({
      requestedClientId: 'client_trust',
      signalId: 'sig_stale',
    });
    expect(auditSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledWith(
      authService.getCurrentUser(),
      'SIGNAL_DISCARDED',
      'Signal',
      'sig_stale'
    );
    expect(host.showToast).toHaveBeenCalledTimes(1);
    expect(host.showToast).toHaveBeenCalledWith('Señal descartada', 'info');
    expect(host.refreshMain).toHaveBeenCalledTimes(1);
    expect(host.showToast).not.toHaveBeenCalledWith(expect.any(String), 'warning');
  });

  it('authorization denial is not translated into legacy success', () => {
    const host = radarHandlerHost();
    vi.spyOn(signalIntakeConsumer, 'discardSignal').mockImplementation(() => {
      throw new SignalIntakeError('ACTOR_NOT_AUTHORIZED', 'Denied');
    });
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);

    handleRadarDiscardSignalClick(host, 'sig_denied');

    expect(host.showToast).toHaveBeenCalledWith('Denied', 'warning');
    expect(host.showToast).not.toHaveBeenCalledWith('Señal descartada', 'info');
    expect(host.refreshMain).not.toHaveBeenCalled();
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it('successful discard: one canonical invocation, consumer audit, success presentation', () => {
    const admin: User = {
      uid: 'u_admin',
      email: 'a@x.com',
      displayName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org_sess',
      clientId: null,
      mustCompleteOnboarding: false,
      aiKeyManagementAllowed: false,
      locale: 'es',
      timezone: 'UTC',
    };
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(admin);
    const client = dbService.createClient({
      organizationId: 'org_sess',
      primaryManagerId: 'u_admin',
      firstName: 'A',
      lastName: 'B',
      displayName: 'A B',
      primaryEmail: `discard_ok_${Date.now()}@ex.com`,
      onboardingStatus: 'IN_PROGRESS',
      profileCompleteness: 20,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });
    const created = dbService.addSignal({
      organizationId: 'org_sess',
      clientId: client.id,
      title: `Discard ok ${Date.now()}`,
      sourceType: 'MANUAL',
      sourceName: 't',
      contentSnippet: 'x',
      status: 'NEW',
    });
    const host = radarHandlerHost({ resolveClientId: () => client.id });
    const discardSpy = vi.spyOn(signalIntakeConsumer, 'discardSignal');
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(() => undefined);
    const decideSpy = vi.spyOn(dbService, 'decideSignal');

    handleRadarDiscardSignalClick(host, created.signal.id);

    expect(discardSpy).toHaveBeenCalledTimes(1);
    expect(decideSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledWith(
      admin,
      'SIGNAL_DISCARDED',
      'Signal',
      created.signal.id
    );
    expect(host.showToast).toHaveBeenCalledWith('Señal descartada', 'info');
    expect(host.refreshMain).toHaveBeenCalledTimes(1);
    expect(dbService.getSignalById(created.signal.id)?.status).toBe('DISCARDED');
  });
});

describe('CR-1 Signal Intake architecture', () => {
  it('compose exposes RegisterSource, RegisterManualSignal, DiscardSignal, and poll commands', () => {
    const c = composeSignalIntake();
    expect(typeof c.registerSource).toBe('function');
    expect(typeof c.registerManualSignal).toBe('function');
    expect(typeof c.discardSignal).toBe('function');
    expect(typeof c.pollRegisteredSource).toBe('function');
    expect(typeof c.pollAllActiveSources).toBe('function');
    expect(Object.keys(c).sort()).toEqual([
      'discardSignal',
      'pollAllActiveSources',
      'pollRegisteredSource',
      'registerManualSignal',
      'registerSource',
    ]);
  });

  it('main.ts adopts signalIntakeConsumer for #8/#24/#26/#9', () => {
    const source = readLegacyControllerSurface();
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/registerSource\s*\(/);
    expect(code).toMatch(/registerManualSignal\s*\(/);
    expect(code).toMatch(/pollRegisteredSource\s*\(/);
    expect(code).toMatch(/pollAllActiveSources\s*\(/);
    expect(code).not.toMatch(/dbService\.addSource\s*\(/);
    expect(code).not.toMatch(/dbService\.addSignal\s*\(/);
  });

  it('command seam exposes signalIntakeCommands', () => {
    const source = readFileSync(resolve('src/ui/commands/commandSeam.ts'), 'utf8');
    expect(source).toMatch(/signalIntakeCommands/);
    expect(source).toMatch(/registerSource/);
    expect(source).toMatch(/registerManualSignal/);
  });

  it('Application has zero routing/scoring authority', () => {
    const files = [
      'src/application/signalIntake/RegisterSource.ts',
      'src/application/signalIntake/RegisterManualSignal.ts',
      'src/application/signalIntake/DiscardSignal.ts',
      'src/application/signalIntake/PollRegisteredSource.ts',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).not.toMatch(/ScoreAndRoute|scoreSignal|OverrideSignal|routeSignal/);
      expect(source).not.toMatch(/relevanceScore|matchedThesis|selectedThesis/);
    }
  });

  it('does not reopen prior CR-1 workstreams', () => {
    const files = [
      'src/application/signalIntake/RegisterSource.ts',
      'src/application/signalIntake/RegisterManualSignal.ts',
      'src/application/signalIntake/DiscardSignal.ts',
      'src/services/signalIntakeConsumer.ts',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).not.toMatch(/SaveThesis|ApplyOnboardingStep|CreateClientWithInvite/);
    }
  });

  it('primary #20 radar discard delegates through signalIntakeConsumer (not direct dbService)', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/radarHandlers.ts'), 'utf8');
    expect(source).toMatch(/handleRadarDiscardSignalClick/);
    expect(source).toMatch(/discardSignal\s*\(/);
    expect(source).toMatch(/error\.code === 'SIGNAL_NOT_FOUND'/);
    const discardBlock = source.match(/\.btn-discard-signal[\s\S]*?\}\);/);
    expect(discardBlock).toBeTruthy();
    expect(discardBlock![0]).toMatch(/handleRadarDiscardSignalClick\s*\(/);
    expect(discardBlock![0]).not.toMatch(/dbService\.decideSignal/);
  });

  it('#14 curation cascade discard remains legacy direct dbService (deferred wave)', () => {
    const source = readFileSync(resolve('src/ui/legacy/handlers/curationHandlers.ts'), 'utf8');
    expect(source).toMatch(/dbService\.decideSignal\([^)]*DISCARDED/);
  });
});
