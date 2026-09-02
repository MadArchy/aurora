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
  createRegisterManualSignal,
  createRegisterSource,
  type SignalIntakePort,
  type SourceRegistryPort,
  type TrustedSignalIntakeContext,
} from '../src/application/signalIntake';
import type { Signal, Source, User } from '../src/types';
import {
  registerSource,
  resetSignalIntakeConsumerForTest,
} from '../src/services/signalIntakeConsumer';
import { composeSignalIntake } from '../src/composition/signalIntake/composeSignalIntake';
import { authService } from '../src/services/auth';
import { dbService } from '../src/services/db';

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
  };
  return { repo, store };
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

describe('CR-1 Signal Intake architecture', () => {
  it('compose exposes RegisterSource, RegisterManualSignal, and poll commands', () => {
    const c = composeSignalIntake();
    expect(typeof c.registerSource).toBe('function');
    expect(typeof c.registerManualSignal).toBe('function');
    expect(typeof c.pollRegisteredSource).toBe('function');
    expect(typeof c.pollAllActiveSources).toBe('function');
    expect(Object.keys(c).sort()).toEqual([
      'pollAllActiveSources',
      'pollRegisteredSource',
      'registerManualSignal',
      'registerSource',
    ]);
  });

  it('main.ts adopts signalIntakeConsumer for #8/#24/#26/#9', () => {
    const source = readFileSync(resolve('src/main.ts'), 'utf8');
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
      'src/services/signalIntakeConsumer.ts',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).not.toMatch(/SaveThesis|ApplyOnboardingStep|CreateClientWithInvite/);
    }
  });
});
