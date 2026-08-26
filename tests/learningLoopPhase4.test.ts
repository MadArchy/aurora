/**
 * SPEC-008 Phase 4 — Consumer migration tests (T-008-401…407).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLocalLearningLoopStore } from '../src/infrastructure/learningLoop';
import { createLocalOpportunityScoutStore } from '../src/infrastructure/opportunityScout';

const NOW = '2026-08-26T22:00:00.000Z';
const ROOT = process.cwd();

const signalMirrors: unknown[] = [];
const resultMirrors: unknown[] = [];

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => ({
      uid: 'manager_user',
      role: 'ADMIN',
      email: 'm@test',
      displayName: 'Manager',
      organizationId: 'org_a',
    }),
  },
}));

vi.mock('../src/services/db', () => ({
  dbService: {
    getClientById: (id: string) =>
      id === 'client_a'
        ? { id, organizationId: 'org_a', name: 'Test Client' }
        : undefined,
    getSignalById: (id: string) =>
      id === 'sig-1'
        ? {
            id: 'sig-1',
            organizationId: 'org_a',
            clientId: 'client_a',
            thesisId: 'thesis-a',
            title: 'Signal',
            status: 'OPEN',
          }
        : undefined,
    mirrorSignalOutcomeCompatibility: (row: unknown) => {
      signalMirrors.push(row);
      return { ...(row as object), id: 'sout-mirror', createdAt: NOW };
    },
    mirrorResultRecordCompatibility: (row: unknown) => {
      resultMirrors.push(row);
      return { ...(row as object), id: 'res-mirror', createdAt: NOW };
    },
    recordSignalOutcome: () => {
      throw new Error('LEGACY_AUTHORITY_REMOVED');
    },
    addResult: () => {
      throw new Error('LEGACY_AUTHORITY_REMOVED');
    },
    getSignalOutcome: () => undefined,
    getSignalOutcomes: () => [],
  },
}));

async function loadConsumer() {
  const mod = await import('../src/services/learningLoopConsumer');
  const store = createLocalLearningLoopStore();
  store.resetForTest();
  const oppStore = createLocalOpportunityScoutStore();
  oppStore.resetForTest();
  mod.resetLearningLoopConsumerForTest(store, { opportunityStore: oppStore });
  signalMirrors.length = 0;
  resultMirrors.length = 0;
  return { mod, store, oppStore };
}

describe('SPEC-008 Phase 4 — learning consumer (T-008-401/402/403)', () => {
  beforeEach(() => {
    vi.resetModules();
    signalMirrors.length = 0;
    resultMirrors.length = 0;
  });

  it('registerSignalOutcomeIntent uses canonical path and mirrors only after success', async () => {
    const { mod, store } = await loadConsumer();
    const result = mod.registerSignalOutcomeIntent({
      clientId: 'client_a',
      signalId: 'sig-1',
      kind: 'USEFUL',
      source: 'RADAR',
      now: NOW,
    });
    expect(result.created).toBe(true);
    expect(result.mirrored).toBe(true);
    expect(signalMirrors).toHaveLength(1);
    expect(store.listObservations({ organizationId: 'org_a', clientId: 'client_a' })).toHaveLength(1);
  });

  it('registerResultRecordIntent uses canonical path and mirrors only after success', async () => {
    const { mod, store } = await loadConsumer();
    const result = mod.registerResultRecordIntent({
      clientId: 'client_a',
      title: 'Talk',
      channel: 'LinkedIn',
      metricLabel: 'Views',
      metricValue: 100,
      kpiType: 'media_mentions',
      intentKey: 'res-1',
      now: NOW,
    });
    expect(result.created).toBe(true);
    expect(result.mirrored).toBe(true);
    expect(resultMirrors).toHaveLength(1);
    expect(store.listObservations({ organizationId: 'org_a', clientId: 'client_a' })).toHaveLength(1);
  });

  it('double-click outcome registration is idempotent', async () => {
    const { mod, store } = await loadConsumer();
    mod.registerSignalOutcomeIntent({
      clientId: 'client_a',
      signalId: 'sig-1',
      kind: 'USEFUL',
      source: 'RADAR',
      now: NOW,
    });
    const second = mod.registerSignalOutcomeIntent({
      clientId: 'client_a',
      signalId: 'sig-1',
      kind: 'USEFUL',
      source: 'RADAR',
      now: NOW,
    });
    expect(second.created).toBe(false);
    expect(store.listObservations({ organizationId: 'org_a', clientId: 'client_a' })).toHaveLength(1);
  });

  it('caller tenant spoof is denied', async () => {
    const { mod } = await loadConsumer();
    expect(() =>
      mod.registerSignalOutcomeIntent({
        clientId: 'client_a',
        signalId: 'sig-1',
        kind: 'USEFUL',
        source: 'RADAR',
        claimedOrganizationId: 'org_evil',
        now: NOW,
      })
    ).toThrow(/Caller-supplied organizationId|TENANT_ACCESS_DENIED/);
  });

  it('caller actor claims are ignored — trusted actor from auth', async () => {
    const { mod } = await loadConsumer();
    const result = mod.registerSignalOutcomeIntent({
      clientId: 'client_a',
      signalId: 'sig-1',
      kind: 'NOT_USEFUL',
      source: 'RADAR',
      actorUid: 'user_admin_01',
      createdBy: 'client',
      actorType: 'HUMAN',
      now: NOW,
    });
    expect(result.created).toBe(true);
    expect(signalMirrors[0]).toMatchObject({ actorUid: 'manager_user' });
  });
});

describe('SPEC-008 Phase 4 — P0 removal evidence (T-008-405/406)', () => {
  it('main.ts scoringContext does not invoke feedbackScoringHints', () => {
    const main = readFileSync(join(ROOT, 'src/main.ts'), 'utf8');
    expect(main).not.toMatch(/feedbackScoringHints/);
    expect(main).not.toMatch(/recordSignalOutcome\s*\(/);
    expect(main).not.toMatch(/dbService\.addResult\s*\(/);
    expect(main).toMatch(/registerSignalOutcomeIntent/);
    expect(main).toMatch(/registerResultRecordIntent/);
  });

  it('post-outcome mass rescore loop removed from main.ts outcome handler', () => {
    const main = readFileSync(join(ROOT, 'src/main.ts'), 'utf8');
    const start = main.indexOf("document.querySelectorAll('.btn-signal-outcome')");
    const end = main.indexOf("document.querySelectorAll('.btn-send-to-curation')");
    const outcomeBlock = main.slice(start, end);
    expect(outcomeBlock).not.toMatch(/for \(const s of open\)/);
    expect(outcomeBlock).not.toMatch(/scoreSignal\(s\.id/);
    expect(outcomeBlock).not.toMatch(/user_admin_01/);
    expect(outcomeBlock).toMatch(/registerSignalOutcomeIntent/);
  });

  it('DbStrategicSignalRoutingAdapter buildScoringContext has zero feedbackScoringHints', () => {
    const adapter = readFileSync(
      join(ROOT, 'src/infrastructure/strategicSignalRouting/DbStrategicSignalRoutingAdapter.ts'),
      'utf8'
    );
    expect(adapter).not.toMatch(/feedbackScoringHints/);
  });
});

describe('SPEC-008 Phase 4 — Opportunity read-only ingest (T-008-407)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('ingestOpportunityOutcomeObservation reads SPEC-007 without mutating Opportunity', async () => {
    const { mod, oppStore } = await loadConsumer();
    const { composeOpportunityScout } = await import('../src/composition/opportunityScout/composeOpportunityScout');
    const { createStrategicPlanAuthorizationAdapter } = await import(
      '../src/composition/opportunityScout/StrategicPlanAuthorizationAdapter'
    );
    const oppUseCases = composeOpportunityScout({
      store: oppStore,
      planAuth: {
        authorizeCreateOpportunity: () => ({
          disposition: 'ALLOW',
          allowed: true,
          action: 'CREATE_OPPORTUNITY',
          organizationId: 'org_a',
          clientId: 'client_a',
          thesisId: 'thesis-a',
          strategicBriefId: 'brief-1',
          strategicBriefVersion: 1,
          strategicPlanId: 'plan-1',
          strategicPlanVersion: 1,
          planItemId: 'item-1',
          planStatus: 'APPROVED',
          reasons: ['ALLOW'],
        }),
      },
      briefs: {
        getById: () => ({
          id: 'brief-1',
          organizationId: 'org_a',
          clientId: 'client_a',
          thesisId: 'thesis-a',
          version: 1,
          status: 'APPROVED',
        }),
      },
    });

    const trusted = {
      actorId: 'mgr',
      actorRole: 'ADMIN' as const,
      organizationId: 'org_a',
      clientId: 'client_a',
      now: NOW,
      softwareAuthority: true,
    };
    const materialized = oppUseCases.materialize({
      trusted,
      opportunityId: 'opp-test-1',
      planId: 'plan-1',
      planItemId: 'item-1',
      thesisId: 'thesis-a',
      title: 'Panel',
      organization: 'Bar',
      type: 'PANEL',
      description: 'Desc',
      fitRationale: 'Fit',
      strategicBriefId: 'brief-1',
      intentKey: 'opp-mat-1',
    });
    oppUseCases.accept({
      trusted: { ...trusted, softwareAuthority: undefined },
      opportunityId: materialized.opportunity.id,
    });

    const ingest = mod.ingestOpportunityOutcomeObservation({
      clientId: 'client_a',
      opportunityId: materialized.opportunity.id,
      now: NOW,
    });
    expect(ingest.ingested).toBe(true);
    expect(oppStore.getOpportunity(materialized.opportunity.id, {
      organizationId: 'org_a',
      clientId: 'client_a',
    })?.status).toBe('ACCEPTED');
  });
});

describe('SPEC-008 Phase 4 — dbService demotion (T-008-402)', () => {
  it('recordSignalOutcome and addResult throw LEGACY_AUTHORITY_REMOVED', async () => {
    const { dbService } = await import('../src/services/db');
    expect(() =>
      dbService.recordSignalOutcome({
        organizationId: 'org_a',
        clientId: 'client_a',
        signalId: 'sig-1',
        kind: 'USEFUL',
        source: 'RADAR',
        actorUid: 'x',
      })
    ).toThrow(/LEGACY_AUTHORITY_REMOVED/);
    expect(() =>
      dbService.addResult({
        organizationId: 'org_a',
        clientId: 'client_a',
        title: 'T',
        channel: 'C',
        metricLabel: 'M',
        metricValue: 1,
        addedToEvidence: false,
        createdBy: 'x',
      })
    ).toThrow(/LEGACY_AUTHORITY_REMOVED/);
  });
});
