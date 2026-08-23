import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_PERSIST_COLLECTION_KEYS,
  clientPersistIncludesCollection,
  filterSnapshotForPersistenceActor,
} from '../src/services/firestore/sync';
import type { LocalV5Snapshot } from '../src/services/firestore/types';

function emptySnapshot(overrides: Partial<LocalV5Snapshot> = {}): LocalV5Snapshot {
  return {
    clients: [],
    theses: [],
    profiles: {},
    sources: [],
    signals: [],
    recommendations: [],
    tasks: [],
    contents: [],
    opportunities: [],
    campaigns: [],
    campaignMilestones: [],
    evidenceVault: [],
    aiRuns: [],
    subscription: null,
    invitations: [],
    results: [],
    curation: [],
    deliveries: [],
    advices: [],
    files: [],
    topicPins: [],
    dossiers: {},
    feedbackEvents: [],
    signalOutcomes: [],
    proofWallItems: [],
    notifications: [],
    ...overrides,
  };
}

describe('SPEC-009 Phase 2 — actor-aware persistence (A21)', () => {
  it('CLIENT persist allowlist excludes manager-only collections', () => {
    expect(clientPersistIncludesCollection('signals')).toBe(false);
    expect(clientPersistIncludesCollection('sources')).toBe(false);
    expect(clientPersistIncludesCollection('signalOutcomes')).toBe(false);
    expect(clientPersistIncludesCollection('aiRuns')).toBe(false);
    expect(clientPersistIncludesCollection('tasks')).toBe(true);
    expect(CLIENT_PERSIST_COLLECTION_KEYS).toContain('feedbackEvents');
  });

  it('Actor-aware CLIENT persistence excludes manager-only resources', () => {
    const snapshot = emptySnapshot({
      clients: [
        { id: 'client_juan_001', organizationId: 'org_a' } as LocalV5Snapshot['clients'][number],
        { id: 'client_elena_002', organizationId: 'org_a' } as LocalV5Snapshot['clients'][number],
      ],
      signals: [{ id: 'sig_1', clientId: 'client_juan_001' } as LocalV5Snapshot['signals'][number]],
      sources: [{ id: 'src_1', clientId: 'client_juan_001' } as LocalV5Snapshot['sources'][number]],
      signalOutcomes: [
        { id: 'so_1', clientId: 'client_juan_001' } as LocalV5Snapshot['signalOutcomes'][number],
      ],
      aiRuns: [{ id: 'run_1', clientId: 'client_juan_001' } as LocalV5Snapshot['aiRuns'][number]],
      tasks: [{ id: 'task_1', clientId: 'client_juan_001' } as LocalV5Snapshot['tasks'][number]],
      dossiers: {
        client_juan_001: { clientId: 'client_juan_001' } as LocalV5Snapshot['dossiers'][string],
      },
      profiles: {
        client_juan_001: { clientId: 'client_juan_001' } as LocalV5Snapshot['profiles'][string],
      },
    });

    const filtered = filterSnapshotForPersistenceActor(snapshot, {
      role: 'CLIENT',
      clientId: 'client_juan_001',
      organizationId: 'org_a',
    });

    expect(filtered.clients.map((c) => c.id)).toEqual(['client_juan_001']);
    expect(filtered.signals).toEqual([]);
    expect(filtered.sources).toEqual([]);
    expect(filtered.signalOutcomes).toEqual([]);
    expect(filtered.aiRuns).toEqual([]);
    expect(filtered.dossiers).toEqual({});
    expect(filtered.tasks).toHaveLength(1);
    expect(filtered.profiles.client_juan_001).toBeTruthy();
  });

  it('ADMIN persistence retains manager collections', () => {
    const snapshot = emptySnapshot({
      clients: [{ id: 'client_juan_001', organizationId: 'org_a' } as LocalV5Snapshot['clients'][number]],
      signals: [{ id: 'sig_1', clientId: 'client_juan_001' } as LocalV5Snapshot['signals'][number]],
    });
    const filtered = filterSnapshotForPersistenceActor(snapshot, {
      role: 'ADMIN',
      organizationId: 'org_a',
    });
    expect(filtered.signals).toHaveLength(1);
  });
});

/** Production write-path modules that must not hardcode tenant ids. */
const A22_WRITE_PATH_GLOBS = [
  'src/main.ts',
  'src/services/topicAgent.ts',
  'src/services/researchSignalsAgent.ts',
  'src/services/notifications.ts',
  'src/services/firestore/sync.ts',
];

const HARDCODED_ORG_RE =
  /organizationId\s*:\s*['"]org_aurora_01['"]|organizationId\s*\|\|\s*['"]org_aurora_01['"]|\|\|\s*['"]org_aurora_01['"]/;

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, out);
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('SPEC-009 Phase 2 — hardcoded organization regression (A22)', () => {
  it('production UI write paths do not hardcode org_aurora_01', () => {
    const root = process.cwd();
    for (const rel of A22_WRITE_PATH_GLOBS) {
      const text = readFileSync(resolve(root, rel), 'utf8');
      const hits = text.match(HARDCODED_ORG_RE) || [];
      expect(hits, rel).toEqual([]);
    }
  });

  it('full src/ scan: no write-path module depends on hardcoded org_aurora_01', () => {
    const root = resolve(process.cwd(), 'src');
    const files = walkTsFiles(root);
    const writePathHits: Array<{ file: string; line: number; snippet: string }> = [];

    // Seed/demo/auth-session defaults are not tenant write paths for A22.
    const allowlistedExact = new Set([
      'src/services/auth.ts',
      'src/firebase/claims.ts',
      'src/services/db.ts', // built-in seed + local subscription default (not a runtime tenant writer)
    ]);

    for (const file of files) {
      const rel = relative(process.cwd(), file).replace(/\\/g, '/');
      if (rel.startsWith('src/data/')) continue;
      if (allowlistedExact.has(rel)) continue;

      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (HARDCODED_ORG_RE.test(line) || /['"]org_aurora_01['"]/.test(line)) {
          writePathHits.push({ file: rel, line: idx + 1, snippet: line.trim() });
        }
      });
    }

    expect(writePathHits).toEqual([]);
  });
});
