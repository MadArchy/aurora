import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_SUBCOLLECTIONS } from '../src/services/firestore/paths';
import { firestoreRealtimeListenersPerClient } from '../src/services/firestore/sync';
import { buildTrustedTenantScope } from '../src/ui/query/tenantScope';
import type { LocalV5Snapshot, User } from '../src/types';

const ADMIN_USER: User = {
  uid: 'uid_perf_a',
  organizationId: 'org_perf_a',
  email: 'perf-a@example.com',
  displayName: 'Perf A',
  role: 'ADMIN',
  status: 'ACTIVE',
  clientId: null,
  managerId: null,
  mustCompleteOnboarding: false,
  aiKeyManagementAllowed: true,
  locale: 'es-ES',
  timezone: 'America/Bogota',
  createdAt: '2026-10-19T00:00:00.000Z',
  createdBy: 'test',
  updatedAt: '2026-10-19T00:00:00.000Z',
  updatedBy: 'test',
};

type DbModule = typeof import('../src/services/db');
type ReadsModule = typeof import('../src/ui/data/compatibilityReads');

let db: DbModule['dbService'];
let reads: ReadsModule;
let saved: LocalV5Snapshot | null = null;

beforeEach(async () => {
  db = (await import('../src/services/db')).dbService;
  reads = await import('../src/ui/data/compatibilityReads');
  if (!saved) {
    saved = db.exportSnapshot();
    return;
  }
  db.releaseAdminDirectoryLoad();
  db.importSnapshot(saved, { merge: false, skipRemote: true });
});

afterEach(() => {
  if (!saved) return;
  db.releaseAdminDirectoryLoad();
  db.importSnapshot(saved, { merge: false, skipRemote: true });
});

function ensureDirectoryClient(): void {
  if (db.getClients().length > 0) return;
  db.createClient({
    organizationId: 'org_perf_a',
    primaryManagerId: 'user_admin_01',
    firstName: 'Perf',
    lastName: 'Directory',
    displayName: 'Perf Directory',
    primaryEmail: 'perf-directory@example.com',
    onboardingStatus: 'COMPLETED',
    status: 'ACTIVE',
  });
}

describe('PERF-A admin directory first', () => {
  it('counts 15 realtime listeners per client and 19 subcollections', () => {
    expect(CLIENT_SUBCOLLECTIONS).toHaveLength(19);
    expect(firestoreRealtimeListenersPerClient()).toBe(15);
  });

  it('publishes the client directory without clearing operational rows', () => {
    ensureDirectoryClient();
    const tasksBefore = db.exportSnapshot().tasks.map((task) => task.id);
    const clients = db.exportSnapshot().clients;
    const epoch = db.beginAdminDirectoryLoad();

    expect(db.applyAdminDirectorySnapshot(clients, epoch)).toBe('applied');
    expect(db.exportSnapshot().tasks.map((task) => task.id)).toEqual(tasksBefore);
    expect(db.getAdminDirectoryPhase()).toBe('READY');
    expect(db.getAdminIndicatorPhase()).toBe('LOADING');
  });

  it('drops a directory response from an older session', () => {
    ensureDirectoryClient();
    const clients = db.exportSnapshot().clients;
    const first = db.beginAdminDirectoryLoad();
    const second = db.beginAdminDirectoryLoad();

    expect(db.applyAdminDirectorySnapshot(clients, first)).toBe('stale');
    expect(db.getAdminDirectoryPhase()).toBe('LOADING');
    expect(db.isAdminLoadCurrent(second)).toBe(true);
  });

  it('keeps the previous directory when the client query fails', () => {
    ensureDirectoryClient();
    const idsBefore = db.getClients().map((client) => client.id);
    const epoch = db.beginAdminDirectoryLoad();
    db.markAdminDirectoryError(epoch);

    expect(db.getClients().map((client) => client.id)).toEqual(idsBefore);
    expect(db.getAdminDirectoryPhase()).toBe('ERROR');
    const overview = reads.readPortfolioOverview(buildTrustedTenantScope(ADMIN_USER));
    expect(overview.directoryStatus).toBe('ERROR');
    expect(overview.rows).toEqual([]);
  });

  it('reports indicators as pending instead of a finished zero', () => {
    ensureDirectoryClient();
    const clients = db.exportSnapshot().clients;
    const epoch = db.beginAdminDirectoryLoad();
    db.applyAdminDirectorySnapshot(clients, epoch);

    const overview = reads.readPortfolioOverview(buildTrustedTenantScope(ADMIN_USER));
    expect(overview.directoryStatus).toBe('READY');
    expect(overview.indicatorStatus).toBe('PENDING');
    expect(overview.totalClients).toBe(db.getClients().length);
    expect(overview.rows.every((row) => row.indicators === 'PENDING')).toBe(true);
    expect(overview.needingAttention).toBe(0);
    expect(overview.totalActiveTheses).toBe(0);
  });

  it('treats a server-empty directory as ready, and a later epoch as the only one that can finish', () => {
    const epoch = db.beginAdminDirectoryLoad();
    expect(db.applyAdminDirectorySnapshot([], epoch)).toBe('applied');
    expect(db.getAdminIndicatorPhase()).toBe('READY');
    expect(db.markAdminOperationalReady(epoch)).toBe('ready');

    const next = db.beginAdminDirectoryLoad();
    expect(db.markAdminOperationalReady(epoch)).toBe('stale');
    expect(db.markAdminOperationalReady(next)).toBe('ready');
  });
});
