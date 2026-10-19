import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTrustedTenantScope } from '../src/ui/query/tenantScope';
import type { LocalV5Snapshot } from '../src/services/firestore/types';
import type { AIRunRecord, DeliveryPackage, Recommendation, User } from '../src/types';

const ADMIN_USER: User = {
  uid: 'uid_perf_b',
  organizationId: 'org_perf_b',
  email: 'perf-b@example.com',
  displayName: 'Perf B',
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

function organizationId(): string {
  const client = db.getClients()[0];
  if (!client) throw new Error('seed-client-missing');
  return client.organizationId;
}

function publishDirectory(): number {
  const clients = db.exportSnapshot().clients;
  const epoch = db.beginAdminDirectoryLoad();
  expect(db.applyAdminDirectorySnapshot(clients, epoch)).toBe('applied');
  return epoch;
}

function run(clientId: string, id: string): AIRunRecord {
  return {
    id,
    organizationId: organizationId(),
    clientId,
    agent: 'RESEARCH_SIGNALS',
    provider: 'OPENAI',
    modelName: 'test',
    promptTemplateId: 'tpl',
    inputContextSummary: 'context',
    outputPayload: 'output',
    promptTokens: 1,
    completionTokens: 1,
    totalCostUsd: 0,
    latencyMs: 1,
    validationPassed: true,
    securityCheckPassed: true,
    status: 'SUCCESS',
    createdAt: '2026-10-19T00:00:00.000Z',
  };
}

function recommendation(clientId: string, id: string): Recommendation {
  return {
    id,
    thesisId: 'thesis_test',
    clientId,
    type: 'ARTICLE_LONG',
    proposedAngle: 'angle',
    strategicRationale: 'rationale',
    urgency: 'LOW',
    impactScore: 1,
    status: 'GENERATED',
    createdAt: '2026-10-19T00:00:00.000Z',
  };
}

describe('PERF-B active client hydration', () => {
  it('keeps unloaded clients pending and does not treat them as empty', () => {
    const juan = db.getClients().find((client) => client.id === 'client_juan_001');
    const elena = db.getClients().find((client) => client.id === 'client_elena_002');
    expect(juan).toBeTruthy();
    expect(elena).toBeTruthy();
    const juanTasks = db.exportSnapshot().tasks.filter((task) => task.clientId === 'client_juan_001').map((task) => task.id);
    const elenaTasks = db.exportSnapshot().tasks.filter((task) => task.clientId === 'client_elena_002').map((task) => task.id);
    expect(juanTasks.length).toBeGreaterThan(0);

    publishDirectory();

    expect(db.getClientOperationalPhase('client_juan_001')).toBe('NOT_LOADED');
    expect(db.getClientOperationalPhase('client_elena_002')).toBe('NOT_LOADED');
    expect(db.exportSnapshot().tasks.filter((task) => task.clientId === 'client_elena_002').map((task) => task.id)).toEqual(elenaTasks);
    const overview = reads.readPortfolioOverview(buildTrustedTenantScope({ ...ADMIN_USER, organizationId: organizationId() }));
    expect(overview.indicatorStatus).toBe('PENDING');
    expect(overview.rows.every((row) => row.indicators === 'PENDING')).toBe(true);
    expect(overview.needingAttention).toBe(0);
  });

  it('replaces only the hydrated client and leaves the other client rows in place', () => {
    publishDirectory();
    const before = db.exportSnapshot();
    const elenaTaskIds = before.tasks.filter((task) => task.clientId === 'client_elena_002').map((task) => task.id);
    const completed = db.getClientById('client_juan_001')?.completedTasksCount;
    const epoch = db.getAdminLoadEpoch();
    const ticket = db.beginActiveClientHydration('client_juan_001');
    const applied = db.applyActiveClientListing(
      'client_juan_001',
      organizationId(),
      {
        tasks: before.tasks.filter((task) => task.clientId === 'client_juan_001'),
        signals: before.signals.filter((signal) => signal.clientId === 'client_juan_001'),
      },
      ticket,
      epoch
    );

    expect(applied).toBe('applied');
    expect(db.getClientOperationalPhase('client_juan_001')).toBe('READY');
    expect(db.getClientOperationalPhase('client_elena_002')).toBe('NOT_LOADED');
    expect(db.exportSnapshot().tasks.filter((task) => task.clientId === 'client_elena_002').map((task) => task.id)).toEqual(elenaTaskIds);
    expect(db.getClientById('client_juan_001')?.completedTasksCount).toBe(completed);
    const overview = reads.readPortfolioOverview(buildTrustedTenantScope({ ...ADMIN_USER, organizationId: organizationId() }));
    expect(overview.indicatorStatus).toBe('PENDING');
    expect(overview.rows.find((row) => row.clientId === 'client_juan_001')?.indicators).toBe('READY');
    expect(overview.rows.find((row) => row.clientId === 'client_elena_002')?.indicators).toBe('PENDING');
  });

  it('does not import a failed read as an empty collection', () => {
    publishDirectory();
    const elenaTaskIds = db.exportSnapshot().tasks.filter((task) => task.clientId === 'client_elena_002').map((task) => task.id);
    const epoch = db.getAdminLoadEpoch();
    const ticket = db.beginActiveClientHydration('client_juan_001');
    const result = db.applyActiveClientListing('client_juan_001', organizationId(), {}, ticket, epoch);

    expect(result).toBe('rejected');
    expect(db.getClientOperationalPhase('client_juan_001')).toBe('ERROR');
    expect(db.exportSnapshot().tasks.filter((task) => task.clientId === 'client_elena_002').map((task) => task.id)).toEqual(elenaTaskIds);
    expect(db.exportSnapshot().tasks.filter((task) => task.clientId === 'client_juan_001').length).toBeGreaterThan(0);
  });

  it('drops a listing from an older load or an older ticket', () => {
    const epoch = publishDirectory();
    const ticket = db.beginActiveClientHydration('client_juan_001');
    const next = db.beginAdminDirectoryLoad();
    const tasksBefore = db.exportSnapshot().tasks.map((task) => task.id);

    expect(db.applyActiveClientListing('client_juan_001', organizationId(), { tasks: [], signals: [] }, ticket, epoch)).toBe('stale');
    expect(db.getAdminLoadEpoch()).toBe(next);
    expect(db.exportSnapshot().tasks.map((task) => task.id)).toEqual(tasksBefore);

    const current = db.beginActiveClientHydration('client_juan_001');
    expect(
      db.applyActiveClientListing('client_juan_001', organizationId(), { tasks: [], signals: [] }, ticket, db.getAdminLoadEpoch())
    ).toBe('stale');
    expect(current).toBeGreaterThan(ticket);
    expect(db.exportSnapshot().tasks.map((task) => task.id)).toEqual(tasksBefore);
  });

  it('marks a confirmed empty listing as EMPTY and does not delete the other client', () => {
    publishDirectory();
    const juanTaskIds = db.exportSnapshot().tasks.filter((task) => task.clientId === 'client_juan_001').map((task) => task.id);
    const epoch = db.getAdminLoadEpoch();
    const ticket = db.beginActiveClientHydration('client_elena_002');
    const result = db.applyActiveClientListing(
      'client_elena_002',
      organizationId(),
      {
        tasks: [],
        signals: [],
        theses: [],
        sources: [],
        recommendations: [],
        aiRuns: [],
        campaigns: [],
        deliveries: [],
        curation: [],
        opportunities: [],
        results: [],
        evidenceVault: [],
        advices: [],
        feedbackEvents: [],
        signalOutcomes: [],
        proofWallItems: [],
        notifications: [],
        campaignMilestones: [],
        contents: [],
        profiles: {},
        dossiers: {},
      },
      ticket,
      epoch
    );

    expect(result).toBe('empty');
    expect(db.getClientOperationalPhase('client_elena_002')).toBe('EMPTY');
    expect(db.exportSnapshot().tasks.filter((task) => task.clientId === 'client_juan_001').map((task) => task.id)).toEqual(juanTaskIds);
    expect(db.exportSnapshot().tasks.filter((task) => task.clientId === 'client_elena_002')).toEqual([]);
  });

  it('scopes aiRuns and recommendations to the hydrated client', () => {
    const org = organizationId();
    db.importSnapshot(
      {
        aiRuns: [run('client_juan_001', 'run_juan'), run('client_elena_002', 'run_elena')],
        recommendations: [
          recommendation('client_juan_001', 'rec_juan'),
          recommendation('client_elena_002', 'rec_elena'),
        ],
      },
      { merge: false, skipRemote: true }
    );
    publishDirectory();
    const epoch = db.getAdminLoadEpoch();
    const ticket = db.beginActiveClientHydration('client_juan_001');
    db.applyActiveClientListing(
      'client_juan_001',
      org,
      {
        tasks: db.exportSnapshot().tasks.filter((task) => task.clientId === 'client_juan_001'),
        signals: db.exportSnapshot().signals.filter((signal) => signal.clientId === 'client_juan_001'),
        aiRuns: [run('client_juan_001', 'run_juan_next')],
        recommendations: [recommendation('client_juan_001', 'rec_juan_next')],
      },
      ticket,
      epoch
    );

    const snapshot = db.exportSnapshot();
    expect(snapshot.aiRuns.filter((row) => row.clientId === 'client_elena_002').map((row) => row.id)).toEqual(['run_elena']);
    expect(snapshot.aiRuns.filter((row) => row.clientId === 'client_juan_001').map((row) => row.id)).toEqual(['run_juan_next']);
    expect(snapshot.recommendations.filter((row) => row.clientId === 'client_elena_002').map((row) => row.id)).toEqual(['rec_elena']);
    expect(snapshot.recommendations.filter((row) => row.clientId === 'client_juan_001').map((row) => row.id)).toEqual(['rec_juan_next']);
  });

  it('rejects a listing whose organization does not match the client', () => {
    publishDirectory();
    const tasksBefore = db.exportSnapshot().tasks.map((task) => task.id);
    const epoch = db.getAdminLoadEpoch();
    const ticket = db.beginActiveClientHydration('client_juan_001');

    expect(db.applyActiveClientListing('client_juan_001', 'org_other', { tasks: [], signals: [] }, ticket, epoch)).toBe('rejected');
    expect(db.getClientOperationalPhase('client_juan_001')).toBe('ERROR');
    expect(db.exportSnapshot().tasks.map((task) => task.id)).toEqual(tasksBefore);
  });

  it('confirms deliveries for one client without loading or clearing the other collections', () => {
    publishDirectory();
    const before = db.exportSnapshot();
    const juanDeliveryIds = before.deliveries.filter((row) => row.clientId === 'client_juan_001').map((row) => row.id);
    const elenaSignalIds = before.signals.filter((row) => row.clientId === 'client_elena_002').map((row) => row.id);
    const epoch = db.getAdminLoadEpoch();
    const draft: DeliveryPackage = {
      id: 'pkg_elena_confirmed',
      organizationId: organizationId(),
      clientId: 'client_elena_002',
      title: 'Borrador confirmado',
      strategicNote: '',
      periodLabel: 'octubre 2026',
      items: [],
      status: 'DRAFT',
      createdAt: '2026-10-19T00:00:00.000Z',
      createdBy: 'test',
    };

    expect(db.applyConfirmedDeliveriesListing('client_elena_002', organizationId(), [draft], epoch)).toBe('applied');
    expect(db.getClientOperationalPhase('client_elena_002')).toBe('NOT_LOADED');
    expect(db.getClientOperationalPhase('client_juan_001')).toBe('NOT_LOADED');
    expect(db.getDraftDelivery('client_elena_002')?.id).toBe('pkg_elena_confirmed');
    expect(db.ensureDraftDelivery('client_elena_002', 'test').id).toBe('pkg_elena_confirmed');
    expect(db.exportSnapshot().deliveries.filter((row) => row.clientId === 'client_elena_002')).toHaveLength(1);
    expect(db.exportSnapshot().deliveries.filter((row) => row.clientId === 'client_juan_001').map((row) => row.id)).toEqual(juanDeliveryIds);
    expect(db.exportSnapshot().signals.filter((row) => row.clientId === 'client_elena_002').map((row) => row.id)).toEqual(elenaSignalIds);
    expect(db.exportSnapshot().tasks.filter((task) => task.clientId === 'client_juan_001').length).toBeGreaterThan(0);

    expect(db.applyConfirmedDeliveriesListing('client_elena_002', 'org_other', [], epoch)).toBe('rejected');
    expect(db.getDraftDelivery('client_elena_002')?.id).toBe('pkg_elena_confirmed');
    expect(db.applyConfirmedDeliveriesListing('client_elena_002', organizationId(), [], epoch - 1)).toBe('stale');
    expect(db.getDraftDelivery('client_elena_002')?.id).toBe('pkg_elena_confirmed');
  });
});
