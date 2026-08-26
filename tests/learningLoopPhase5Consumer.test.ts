/**
 * SPEC-008 Phase 5 — Consumer-boundary adversarial suite (T-008-502/503/509).
 *
 * Attacks the runtime entry point that UI/main actually use, with a trusted
 * session supplied by the mocked auth service. Covers:
 *   T-008-01 / T-008-03 (consumer tenant + actor spoof)
 *   T-008-13 (SPEC-007 read-only Opportunity ingest attacks — section 44)
 *   T-008-22 (consumer idempotency replay)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalLearningLoopStore } from '../src/infrastructure/learningLoop';
import { createLocalOpportunityScoutStore } from '../src/infrastructure/opportunityScout';

const NOW = '2026-08-26T22:00:00.000Z';
const TENANT_A = { organizationId: 'org_a', clientId: 'client_a' };

const signalMirrors: unknown[] = [];
const resultMirrors: unknown[] = [];
let mirrorShouldThrow = false;

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
        : id === 'client_b'
          ? { id, organizationId: 'org_b', name: 'Foreign Client' }
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
      if (mirrorShouldThrow) throw new Error('MIRROR_DOWN');
      signalMirrors.push(row);
      return { ...(row as object), id: 'sout-mirror', createdAt: NOW };
    },
    mirrorResultRecordCompatibility: (row: unknown) => {
      if (mirrorShouldThrow) throw new Error('MIRROR_DOWN');
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
  mirrorShouldThrow = false;
  return { mod, store, oppStore };
}

/** Materializes a real SPEC-007 Opportunity and drives it to a terminal status. */
async function seedOpportunity(
  oppStore: ReturnType<typeof createLocalOpportunityScoutStore>,
  opportunityId: string,
  action: 'accept' | 'decline' = 'accept'
) {
  const { composeOpportunityScout } = await import(
    '../src/composition/opportunityScout/composeOpportunityScout'
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
    opportunityId,
    planId: 'plan-1',
    planItemId: 'item-1',
    thesisId: 'thesis-a',
    title: 'Panel',
    organization: 'Bar',
    type: 'PANEL',
    description: 'Desc',
    fitRationale: 'Fit',
    strategicBriefId: 'brief-1',
    intentKey: `opp-mat-${opportunityId}`,
  });

  const humanTrusted = { ...trusted, softwareAuthority: undefined };
  if (action === 'accept') {
    oppUseCases.accept({ trusted: humanTrusted, opportunityId: materialized.opportunity.id });
  } else {
    oppUseCases.decline({
      trusted: humanTrusted,
      opportunityId: materialized.opportunity.id,
      reason: 'Not a fit',
    });
  }
  return { oppUseCases, opportunity: materialized.opportunity };
}

describe('Consumer boundary — tenant and actor spoof (T-008-01 / T-008-03)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('claimed foreign organizationId and clientId are both denied', async () => {
    const { mod, store } = await loadConsumer();
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

    expect(() =>
      mod.registerSignalOutcomeIntent({
        clientId: 'client_a',
        signalId: 'sig-1',
        kind: 'USEFUL',
        source: 'RADAR',
        claimedClientId: 'client_evil',
        now: NOW,
      })
    ).toThrow(/Caller-supplied clientId|TENANT_ACCESS_DENIED/);

    expect(store.listObservations(TENANT_A)).toHaveLength(0);
  });

  it('a client belonging to another organization cannot be targeted', async () => {
    const { mod, store } = await loadConsumer();
    expect(() =>
      mod.registerSignalOutcomeIntent({
        clientId: 'client_b',
        signalId: 'sig-1',
        kind: 'USEFUL',
        source: 'RADAR',
        now: NOW,
      })
    ).toThrow();
    expect(store.listObservations({ organizationId: 'org_b', clientId: 'client_b' })).toHaveLength(
      0
    );
  });

  it('an unknown client fails closed with no observation written', async () => {
    const { mod, store } = await loadConsumer();
    expect(() =>
      mod.registerSignalOutcomeIntent({
        clientId: 'client_missing',
        signalId: 'sig-1',
        kind: 'USEFUL',
        source: 'RADAR',
        now: NOW,
      })
    ).toThrow();
    expect(store.listObservations(TENANT_A)).toHaveLength(0);
  });

  it('caller actor claims never reach the canonical observation', async () => {
    const { mod, store } = await loadConsumer();
    mod.registerSignalOutcomeIntent({
      clientId: 'client_a',
      signalId: 'sig-1',
      kind: 'NOT_USEFUL',
      source: 'RADAR',
      actorUid: 'user_admin_01',
      createdBy: 'client',
      actorType: 'HUMAN',
      now: NOW,
    });
    const rows = store.listObservations(TENANT_A);
    expect(rows).toHaveLength(1);
    expect(rows[0].actorUid).toBe('manager_user');
    expect(rows[0].actorUid).not.toBe('user_admin_01');
  });
});

describe('Consumer boundary — legacy mirror isolation (T-008-31)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('a failing mirror leaves the canonical observation authoritative', async () => {
    const { mod, store } = await loadConsumer();
    mirrorShouldThrow = true;
    const result = mod.registerSignalOutcomeIntent({
      clientId: 'client_a',
      signalId: 'sig-1',
      kind: 'USEFUL',
      source: 'RADAR',
      now: NOW,
    });
    expect(result.created).toBe(true);
    expect(result.mirrored).toBe(false);
    expect(signalMirrors).toHaveLength(0);
    expect(store.listObservations(TENANT_A)).toHaveLength(1);
  });

  it('a failing mirror is not retried into a duplicate canonical effect', async () => {
    const { mod, store } = await loadConsumer();
    mirrorShouldThrow = true;
    mod.registerSignalOutcomeIntent({
      clientId: 'client_a',
      signalId: 'sig-1',
      kind: 'USEFUL',
      source: 'RADAR',
      now: NOW,
    });
    const replay = mod.registerSignalOutcomeIntent({
      clientId: 'client_a',
      signalId: 'sig-1',
      kind: 'USEFUL',
      source: 'RADAR',
      now: NOW,
    });
    expect(replay.created).toBe(false);
    expect(store.listObservations(TENANT_A)).toHaveLength(1);
  });
});

describe('SPEC-007 Opportunity ingest attacks (T-008-13, section 44)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('ingest never mutates the Opportunity lifecycle', async () => {
    const { mod, oppStore } = await loadConsumer();
    const { opportunity } = await seedOpportunity(oppStore, 'opp-1');
    const before = oppStore.getOpportunity(opportunity.id, TENANT_A);

    const ingest = mod.ingestOpportunityOutcomeObservation({
      clientId: 'client_a',
      opportunityId: opportunity.id,
      now: NOW,
    });
    expect(ingest.ingested).toBe(true);

    const after = oppStore.getOpportunity(opportunity.id, TENANT_A);
    expect(after?.status).toBe('ACCEPTED');
    expect(after).toEqual(before);
  });

  it('duplicate ingest of the same Opportunity outcome creates one observation', async () => {
    const { mod, store, oppStore } = await loadConsumer();
    const { opportunity } = await seedOpportunity(oppStore, 'opp-1');

    mod.ingestOpportunityOutcomeObservation({
      clientId: 'client_a',
      opportunityId: opportunity.id,
      now: NOW,
    });
    const replay = mod.ingestOpportunityOutcomeObservation({
      clientId: 'client_a',
      opportunityId: opportunity.id,
      now: NOW,
    });
    expect(replay.ingested).toBe(false);
    expect(
      store.listObservations(TENANT_A).filter((o) => o.sourceKind === 'OPPORTUNITY_OUTCOME')
    ).toHaveLength(1);
  });

  it('claimed foreign tenant on ingest is denied', async () => {
    const { mod, store, oppStore } = await loadConsumer();
    const { opportunity } = await seedOpportunity(oppStore, 'opp-1');
    expect(() =>
      mod.ingestOpportunityOutcomeObservation({
        clientId: 'client_a',
        opportunityId: opportunity.id,
        claimedOrganizationId: 'org_evil',
        now: NOW,
      })
    ).toThrow();
    expect(
      store.listObservations(TENANT_A).filter((o) => o.sourceKind === 'OPPORTUNITY_OUTCOME')
    ).toHaveLength(0);
  });

  it('a fabricated / unknown opportunityId yields no observation', async () => {
    const { mod, store } = await loadConsumer();
    const ingest = mod.ingestOpportunityOutcomeObservation({
      clientId: 'client_a',
      opportunityId: 'opp-does-not-exist',
      now: NOW,
    });
    expect(ingest.ingested).toBe(false);
    expect(ingest.observationId).toBeUndefined();
    expect(store.listObservations(TENANT_A)).toHaveLength(0);
  });

  it('a non-terminal PROPOSED Opportunity is not ingested as an outcome', async () => {
    const { mod, store, oppStore } = await loadConsumer();
    const { composeOpportunityScout } = await import(
      '../src/composition/opportunityScout/composeOpportunityScout'
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
    const materialized = oppUseCases.materialize({
      trusted: {
        actorId: 'mgr',
        actorRole: 'ADMIN',
        organizationId: 'org_a',
        clientId: 'client_a',
        now: NOW,
        softwareAuthority: true,
      },
      opportunityId: 'opp-proposed',
      planId: 'plan-1',
      planItemId: 'item-1',
      thesisId: 'thesis-a',
      title: 'Panel',
      organization: 'Bar',
      type: 'PANEL',
      description: 'Desc',
      fitRationale: 'Fit',
      strategicBriefId: 'brief-1',
      intentKey: 'opp-mat-proposed',
    });

    const ingest = mod.ingestOpportunityOutcomeObservation({
      clientId: 'client_a',
      opportunityId: materialized.opportunity.id,
      now: NOW,
    });
    expect(ingest.ingested).toBe(false);
    expect(
      store.listObservations(TENANT_A).filter((o) => o.sourceKind === 'OPPORTUNITY_OUTCOME')
    ).toHaveLength(0);
  });

  it('the same Opportunity id in a foreign tenant is not readable', async () => {
    const { mod, oppStore } = await loadConsumer();
    await seedOpportunity(oppStore, 'opp-shared');
    // A trusted org_a session cannot reach an org_b projection of the same id.
    expect(oppStore.getOpportunity('opp-shared', {
      organizationId: 'org_b',
      clientId: 'client_b',
    })).toBeUndefined();
    const ingest = mod.ingestOpportunityOutcomeObservation({
      clientId: 'client_a',
      opportunityId: 'opp-shared',
      now: NOW,
    });
    expect(ingest.ingested).toBe(true);
  });

  it('the ingested observation records SPEC-007 as a read-only source reference', async () => {
    const { mod, store, oppStore } = await loadConsumer();
    const { opportunity } = await seedOpportunity(oppStore, 'opp-1', 'decline');
    mod.ingestOpportunityOutcomeObservation({
      clientId: 'client_a',
      opportunityId: opportunity.id,
      now: NOW,
    });
    const row = store
      .listObservations(TENANT_A)
      .find((o) => o.sourceKind === 'OPPORTUNITY_OUTCOME');
    expect(row?.sourceRef.sourceSpec).toBe('SPEC-007');
    expect(row?.sourceRef.sourceId).toBe(opportunity.id);
    expect(row?.observationKind).toBe('OPPORTUNITY_DECLINED');
    expect(row?.organizationId).toBe('org_a');
  });
});
