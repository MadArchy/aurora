/**
 * Stage B blocker #9 — Signal Intake scheduled/source ingest canonicalization tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

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
  createPollAllActiveSources,
  createPollRegisteredSource,
  type PostIngestRoutingPort,
  type ProfileKeywordsPort,
  type SignalIntakePort,
  type SourceFeedPort,
  type SourceRegistryPort,
  type TrustedSignalIntakeContext,
} from '../src/application/signalIntake';
import type { FeedItem } from '../src/services/ingestFilter';
import type { ProfileKeywords } from '../src/services/sourceDiscovery';
import type { Signal, Source, SourceRunOutcome } from '../src/types';
import { gateItem } from '../src/services/ingestFilter';
import { resetSignalIntakeConsumerForTest } from '../src/services/signalIntakeConsumer';
import { composeSignalIntake } from '../src/composition/signalIntake/composeSignalIntake';

function adminTrusted(
  overrides: Partial<TrustedSignalIntakeContext> = {}
): TrustedSignalIntakeContext {
  return {
    actorId: 'admin_01',
    actorRole: 'ADMIN',
    organizationId: 'org_a',
    clientId: 'client_a',
    now: '2026-08-28T18:00:00.000Z',
    ...overrides,
  };
}

const keywords: ProfileKeywords = {
  coreEn: ['patent litigation'],
  coreEs: [],
  strong: ['patent'],
  context: ['litigation'],
  negative: [],
};

function buildHarness(options?: {
  feedItems?: FeedItem[];
  feedError?: string;
  routingCalls?: string[];
}) {
  const sources: Source[] = [];
  const signals: Signal[] = [];
  const runs: Array<{ sourceId: string; outcome: SourceRunOutcome }> = [];
  const routingCalls = options?.routingCalls ?? [];

  const sourcePort: SourceRegistryPort = {
    add(source) {
      const created: Source = {
        ...source,
        id: `src_${sources.length + 1}`,
        itemCount: 0,
        createdAt: '2026-08-28T18:00:00.000Z',
      };
      sources.push(created);
      return created;
    },
    listByClient(clientId) {
      return sources.filter((s) => s.clientId === clientId);
    },
    getById(sourceId) {
      return sources.find((s) => s.id === sourceId);
    },
    listPollableByClient(clientId) {
      return sources.filter(
        (s) => s.clientId === clientId && s.url && s.status !== 'ARCHIVED' && s.status !== 'PAUSED'
      );
    },
    recordSourceRun(sourceId, outcome) {
      runs.push({ sourceId, outcome });
    },
  };

  const signalPort: SignalIntakePort = {
    add(signal) {
      const canonical = `${(signal.sourceUrl || '').toLowerCase()}|${signal.title.toLowerCase()}`;
      const fingerprint = `fp_${canonical}`;
      const existing = signals.find(
        (s) => s.fingerprint === fingerprint && s.clientId === signal.clientId
      );
      if (existing) return { signal: existing, isDuplicate: true };
      const created: Signal = {
        aiStatus: 'PENDING_AI',
        managerDecision: 'UNREVIEWED',
        sourceQuality: 'UNASSESSED',
        ...signal,
        id: `sig_${signals.length + 1}`,
        fingerprint,
        detectedAt: '2026-08-28T18:00:00.000Z',
      };
      signals.push(created);
      return { signal: created, isDuplicate: false };
    },
  };

  const feedPort: SourceFeedPort = {
    async fetch() {
      if (options?.feedError) return { items: [], error: options.feedError };
      return { items: options?.feedItems ?? [] };
    },
  };

  const profileKeywordsPort: ProfileKeywordsPort = {
    forClient() {
      return keywords;
    },
  };

  const routingPort: PostIngestRoutingPort = {
    scoreAndRouteAfterIngest({ signalId }) {
      routingCalls.push(signalId);
    },
  };

  const pollRegisteredSource = createPollRegisteredSource({
    sources: sourcePort,
    signals: signalPort,
    feed: feedPort,
    profileKeywords: profileKeywordsPort,
    routing: routingPort,
  });
  const pollAllActiveSources = createPollAllActiveSources({
    sources: sourcePort,
    signals: signalPort,
    feed: feedPort,
    profileKeywords: profileKeywordsPort,
    routing: routingPort,
  });

  return { sources, signals, runs, routingCalls, pollRegisteredSource, pollAllActiveSources };
}

function acceptedItem(title = 'Major patent litigation ruling in federal court'): FeedItem {
  return {
    title,
    link: 'https://example.com/item-1',
    snippet: 'patent litigation update for practitioners',
  };
}

describe('Stage B #9 PollRegisteredSource', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSignalIntakeConsumerForTest();
  });

  it('registers success with routing consumer invoked (not owned)', async () => {
    const item = acceptedItem();
    const { sources, signals, routingCalls, pollRegisteredSource } = buildHarness({ feedItems: [item] });
    sources.push({
      id: 'src_1',
      organizationId: 'org_a',
      clientId: 'client_a',
      name: 'RSS',
      type: 'RSS',
      url: 'https://example.com/feed',
      fetchIntervalMinutes: 360,
      status: 'ACTIVE',
      createdBy: 'admin_01',
      itemCount: 0,
      createdAt: '2026-08-28T18:00:00.000Z',
    });

    const result = await pollRegisteredSource({ trusted: adminTrusted(), sourceId: 'src_1' });
    expect(result.created).toBe(1);
    expect(signals).toHaveLength(1);
    expect(routingCalls).toEqual(['sig_1']);
    expect(signals[0].matchedThesisId).toBeUndefined();
  });

  it('records zero-result run without routing', async () => {
    const { sources, runs, routingCalls, pollRegisteredSource } = buildHarness({ feedItems: [] });
    sources.push({
      id: 'src_1',
      organizationId: 'org_a',
      clientId: 'client_a',
      name: 'RSS',
      type: 'RSS',
      url: 'https://example.com/feed',
      fetchIntervalMinutes: 360,
      status: 'ACTIVE',
      createdBy: 'admin_01',
      itemCount: 0,
      createdAt: '2026-08-28T18:00:00.000Z',
    });

    const result = await pollRegisteredSource({ trusted: adminTrusted(), sourceId: 'src_1' });
    expect(result.created).toBe(0);
    expect(routingCalls).toHaveLength(0);
    expect(runs.at(-1)?.outcome).toMatchObject({ fetched: 0, accepted: 0 });
  });

  it('records poll failure and throws SOURCE_POLL_FAILED', async () => {
    const { sources, runs, pollRegisteredSource } = buildHarness({ feedError: 'RSS_TIMEOUT' });
    sources.push({
      id: 'src_1',
      organizationId: 'org_a',
      clientId: 'client_a',
      name: 'RSS',
      type: 'RSS',
      url: 'https://example.com/feed',
      fetchIntervalMinutes: 360,
      status: 'ACTIVE',
      createdBy: 'admin_01',
      itemCount: 0,
      createdAt: '2026-08-28T18:00:00.000Z',
    });

    await expect(
      pollRegisteredSource({ trusted: adminTrusted(), sourceId: 'src_1' })
    ).rejects.toMatchObject({ code: 'SOURCE_POLL_FAILED' });
    expect(runs.at(-1)?.outcome.error).toBe('RSS_TIMEOUT');
  });

  it('treats duplicate as client-scoped', async () => {
    const item = acceptedItem();
    const { sources, signals, routingCalls, pollRegisteredSource } = buildHarness({ feedItems: [item, item] });
    sources.push({
      id: 'src_1',
      organizationId: 'org_a',
      clientId: 'client_a',
      name: 'RSS',
      type: 'RSS',
      url: 'https://example.com/feed',
      fetchIntervalMinutes: 360,
      status: 'ACTIVE',
      createdBy: 'admin_01',
      itemCount: 0,
      createdAt: '2026-08-28T18:00:00.000Z',
    });

    const result = await pollRegisteredSource({ trusted: adminTrusted(), sourceId: 'src_1' });
    expect(result.created).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(signals).toHaveLength(1);
    expect(routingCalls).toHaveLength(1);
  });

  it('rejects cross-tenant source id', async () => {
    const { sources, pollRegisteredSource } = buildHarness({ feedItems: [acceptedItem()] });
    sources.push({
      id: 'src_foreign',
      organizationId: 'org_b',
      clientId: 'client_b',
      name: 'RSS',
      type: 'RSS',
      url: 'https://example.com/feed',
      fetchIntervalMinutes: 360,
      status: 'ACTIVE',
      createdBy: 'admin_01',
      itemCount: 0,
      createdAt: '2026-08-28T18:00:00.000Z',
    });

    await expect(
      pollRegisteredSource({ trusted: adminTrusted(), sourceId: 'src_foreign' })
    ).rejects.toMatchObject({ code: 'TENANT_CONTEXT_INVALID' });
  });

  it('does not use first/primary thesis in ingest gate', () => {
    const source: Source = {
      id: 'src_1',
      organizationId: 'org_a',
      clientId: 'client_a',
      name: 'RSS',
      type: 'RSS',
      url: 'https://example.com/rss',
      fetchIntervalMinutes: 360,
      status: 'ACTIVE',
      createdBy: 'admin_01',
      itemCount: 0,
      createdAt: '2026-08-28T18:00:00.000Z',
    };
    const gate = gateItem(acceptedItem(), keywords, source);
    expect(gate.accepted).toBe(true);
    expect(source.thesisId).toBeUndefined();
  });

  it('compose exposes PollRegisteredSource commands', () => {
    const c = composeSignalIntake();
    expect(typeof c.pollRegisteredSource).toBe('function');
    expect(typeof c.pollAllActiveSources).toBe('function');
  });

  it('Application layer has zero routing/scoring authority', () => {
    const source = readFileSync('src/application/signalIntake/PollRegisteredSource.ts', 'utf8');
    expect(source).not.toMatch(/scoreAndRouteSignal|OverrideSignalThesis|getPrimaryThesis/);
    expect(source).not.toMatch(/relevanceScore\s*=/);
  });
});

describe('Stage B #9 PollAllActiveSources', () => {
  it('polls each active source independently', async () => {
    const { sources, pollAllActiveSources } = buildHarness({
      feedItems: [acceptedItem('Patent litigation case one'), acceptedItem('Patent litigation case two')],
    });
    sources.push(
      {
        id: 'src_1',
        organizationId: 'org_a',
        clientId: 'client_a',
        name: 'A',
        type: 'RSS',
        url: 'https://a.test/feed',
        fetchIntervalMinutes: 360,
        status: 'ACTIVE',
        createdBy: 'admin_01',
        itemCount: 0,
        createdAt: '2026-08-28T18:00:00.000Z',
      },
      {
        id: 'src_2',
        organizationId: 'org_a',
        clientId: 'client_a',
        name: 'B',
        type: 'RSS',
        url: 'https://b.test/feed',
        fetchIntervalMinutes: 360,
        status: 'ACTIVE',
        createdBy: 'admin_01',
        itemCount: 0,
        createdAt: '2026-08-28T18:00:00.000Z',
      }
    );

    const result = await pollAllActiveSources({ trusted: adminTrusted() });
    expect(result.polled).toBe(2);
    expect(result.created).toBeGreaterThan(0);
  });
});
