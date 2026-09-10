/**
 * CR-2 — createBriefFromCurationEntry id-based authoritative reload.
 *
 * Proves caller CurationEntry aggregate authority is 0; persisted entry wins.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, CurationEntry, Signal, User, UserRole } from '../src/types';

const NOW = '2026-08-28T20:00:00.000Z';

let session: User | null = null;
const clients = new Map<string, Client>();
const curation = new Map<string, CurationEntry>();
const signals = new Map<string, Signal>();
const setBriefLink = vi.fn();

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => session,
  },
}));

vi.mock('../src/services/db', () => ({
  dbService: {
    getClientById: (id: string) => clients.get(id),
    getCurationById: (id: string) => curation.get(id),
    getSignalById: (id: string) => signals.get(id),
    getEvidenceById: () => undefined,
    setCurationStrategicBriefId: (curationId: string, briefId: string) => {
      setBriefLink(curationId, briefId);
      const entry = curation.get(curationId);
      if (entry) entry.strategicBriefId = briefId;
    },
  },
}));

function user(partial: Partial<User> & { role: UserRole; organizationId?: string }): User {
  return {
    uid: partial.uid ?? 'actor_1',
    email: partial.email ?? 'a@test',
    displayName: partial.displayName ?? 'Actor',
    role: partial.role,
    status: 'ACTIVE',
    organizationId: partial.organizationId ?? 'org_a',
    clientId: partial.clientId ?? null,
    mustCompleteOnboarding: false,
    aiKeyManagementAllowed: false,
    locale: 'es',
    timezone: 'America/Bogota',
    createdAt: NOW,
    createdBy: 'seed',
    updatedAt: NOW,
    updatedBy: 'seed',
  } as User;
}

function client(id: string, organizationId: string): Client {
  return {
    id,
    organizationId,
    primaryManagerId: 'mgr',
    firstName: 'T',
    lastName: 'C',
    displayName: id,
    email: `${id}@t`,
    profession: 'X',
    onboardingStatus: 'COMPLETED',
    status: 'ACTIVE',
    createdAt: NOW,
    createdBy: 'seed',
    updatedAt: NOW,
    updatedBy: 'seed',
    activeThesesCount: 0,
    completedTasksCount: 0,
  } as Client;
}

function signal(id: string, clientId: string, organizationId: string): Signal {
  return {
    id,
    organizationId,
    clientId,
    title: 'Governed signal',
    sourceType: 'NEWS_API',
    sourceName: 'Source',
    contentSnippet: 'Snippet',
    fingerprint: `fp_${id}`,
    detectedAt: NOW,
    status: 'NEW',
    aiStatus: 'NOT_REQUIRED',
    managerDecision: 'UNREVIEWED',
    routingDecision: {
      source: 'AUTO',
      routingState: 'CLEAR',
      selectedThesisId: 'th_1',
      algorithmVersion: 'routing-v1',
      routedAt: NOW,
    },
    scoringVersion: 'scoring-v1',
    relevanceScore: 82,
    priorityBand: 'HIGH',
    recommendedDisposition: 'SAVE',
    recommendedOutputFormat: 'ARTICLE',
    whyNow: { reason: 'timely', score: 12 },
    scoreRationale: 'governed',
  };
}

function curationEntry(overrides: Partial<CurationEntry> = {}): CurationEntry {
  return {
    id: 'cur_1',
    organizationId: 'org_a',
    clientId: 'client_a',
    signalId: 'sig_1',
    title: 'CURRENT title territory',
    snippet: 'Snippet',
    destination: 'TASK_ARTICLE',
    managerRationale: 'CURRENT rationale from persistence',
    aiAngle: 'CURRENT angle',
    deliveryPackageId: null,
    createdAt: NOW,
    createdBy: 'mgr',
    ...overrides,
  };
}

async function consumer() {
  return import('../src/services/strategicBriefConsumer');
}

describe('CR-2 — createBriefFromCurationEntry contract', () => {
  beforeEach(async () => {
    session = null;
    clients.clear();
    curation.clear();
    signals.clear();
    setBriefLink.mockClear();
    const { resetStrategicBriefConsumerForTest } = await consumer();
    resetStrategicBriefConsumerForTest();
  });

  it('consumer signature is id-based only (no caller aggregate param)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/services/strategicBriefConsumer.ts'),
      'utf8'
    );
    expect(source).toMatch(/createBriefFromCurationEntry\(params:\s*\{\s*curationEntryId:/s);
    expect(source).not.toMatch(/entry:\s*CurationEntry/);
  });

  it('legacy production call site passes curationEntryId only', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/ui/legacy/handlers/curationHandlers.ts'), 'utf8');
    expect(source).toMatch(/createBriefFromCurationEntry\(\{\s*curationEntryId:\s*curationId/);
    expect(source).not.toMatch(/createBriefFromCurationEntry\(\{\s*entry,/);
  });
});

describe('CR-2 — authorized creation', () => {
  beforeEach(async () => {
    session = user({ role: 'ADMIN', organizationId: 'org_a' });
    clients.set('client_a', client('client_a', 'org_a'));
    signals.set('sig_1', signal('sig_1', 'client_a', 'org_a'));
    curation.set('cur_1', curationEntry());
    setBriefLink.mockClear();
    const { resetStrategicBriefConsumerForTest } = await consumer();
    resetStrategicBriefConsumerForTest();
  });

  it('authorized ADMIN same tenant creates Brief from persisted entry', async () => {
    const { createBriefFromCurationEntry } = await consumer();
    const { brief, created } = createBriefFromCurationEntry({
      curationEntryId: 'cur_1',
      destination: 'TASK_ARTICLE',
      now: NOW,
    });
    expect(created).toBe(true);
    expect(brief.decision.authorizedAction).toBe('CREATE_CONTENT');
    expect(brief.signalIds).toEqual(['sig_1']);
    expect(setBriefLink).toHaveBeenCalledWith('cur_1', brief.id);
  });
});

describe('CR-2 — denial paths (zero side effects)', () => {
  beforeEach(async () => {
    session = user({ role: 'ADMIN', organizationId: 'org_a' });
    clients.set('client_a', client('client_a', 'org_a'));
    signals.set('sig_1', signal('sig_1', 'client_a', 'org_a'));
    curation.set('cur_1', curationEntry());
    setBriefLink.mockClear();
    const { resetStrategicBriefConsumerForTest } = await consumer();
    resetStrategicBriefConsumerForTest();
  });

  it('missing session denies before Brief creation', async () => {
    session = null;
    const { createBriefFromCurationEntry } = await consumer();
    expect(() =>
      createBriefFromCurationEntry({ curationEntryId: 'cur_1', destination: 'TASK_ARTICLE', now: NOW })
    ).toThrow(/Trusted actor context required/);
    expect(setBriefLink).not.toHaveBeenCalled();
  });

  it('missing entry denies before Brief creation', async () => {
    const { createBriefFromCurationEntry } = await consumer();
    expect(() =>
      createBriefFromCurationEntry({ curationEntryId: 'cur_missing', destination: 'TASK_ARTICLE', now: NOW })
    ).toThrow(/Curation entry not found/);
    expect(setBriefLink).not.toHaveBeenCalled();
  });

  it('cross-tenant curation substitution denies', async () => {
    clients.set('client_b', client('client_b', 'org_b'));
    curation.set('cur_x', curationEntry({ id: 'cur_x', clientId: 'client_b', organizationId: 'org_b' }));
    signals.set('sig_b', signal('sig_b', 'client_b', 'org_b'));
    curation.get('cur_x')!.signalId = 'sig_b';

    const { createBriefFromCurationEntry } = await consumer();
    expect(() =>
      createBriefFromCurationEntry({ curationEntryId: 'cur_x', destination: 'TASK_ARTICLE', now: NOW })
    ).toThrow(/Trusted actor context required/);
    expect(setBriefLink).not.toHaveBeenCalled();
  });

  it('CLIENT actor cannot create Brief for another client entry', async () => {
    session = user({ role: 'CLIENT', organizationId: 'org_a', clientId: 'client_a' });
    clients.set('client_b', client('client_b', 'org_a'));
    curation.set('cur_other', curationEntry({ id: 'cur_other', clientId: 'client_b' }));
    signals.set('sig_other', signal('sig_other', 'client_b', 'org_a'));
    curation.get('cur_other')!.signalId = 'sig_other';

    const { createBriefFromCurationEntry } = await consumer();
    expect(() =>
      createBriefFromCurationEntry({ curationEntryId: 'cur_other', destination: 'TASK_ARTICLE', now: NOW })
    ).toThrow(/Trusted actor context required/);
    expect(setBriefLink).not.toHaveBeenCalled();
  });

  it('authoritative DISCARD destination denies before Brief creation', async () => {
    curation.set('cur_1', curationEntry({ destination: 'DISCARD' }));
    const { createBriefFromCurationEntry } = await consumer();
    expect(() =>
      createBriefFromCurationEntry({ curationEntryId: 'cur_1', destination: 'DISCARD', now: NOW })
    ).toThrow(/does not require a Strategic Brief/);
    expect(setBriefLink).not.toHaveBeenCalled();
  });

  it('caller destination mismatch rejects before Brief creation', async () => {
    curation.set('cur_1', curationEntry({ destination: 'TASK_ARTICLE' }));
    const { createBriefFromCurationEntry } = await consumer();
    expect(() =>
      createBriefFromCurationEntry({ curationEntryId: 'cur_1', destination: 'DISCARD', now: NOW })
    ).toThrow(/Curation destination mismatch/);
    expect(setBriefLink).not.toHaveBeenCalled();
  });

  it('entry without signalId denies', async () => {
    curation.set('cur_nosig', curationEntry({ id: 'cur_nosig', signalId: undefined }));
    const { createBriefFromCurationEntry } = await consumer();
    expect(() =>
      createBriefFromCurationEntry({ curationEntryId: 'cur_nosig', destination: 'TASK_ARTICLE', now: NOW })
    ).toThrow(/must reference a signal/);
    expect(setBriefLink).not.toHaveBeenCalled();
  });
});

describe('CR-2 — stale caller snapshot authority', () => {
  beforeEach(async () => {
    session = user({ role: 'ADMIN', organizationId: 'org_a' });
    clients.set('client_a', client('client_a', 'org_a'));
    signals.set('sig_1', signal('sig_1', 'client_a', 'org_a'));
    curation.set('cur_1', curationEntry());
    setBriefLink.mockClear();
    const { resetStrategicBriefConsumerForTest } = await consumer();
    resetStrategicBriefConsumerForTest();
  });

  it('uses persisted entry fields after UI would have seen stale values', async () => {
    const staleSnapshot = curationEntry({
      aiAngle: 'STALE angle',
      managerRationale: 'STALE rationale',
      title: 'STALE title',
    });
    void staleSnapshot;

    curation.set('cur_1', curationEntry({
      aiAngle: 'CURRENT angle',
      managerRationale: 'CURRENT rationale from persistence',
      title: 'CURRENT title territory',
    }));

    const { createBriefFromCurationEntry } = await consumer();
    const { brief } = createBriefFromCurationEntry({
      curationEntryId: 'cur_1',
      destination: 'TASK_ARTICLE',
      now: NOW,
    });

    expect(brief.territory).toBe('CURRENT title territory'.slice(0, 120));
    expect(brief.strategicAngle).toBe('CURRENT angle');
    expect(brief.decision.decisionRationale).toBe('CURRENT rationale from persistence');
  });

  it('foreign curation id loads only persisted record (no caller substitution)', async () => {
    curation.set('cur_real', curationEntry({
      id: 'cur_real',
      aiAngle: 'Persisted angle',
      title: 'Persisted title',
    }));

    const { createBriefFromCurationEntry } = await consumer();
    const { brief } = createBriefFromCurationEntry({
      curationEntryId: 'cur_real',
      destination: 'TASK_ARTICLE',
      now: NOW,
    });
    expect(brief.strategicAngle).toBe('Persisted angle');
    expect(brief.id).toBe('brief_cur_real');
  });

  it('idempotent repeat uses current persisted signal reference', async () => {
    const { createBriefFromCurationEntry } = await consumer();
    const first = createBriefFromCurationEntry({
      curationEntryId: 'cur_1',
      destination: 'TASK_ARTICLE',
      now: NOW,
    });
    const second = createBriefFromCurationEntry({
      curationEntryId: 'cur_1',
      destination: 'TASK_ARTICLE',
      now: NOW,
    });
    expect(second.created).toBe(false);
    expect(second.brief.id).toBe(first.brief.id);
  });
});

describe('CR-2 — destination authority (caller assertion vs entry.destination)', () => {
  beforeEach(async () => {
    session = user({ role: 'ADMIN', organizationId: 'org_a' });
    clients.set('client_a', client('client_a', 'org_a'));
    signals.set('sig_1', signal('sig_1', 'client_a', 'org_a'));
    setBriefLink.mockClear();
    const { resetStrategicBriefConsumerForTest } = await consumer();
    resetStrategicBriefConsumerForTest();
  });

  it('TASK_VIDEO entry rejects OPPORTUNITY caller assertion before any write', async () => {
    curation.set('cur_1', curationEntry({ destination: 'TASK_VIDEO' }));
    const { createBriefFromCurationEntry, BriefFromCurationConsumerError } = await consumer();
    expect(() =>
      createBriefFromCurationEntry({ curationEntryId: 'cur_1', destination: 'OPPORTUNITY', now: NOW })
    ).toThrow(BriefFromCurationConsumerError);
    try {
      createBriefFromCurationEntry({ curationEntryId: 'cur_1', destination: 'OPPORTUNITY', now: NOW });
    } catch (error) {
      expect(error).toMatchObject({ code: 'CURATION_DESTINATION_MISMATCH' });
      expect((error as Error).message).toMatch(/authoritative destination is TASK_VIDEO/);
    }
    expect(setBriefLink).not.toHaveBeenCalled();
  });

  it('OPPORTUNITY entry rejects TASK_ARTICLE caller assertion before any write', async () => {
    curation.set('cur_1', curationEntry({ destination: 'OPPORTUNITY' }));
    const { createBriefFromCurationEntry } = await consumer();
    expect(() =>
      createBriefFromCurationEntry({ curationEntryId: 'cur_1', destination: 'TASK_ARTICLE', now: NOW })
    ).toThrow(/Curation destination mismatch/);
    expect(setBriefLink).not.toHaveBeenCalled();
  });

  it('EVIDENCE entry rejects TASK_ARTICLE caller assertion before Brief creation', async () => {
    curation.set('cur_1', curationEntry({ destination: 'EVIDENCE' }));
    const { createBriefFromCurationEntry } = await consumer();
    expect(() =>
      createBriefFromCurationEntry({ curationEntryId: 'cur_1', destination: 'TASK_ARTICLE', now: NOW })
    ).toThrow(/Curation destination mismatch/);
    expect(setBriefLink).not.toHaveBeenCalled();
  });

  it('DISCARD entry rejects OPPORTUNITY caller assertion before Brief creation', async () => {
    curation.set('cur_1', curationEntry({ destination: 'DISCARD' }));
    const { createBriefFromCurationEntry } = await consumer();
    expect(() =>
      createBriefFromCurationEntry({ curationEntryId: 'cur_1', destination: 'OPPORTUNITY', now: NOW })
    ).toThrow(/Curation destination mismatch/);
    expect(setBriefLink).not.toHaveBeenCalled();
  });

  it('matching caller assertion succeeds for every Brief-producing destination', async () => {
    const { createBriefFromCurationEntry } = await consumer();
    const cases = [
      { destination: 'TASK_VIDEO' as const, action: 'CREATE_CONTENT' },
      { destination: 'TASK_ARTICLE' as const, action: 'CREATE_CONTENT' },
      { destination: 'OPPORTUNITY' as const, action: 'CREATE_OPPORTUNITY' },
      { destination: 'REFERENCE_READING' as const, action: 'CREATE_TASK' },
    ];
    for (const [index, testCase] of cases.entries()) {
      const id = `cur_dest_${index}`;
      curation.set(id, curationEntry({ id, destination: testCase.destination }));
      signals.set(`sig_${index}`, signal(`sig_${index}`, 'client_a', 'org_a'));
      curation.get(id)!.signalId = `sig_${index}`;
      setBriefLink.mockClear();
      const { brief } = createBriefFromCurationEntry({
        curationEntryId: id,
        destination: testCase.destination,
        now: NOW,
      });
      expect(brief.decision.authorizedAction).toBe(testCase.action);
      expect(setBriefLink).toHaveBeenCalledWith(id, brief.id);
    }
  });

  it('existing DRAFT does not mask caller destination mismatch', async () => {
    curation.set('cur_1', curationEntry({ destination: 'TASK_ARTICLE' }));
    const { createBriefFromCurationEntry } = await consumer();
    createBriefFromCurationEntry({ curationEntryId: 'cur_1', destination: 'TASK_ARTICLE', now: NOW });
    expect(setBriefLink).toHaveBeenCalledTimes(1);
    setBriefLink.mockClear();
    expect(() =>
      createBriefFromCurationEntry({ curationEntryId: 'cur_1', destination: 'OPPORTUNITY', now: NOW })
    ).toThrow(/Curation destination mismatch/);
    expect(setBriefLink).not.toHaveBeenCalled();
  });

  it('consumer maps authorizedAction from entry.destination not params.destination', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/services/strategicBriefConsumer.ts'),
      'utf8'
    );
    expect(source).toMatch(/curationDestinationToAuthorizedAction\(authoritativeDestination\)/);
    expect(source).not.toMatch(/curationDestinationToAuthorizedAction\(params\.destination\)/);
  });
});

describe('CR-2 — CR-3 trusted context regression', () => {
  it('buildTrustedBriefContext still uses session organization (not client record)', async () => {
    clients.set('client_a', client('client_a', 'org_a'));
    session = user({ role: 'ADMIN', organizationId: 'org_a' });
    const { buildTrustedBriefContext } = await consumer();
    const ctx = buildTrustedBriefContext('client_a', NOW);
    expect(ctx?.organizationId).toBe('org_a');
  });
});
