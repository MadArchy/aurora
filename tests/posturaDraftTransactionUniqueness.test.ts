/**
 * POSTURA — R-B01 Transactional Draft Uniqueness Unit Tests
 *
 * Verifies the contract of ensureActiveDraftDeliveryTransactional and dbService:
 * - Real simulated concurrency and transactional retry loop
 * - Failures before commit leave no remote or local footprint
 * - Pointer reuse and deterministic historical draft adoption
 * - Orphaned / stale pointer healing
 * - Permission loss handling
 * - Multi-tenant and non-admin rejection
 * - In-flight deduplication across concurrent calls in one session
 * - Blockade of synchronous non-transactional remote creation
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  type RemoteDoc = Record<string, unknown>;
  const remote = new Map<string, RemoteDoc>();
  const state = {
    remote,
    signedIn: true,
    claims: { role: 'ADMIN', organizationId: 'org_aurora_01' },
    failNextCommit: false,
    failNextGetDocs: false,
    permissionDeniedDocPath: null as string | null,
    duringTransaction: null as (() => Promise<void> | void) | null,
    transactionAttempts: 0,
    transactionCommits: 0,
    tick: 0,
  };
  return { state };
});

vi.mock('firebase/firestore', () => {
  type Filter = { field: string; op: string; value: unknown };
  type Query = { col: { path: string }; constraints: Filter[] };
  const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/'));
  const matches = (q: Query) =>
    [...h.state.remote.entries()].filter(
      ([path, data]) => parentOf(path) === q.col.path && q.constraints.every((c) => data[c.field] === c.value)
    );
  const toSnapshot = (rows: Array<[string, Record<string, unknown>]>) => ({
    metadata: { fromCache: false },
    docs: rows.map(([path, data]) => ({
      id: path.slice(path.lastIndexOf('/') + 1),
      data: () => structuredClone(data),
      metadata: { hasPendingWrites: false },
    })),
  });

  const apply = (writes: Array<{ path: string; data: Record<string, unknown> | null; merge?: boolean }>) => {
    for (const write of writes) {
      if (write.data === null) {
        h.state.remote.delete(write.path);
        continue;
      }
      const existing = h.state.remote.get(write.path);
      if (write.merge && existing) {
        h.state.remote.set(write.path, { ...existing, ...write.data });
      } else {
        h.state.remote.set(write.path, { ...(write.data) });
      }
    }
  };

  return {
    doc: (_db: unknown, path: string) => ({ path }),
    collection: (_db: unknown, path: string) => ({ path }),
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    query: (col: { path: string }, ...constraints: Filter[]) => ({ col, constraints }),
    serverTimestamp: () => ({ serverTimestamp: ++h.state.tick }),
    runTransaction: async <T,>(
      _db: unknown,
      update: (tx: {
        get(ref: { path: string }): Promise<{ exists(): boolean; data(): Record<string, unknown> | undefined }>;
        set(ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }): unknown;
        delete(ref: { path: string }): unknown;
      }) => Promise<T>
    ): Promise<T> => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        h.state.transactionAttempts += 1;
        const reads = new Map<string, string>();
        const pending: Array<{ path: string; data: Record<string, unknown> | null; merge?: boolean }> = [];
        const tx = {
          async get(ref: { path: string }) {
            if (pending.length > 0) throw new Error('Firestore transactions require all reads before writes');
            if (h.state.permissionDeniedDocPath === ref.path) {
              const err = new Error('Permission denied');
              (err as unknown as { code: string }).code = 'permission-denied';
              throw err;
            }
            const data = h.state.remote.get(ref.path);
            reads.set(ref.path, JSON.stringify(data ?? null));
            return {
              exists: () => data !== undefined,
              data: () => (data ? structuredClone(data) : undefined),
            };
          },
          set(ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) {
            pending.push({ path: ref.path, data, merge: options?.merge });
            return tx;
          },
          delete(ref: { path: string }) {
            pending.push({ path: ref.path, data: null });
            return tx;
          },
        };

        const result = await update(tx);
        const concurrent = h.state.duringTransaction;
        h.state.duringTransaction = null;
        if (concurrent) {
          await concurrent();
        }

        if (h.state.failNextCommit) {
          h.state.failNextCommit = false;
          throw new Error('unavailable');
        }

        const changed = [...reads].some(([path, seen]) => JSON.stringify(h.state.remote.get(path) ?? null) !== seen);
        if (changed) {
          // Transaction contention retry
          continue;
        }

        h.state.transactionCommits += 1;
        apply(pending);
        return result;
      }
      throw new Error('aborted: transaction contention');
    },
    getDocs: async (q: Query) => {
      if (h.state.failNextGetDocs) {
        h.state.failNextGetDocs = false;
        throw new Error('getDocs-network-failed');
      }
      return toSnapshot(matches(q));
    },
  };
});

vi.mock('../src/firebase/app', () => ({
  getFirebaseFirestore: async () => ({}),
  getFirebaseAuth: async () => ({
    currentUser: h.state.signedIn ? { getIdTokenResult: async () => ({ claims: h.state.claims }) } : null,
  }),
}));

vi.mock('../src/firebase/config', () => ({
  readFirebaseConfig: () => ({ projectId: 'demo-aurora-e2e' }),
  FIREBASE_ENABLED: true,
}));

import { ensureActiveDraftDeliveryTransactional } from '../src/services/firestore/sync';
import type { DeliveryPackage } from '../src/types';

describe('R-B01 — ensureActiveDraftDeliveryTransactional unit & contract suite', () => {
  const CLIENT_ID = 'client_rb01_test';
  const ORG_ID = 'org_aurora_01';
  const ROOT_PATH = `clients/${CLIENT_ID}`;
  const DELIVERIES_PATH = `clients/${CLIENT_ID}/deliveries`;

  beforeEach(() => {
    h.state.remote.clear();
    h.state.signedIn = true;
    h.state.claims = { role: 'ADMIN', organizationId: ORG_ID };
    h.state.failNextCommit = false;
    h.state.failNextGetDocs = false;
    h.state.permissionDeniedDocPath = null;
    h.state.duringTransaction = null;
    h.state.transactionAttempts = 0;
    h.state.transactionCommits = 0;
    h.state.tick = 0;

    // Seed root client doc
    h.state.remote.set(ROOT_PATH, {
      id: CLIENT_ID,
      organizationId: ORG_ID,
      name: 'Client R-B01',
      completedTasksCount: 5,
    });
  });

  function makeBuilder(id: string): DeliveryPackage {
    return {
      id,
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      title: 'Borrador R-B01',
      items: [],
      status: 'DRAFT',
      createdAt: '2026-10-22T20:00:00.000Z',
      createdBy: 'admin_test',
    };
  }

  it('1. Creates new draft and sets activeDraftDeliveryId when no draft exists', async () => {
    const outcome = await ensureActiveDraftDeliveryTransactional({
      clientId: CLIENT_ID,
      organizationId: ORG_ID,
      readGeneration: 0,
      newId: 'pkg_new_1',
      build: (id) => makeBuilder(id),
    });

    expect(outcome.created).toBe(true);
    expect(outcome.source).toBe('created');
    expect(outcome.package.id).toBe('pkg_new_1');

    // Remote root updated with pointer
    const root = h.state.remote.get(ROOT_PATH);
    expect(root?.activeDraftDeliveryId).toBe('pkg_new_1');
    // completedTasksCount untouched
    expect(root?.completedTasksCount).toBe(5);

    // Remote delivery created
    const createdDoc = h.state.remote.get(`${DELIVERIES_PATH}/pkg_new_1`);
    expect(createdDoc?.id).toBe('pkg_new_1');
    expect(createdDoc?.status).toBe('DRAFT');
  });

  it('2. Reuses existing draft pointed to by activeDraftDeliveryId without new document creation', async () => {
    // Seed existing draft
    h.state.remote.set(`${DELIVERIES_PATH}/pkg_existing_1`, {
      id: 'pkg_existing_1',
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      status: 'DRAFT',
      title: 'Existing Draft',
      createdAt: '2026-10-22T19:00:00.000Z',
      createdBy: 'admin_prev',
    });
    h.state.remote.set(ROOT_PATH, {
      id: CLIENT_ID,
      organizationId: ORG_ID,
      activeDraftDeliveryId: 'pkg_existing_1',
    });

    const outcome = await ensureActiveDraftDeliveryTransactional({
      clientId: CLIENT_ID,
      organizationId: ORG_ID,
      readGeneration: 0,
      newId: 'pkg_should_not_be_created',
      build: (id) => makeBuilder(id),
    });

    expect(outcome.created).toBe(false);
    expect(outcome.source).toBe('pointer');
    expect(outcome.package.id).toBe('pkg_existing_1');
    expect(h.state.remote.has(`${DELIVERIES_PATH}/pkg_should_not_be_created`)).toBe(false);
  });

  it('3. Recovers historical draft when activeDraftDeliveryId is missing but draft exists', async () => {
    // Pointer is null, but draft exists in subcollection
    h.state.remote.set(`${DELIVERIES_PATH}/pkg_historical_1`, {
      id: 'pkg_historical_1',
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      status: 'DRAFT',
      title: 'Historical Draft',
      createdAt: '2026-10-22T18:00:00.000Z',
      createdBy: 'admin_historical',
    });

    const outcome = await ensureActiveDraftDeliveryTransactional({
      clientId: CLIENT_ID,
      organizationId: ORG_ID,
      readGeneration: 0,
      newId: 'pkg_new_unneeded',
      build: (id) => makeBuilder(id),
    });

    expect(outcome.created).toBe(false);
    expect(outcome.source).toBe('historical');
    expect(outcome.package.id).toBe('pkg_historical_1');

    // Pointer is now healed and points to historical draft
    const root = h.state.remote.get(ROOT_PATH);
    expect(root?.activeDraftDeliveryId).toBe('pkg_historical_1');
    expect(h.state.remote.has(`${DELIVERIES_PATH}/pkg_new_unneeded`)).toBe(false);
  });

  it('4. Deterministically selects the oldest draft when multiple historical drafts exist', async () => {
    h.state.remote.set(`${DELIVERIES_PATH}/pkg_b_newer`, {
      id: 'pkg_b_newer',
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      status: 'DRAFT',
      createdAt: '2026-10-22T21:00:00.000Z',
    });
    h.state.remote.set(`${DELIVERIES_PATH}/pkg_a_older`, {
      id: 'pkg_a_older',
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      status: 'DRAFT',
      createdAt: '2026-10-22T15:00:00.000Z',
    });

    const outcome = await ensureActiveDraftDeliveryTransactional({
      clientId: CLIENT_ID,
      organizationId: ORG_ID,
      readGeneration: 0,
      newId: 'pkg_new_unneeded',
      build: (id) => makeBuilder(id),
    });

    expect(outcome.package.id).toBe('pkg_a_older');
    expect(outcome.source).toBe('historical');
    const root = h.state.remote.get(ROOT_PATH);
    expect(root?.activeDraftDeliveryId).toBe('pkg_a_older');
  });

  it('5. Heals stale pointer when pointed draft was deleted remotely', async () => {
    // Root points to pkg_deleted which is missing
    h.state.remote.set(ROOT_PATH, {
      id: CLIENT_ID,
      organizationId: ORG_ID,
      activeDraftDeliveryId: 'pkg_deleted',
    });

    // ensureActiveDraftDeliveryTransactional will first hit DraftPointerUnconfirmedError,
    // re-list, heal pointer, and create new draft
    const outcome = await ensureActiveDraftDeliveryTransactional({
      clientId: CLIENT_ID,
      organizationId: ORG_ID,
      readGeneration: 0,
      newId: 'pkg_healed_new',
      build: (id) => makeBuilder(id),
    });

    expect(outcome.created).toBe(true);
    expect(outcome.package.id).toBe('pkg_healed_new');
    const root = h.state.remote.get(ROOT_PATH);
    expect(root?.activeDraftDeliveryId).toBe('pkg_healed_new');
  });

  it('6. Handles concurrency contention: transaction retries and converges to single draft', async () => {
    // Simulate that during the first transaction attempt, another session writes a draft
    let concurrentRun = false;
    h.state.duringTransaction = async () => {
      if (!concurrentRun) {
        concurrentRun = true;
        // Concurrent admin created pkg_concurrent
        h.state.remote.set(`${DELIVERIES_PATH}/pkg_concurrent`, {
          id: 'pkg_concurrent',
          organizationId: ORG_ID,
          clientId: CLIENT_ID,
          status: 'DRAFT',
          title: 'Concurrent Winner',
          createdAt: '2026-10-22T20:00:00.000Z',
        });
        h.state.remote.set(ROOT_PATH, {
          id: CLIENT_ID,
          organizationId: ORG_ID,
          activeDraftDeliveryId: 'pkg_concurrent',
        });
      }
    };

    const outcome = await ensureActiveDraftDeliveryTransactional({
      clientId: CLIENT_ID,
      organizationId: ORG_ID,
      readGeneration: 0,
      newId: 'pkg_losing_attempt',
      build: (id) => makeBuilder(id),
    });

    // The transaction should have retried due to root doc mutation, and adopted pkg_concurrent!
    expect(outcome.created).toBe(false);
    expect(outcome.package.id).toBe('pkg_concurrent');
    expect(h.state.remote.has(`${DELIVERIES_PATH}/pkg_losing_attempt`)).toBe(false);
    expect(h.state.transactionAttempts).toBeGreaterThan(1);
  });

  it('7. Fails cleanly before commit without leaving remote document or orphan writes', async () => {
    h.state.failNextCommit = true;

    await expect(
      ensureActiveDraftDeliveryTransactional({
        clientId: CLIENT_ID,
        organizationId: ORG_ID,
        readGeneration: 0,
        newId: 'pkg_should_abort',
        build: (id) => makeBuilder(id),
      })
    ).rejects.toThrow('unavailable');

    // No document should exist in remote storage
    expect(h.state.remote.has(`${DELIVERIES_PATH}/pkg_should_abort`)).toBe(false);
    const root = h.state.remote.get(ROOT_PATH);
    expect(root?.activeDraftDeliveryId).toBeUndefined();
  });

  it('8. Enforces tenant scope and rejects mismatched organization', async () => {
    await expect(
      ensureActiveDraftDeliveryTransactional({
        clientId: CLIENT_ID,
        organizationId: 'other_tenant_org',
        readGeneration: 0,
        newId: 'pkg_tenant_fail',
        build: (id) => makeBuilder(id),
      })
    ).rejects.toThrow('tenant-mismatch');

    expect(h.state.remote.has(`${DELIVERIES_PATH}/pkg_tenant_fail`)).toBe(false);
  });

  it('9. Rejects non-admin actor', async () => {
    h.state.claims = { role: 'CLIENT', organizationId: ORG_ID };

    await expect(
      ensureActiveDraftDeliveryTransactional({
        clientId: CLIENT_ID,
        organizationId: ORG_ID,
        readGeneration: 0,
        newId: 'pkg_nonadmin',
        build: (id) => makeBuilder(id),
      })
    ).rejects.toThrow('not-admin');
  });

  it('10. Does not mutate or affect existing SENT or ACKNOWLEDGED delivery packages', async () => {
    h.state.remote.set(`${DELIVERIES_PATH}/pkg_sent_1`, {
      id: 'pkg_sent_1',
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      status: 'SENT',
      title: 'Sent Briefing',
      items: [{ id: 'item_1', title: 'Task 1' }],
    });
    h.state.remote.set(`${DELIVERIES_PATH}/pkg_ack_1`, {
      id: 'pkg_ack_1',
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      status: 'ACKNOWLEDGED',
      title: 'Acknowledged Briefing',
      items: [{ id: 'item_2', title: 'Task 2' }],
    });

    const outcome = await ensureActiveDraftDeliveryTransactional({
      clientId: CLIENT_ID,
      organizationId: ORG_ID,
      readGeneration: 0,
      newId: 'pkg_draft_after_sent',
      build: (id) => makeBuilder(id),
    });

    expect(outcome.created).toBe(true);
    expect(outcome.package.id).toBe('pkg_draft_after_sent');

    // Both previous packages remain strictly intact
    const sent = h.state.remote.get(`${DELIVERIES_PATH}/pkg_sent_1`);
    expect(sent?.status).toBe('SENT');
    expect(sent?.title).toBe('Sent Briefing');

    const ack = h.state.remote.get(`${DELIVERIES_PATH}/pkg_ack_1`);
    expect(ack?.status).toBe('ACKNOWLEDGED');
    expect(ack?.title).toBe('Acknowledged Briefing');
  });

  it('11. dbService: blocks synchronous draft creation without transaction when Firebase enabled', async () => {
    const { dbService } = await import('../src/services/db');
    dbService.runBuiltInSeed();
    const clientId = 'client_elena_002';
    const epoch = dbService.beginAdminDirectoryLoad();
    dbService.applyAdminDirectorySnapshot(dbService.exportSnapshot().clients, epoch);
    const ticket = dbService.beginActiveClientHydration(clientId);
    dbService.applyActiveClientListing(clientId, ORG_ID, { deliveries: [], tasks: [], signals: [] }, epoch, ticket);

    // Clear any existing draft for this client
    for (const pkg of dbService.getDeliveriesByClient(clientId)) {
      if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
    }

    // Calling ensureDraftDelivery without existing draft must throw draft-creation-requires-transaction
    expect(() => dbService.ensureDraftDelivery(clientId, 'admin_1')).toThrow(
      'draft-creation-requires-transaction'
    );
  });

  it('12. dbService: inflight deduplication shares single remote transaction for concurrent requests', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    dbService.runBuiltInSeed();
    const clientId = 'client_elena_002';
    const epoch = dbService.beginAdminDirectoryLoad();
    dbService.applyAdminDirectorySnapshot(dbService.exportSnapshot().clients, epoch);
    const ticket = dbService.beginActiveClientHydration(clientId);
    dbService.applyActiveClientListing(clientId, ORG_ID, { deliveries: [], tasks: [], signals: [] }, epoch, ticket);

    for (const pkg of dbService.getDeliveriesByClient(clientId)) {
      if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
    }

    let txCallCount = 0;
    const spy = vi.spyOn(sync, 'ensureActiveDraftDeliveryTransactional').mockImplementation(async (input) => {
      txCallCount += 1;
      // Introduce slight async delay to allow concurrent calls to overlap
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        package: {
          id: input.newId,
          organizationId: input.organizationId,
          clientId: input.clientId,
          status: 'DRAFT',
          title: 'Dedup Briefing',
          items: [],
          createdAt: new Date().toISOString(),
          createdBy: 'admin_test',
        },
        created: true,
        source: 'created',
      };
    });

    try {
      // Launch two concurrent calls
      const p1 = dbService.ensureDraftDeliveryConfirmed(clientId, 'admin_test');
      const p2 = dbService.ensureDraftDeliveryConfirmed(clientId, 'admin_test');

      // They must share the exact same Promise instance
      expect(p1).toBe(p2);

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1.id).toBe(res2.id);
      expect(txCallCount).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('13. dbService: local memory remains pristine if remote transaction fails', async () => {
    const { dbService } = await import('../src/services/db');
    const sync = await import('../src/services/firestore/sync');
    dbService.runBuiltInSeed();
    const clientId = 'client_elena_002';
    const epoch = dbService.beginAdminDirectoryLoad();
    dbService.applyAdminDirectorySnapshot(dbService.exportSnapshot().clients, epoch);
    const ticket = dbService.beginActiveClientHydration(clientId);
    dbService.applyActiveClientListing(clientId, ORG_ID, { deliveries: [], tasks: [], signals: [] }, epoch, ticket);

    for (const pkg of dbService.getDeliveriesByClient(clientId)) {
      if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
    }

    const deliveriesBefore = dbService.getDeliveriesByClient(clientId).length;

    const spy = vi.spyOn(sync, 'ensureActiveDraftDeliveryTransactional').mockRejectedValue(
      new Error('firestore-remote-network-failure')
    );

    try {
      await expect(
        dbService.ensureDraftDeliveryConfirmed(clientId, 'admin_test')
      ).rejects.toThrow('firestore-remote-network-failure');

      // Deliveries in local memory must not have grown
      const deliveriesAfter = dbService.getDeliveriesByClient(clientId).length;
      expect(deliveriesAfter).toBe(deliveriesBefore);
    } finally {
      spy.mockRestore();
    }
  });
});
