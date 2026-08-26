/**
 * SPEC-007 Phase 2 — Application use-case tests (T-007-201…211).
 */

import { describe, expect, it } from 'vitest';
import {
  createAcceptOpportunity,
  createArchiveOpportunity,
  createCompleteOpportunity,
  createDeclineOpportunity,
  createEvaluateOpportunityCandidate,
  createGetOpportunity,
  createListOpportunities,
  createMaterializeOpportunity,
  createRecommendOpportunityCandidate,
  createRegisterOpportunityCandidate,
  createSubmitOpportunity,
  createUpdateOpportunityChecklist,
  denyHistoryAsCurrentAuthority,
  OpportunityApplicationError,
  type OpportunityCandidateRepository,
  type OpportunityHistoryPort,
  type OpportunityHistoryRecord,
  type OpportunityRepository,
  type OpportunityStrategicBriefReader,
  type OpportunityWriteUnit,
  type StrategicPlanAuthorizationDecision,
  type StrategicPlanAuthorizationPort,
  type TrustedOpportunityActorContext,
} from '../src/application/opportunityScout';
import type { OpportunityCandidate } from '../src/domain/opportunityCandidateCore';
import type { MaterializedOpportunity } from '../src/domain/opportunityCore';
import {
  OPPORTUNITY_SCORE_MAX_TOTAL,
  OPPORTUNITY_SCORE_MODEL_VERSION,
  type OpportunityScoreDimensionInput,
} from '../src/domain/opportunityScoreCore';

const NOW = '2026-08-26T19:00:00.000Z';

const TRUSTED: TrustedOpportunityActorContext = {
  actorId: 'mgr_ana',
  actorRole: 'ADMIN',
  organizationId: 'org_a',
  clientId: 'client_a',
  now: NOW,
};

const TRUSTED_SOFTWARE: TrustedOpportunityActorContext = {
  ...TRUSTED,
  actorId: 'sys_opportunity',
  softwareAuthority: true,
};

function allDims(raw = 1): OpportunityScoreDimensionInput[] {
  return [
    { key: 'strategicFit', rawInput: raw, reasonCode: 'FIT' },
    { key: 'timeliness', rawInput: raw, reasonCode: 'TIME' },
    { key: 'actionability', rawInput: raw, reasonCode: 'ACT' },
    { key: 'expectedUpside', rawInput: raw, reasonCode: 'UP' },
    { key: 'effortCost', rawInput: raw, reasonCode: 'EFF' },
    { key: 'risk', rawInput: raw, reasonCode: 'RISK' },
  ];
}

function thesisEvals() {
  return [
    {
      thesisId: 'thesis-a',
      fitNotes: 'A',
      evaluationStatus: 'ELIGIBLE' as const,
      strategicScoreRef: {
        scoringVersion: 'strategic-score-v1',
        totalScore: 70,
      },
    },
    {
      thesisId: 'thesis-b',
      fitNotes: 'B highest strategic',
      evaluationStatus: 'ELIGIBLE' as const,
      strategicScoreRef: {
        scoringVersion: 'strategic-score-v1',
        totalScore: 99,
      },
    },
    {
      thesisId: 'thesis-c',
      fitNotes: 'C',
      evaluationStatus: 'UNKNOWN' as const,
    },
  ];
}

function allowDecision(
  over: Partial<StrategicPlanAuthorizationDecision> = {}
): StrategicPlanAuthorizationDecision {
  return {
    disposition: 'ALLOW',
    allowed: true,
    action: 'CREATE_OPPORTUNITY',
    organizationId: 'org_a',
    clientId: 'client_a',
    thesisId: 'thesis-a',
    strategicBriefId: 'brief-1',
    strategicBriefVersion: 2,
    strategicPlanId: 'plan-1',
    strategicPlanVersion: 1,
    planItemId: 'item-1',
    planStatus: 'APPROVED',
    reasons: ['ALLOW'],
    ...over,
  };
}

function buildHarness(opts?: {
  authFactory?: () => StrategicPlanAuthorizationDecision;
}) {
  const candidateStore = new Map<string, OpportunityCandidate>();
  const opportunityStore = new Map<string, MaterializedOpportunity>();
  const idem = new Map<string, { kind: string; id: string }>();
  const historyEntries: OpportunityHistoryRecord[] = [];
  const writeUnits: OpportunityWriteUnit[] = [];

  function tenantKey(org: string, client: string, id: string) {
    return `${org}|${client}|${id}`;
  }

  function commit(unit: OpportunityWriteUnit) {
    writeUnits.push(unit);
    for (const c of unit.candidates ?? []) {
      candidateStore.set(
        tenantKey(c.organizationId, c.clientId, c.id),
        structuredClone(c)
      );
    }
    for (const o of unit.opportunities ?? []) {
      opportunityStore.set(
        tenantKey(o.organizationId, o.clientId, o.id),
        structuredClone(o)
      );
    }
    for (const entry of unit.idempotencyKeys ?? []) {
      const scoped = `${entry.organizationId}|${entry.clientId}|${entry.key}`;
      idem.set(scoped, {
        kind: entry.aggregateKind,
        id: entry.aggregateId,
      });
    }
  }

  const candidates: OpportunityCandidateRepository = {
    getById(candidateId, tenant) {
      const found = candidateStore.get(
        tenantKey(tenant.organizationId, tenant.clientId, candidateId)
      );
      return found ? structuredClone(found) : undefined;
    },
    list(tenant) {
      return [...candidateStore.values()]
        .filter(
          (c) =>
            c.organizationId === tenant.organizationId &&
            c.clientId === tenant.clientId
        )
        .map((c) => structuredClone(c));
    },
    findByIdempotencyKey(tenant, key) {
      const hit = idem.get(`${tenant.organizationId}|${tenant.clientId}|${key}`);
      return hit?.kind === 'CANDIDATE' ? { candidateId: hit.id } : undefined;
    },
    commitWriteUnit: commit,
  };

  const opportunities: OpportunityRepository = {
    getById(opportunityId, tenant) {
      const found = opportunityStore.get(
        tenantKey(tenant.organizationId, tenant.clientId, opportunityId)
      );
      return found ? structuredClone(found) : undefined;
    },
    list(tenant) {
      return [...opportunityStore.values()]
        .filter(
          (o) =>
            o.organizationId === tenant.organizationId &&
            o.clientId === tenant.clientId
        )
        .map((o) => structuredClone(o));
    },
    findByIdempotencyKey(tenant, key) {
      const hit = idem.get(`${tenant.organizationId}|${tenant.clientId}|${key}`);
      return hit?.kind === 'OPPORTUNITY' ? { opportunityId: hit.id } : undefined;
    },
    commitWriteUnit: commit,
  };

  const history: OpportunityHistoryPort = {
    append: (e) => historyEntries.push(e),
  };

  const briefs: OpportunityStrategicBriefReader = {
    getById(briefId, tenant) {
      if (briefId !== 'brief-1') return undefined;
      return {
        id: 'brief-1',
        organizationId: tenant.organizationId,
        clientId: tenant.clientId,
        thesisId: 'thesis-a',
        version: 2,
        status: 'APPROVED',
      };
    },
  };

  let authImpl = opts?.authFactory ?? (() => allowDecision());
  const planAuth: StrategicPlanAuthorizationPort = {
    authorizeCreateOpportunity: () => authImpl(),
  };

  const candDeps = { candidates, history };
  const oppDeps = { opportunities, history };
  const matDeps = {
    opportunities,
    candidates,
    history,
    planAuth,
    briefs,
  };

  return {
    candidateStore,
    opportunityStore,
    historyEntries,
    writeUnits,
    setAuth(factory: () => StrategicPlanAuthorizationDecision) {
      authImpl = factory;
    },
    register: createRegisterOpportunityCandidate(candDeps),
    evaluate: createEvaluateOpportunityCandidate(candDeps),
    recommend: createRecommendOpportunityCandidate(candDeps),
    materialize: createMaterializeOpportunity(matDeps),
    accept: createAcceptOpportunity(oppDeps),
    decline: createDeclineOpportunity(oppDeps),
    checklist: createUpdateOpportunityChecklist(oppDeps),
    submit: createSubmitOpportunity(oppDeps),
    complete: createCompleteOpportunity(oppDeps),
    archive: createArchiveOpportunity(oppDeps),
    get: createGetOpportunity(oppDeps),
    list: createListOpportunities(oppDeps),
  };
}

function seedCandidate(h: ReturnType<typeof buildHarness>) {
  return h.register({
    trusted: TRUSTED,
    candidateId: 'cand-1',
    title: 'CLE Panel',
    summary: 'Panel talk',
    whyNow: 'Deadline soon',
    opportunityType: 'PANEL',
    sourceRefs: ['sig:1'],
    signalIds: ['sig-1'],
    thesisEvaluations: thesisEvals(),
    riskFlags: [],
    recommendedNextStep: 'DRAFT_BRIEF',
    intentKey: 'reg-1',
  }).candidate;
}

describe('SPEC-007 Phase 2 — trusted context (T-007-208)', () => {
  it('trusted tenant wins; caller tenant spoof denied', () => {
    const h = buildHarness();
    seedCandidate(h);
    expect(() =>
      h.evaluate({
        trusted: TRUSTED,
        candidateId: 'cand-1',
        scoreId: 's1',
        dimensions: allDims(0.5),
        intentKey: 'ev-1',
        claimedOrganizationId: 'org_b',
      })
    ).toThrow(OpportunityApplicationError);

    try {
      h.evaluate({
        trusted: TRUSTED,
        candidateId: 'cand-1',
        scoreId: 's1',
        dimensions: allDims(0.5),
        intentKey: 'ev-1',
        claimedOrganizationId: 'org_b',
      });
    } catch (e) {
      expect((e as OpportunityApplicationError).code).toBe('TENANT_ACCESS_DENIED');
    }
  });

  it('caller HUMAN / softwareAuthority claims are ignored; SOFTWARE cannot accept', () => {
    const h = buildHarness();
    seedCandidate(h);
    h.evaluate({
      trusted: TRUSTED,
      candidateId: 'cand-1',
      scoreId: 's1',
      dimensions: allDims(0.8),
      intentKey: 'ev-spoof',
      actorType: 'AI',
      role: 'ADMIN',
      softwareAuthority: true,
    });
    h.materialize({
      trusted: TRUSTED_SOFTWARE,
      opportunityId: 'opp-spoof',
      planId: 'plan-1',
      planItemId: 'item-1',
      thesisId: 'thesis-a',
      title: 't',
      organization: 'o',
      type: 'PANEL',
      description: 'd',
      fitRationale: 'f',
      intentKey: 'mat-spoof',
      actorType: 'HUMAN',
    });
    expect(() =>
      h.accept({
        trusted: TRUSTED_SOFTWARE,
        opportunityId: 'opp-spoof',
        actorType: 'HUMAN',
      })
    ).toThrow(OpportunityApplicationError);
  });
});

describe('SPEC-007 Phase 2 — Stage A intelligence (T-007-201/202)', () => {
  it('registers, evaluates deterministically, recommends without execution authority', () => {
    const h = buildHarness();
    const c = seedCandidate(h);
    expect(c.thesisEvaluations).toHaveLength(3);

    const scored = h.evaluate({
      trusted: TRUSTED,
      candidateId: 'cand-1',
      scoreId: 'score-1',
      dimensions: allDims(1),
      intentKey: 'score-max',
    });
    expect(scored.candidate.latestScore?.totalScore).toBe(OPPORTUNITY_SCORE_MAX_TOTAL);
    expect(scored.candidate.latestScore?.scoringModelVersion).toBe(
      OPPORTUNITY_SCORE_MODEL_VERSION
    );

    const rec = h.recommend({ trusted: TRUSTED, candidateId: 'cand-1' });
    expect(rec.candidate.status).toBe('RECOMMENDED');
    expect(rec.executionAuthority).toBe(false);
    expect(h.writeUnits.length).toBeGreaterThan(0);
  });

  it('ignores forged candidate snapshot; repository current wins', () => {
    const h = buildHarness();
    seedCandidate(h);
    h.evaluate({
      trusted: TRUSTED,
      candidateId: 'cand-1',
      scoreId: 's1',
      dimensions: allDims(0.4),
      intentKey: 'ev-cur',
      forgedCandidate: { status: 'RECOMMENDED', thesisEvaluations: [] },
    });
    const loaded = h.candidateStore.get('org_a|client_a|cand-1');
    expect(loaded?.status).toBe('SCORED');
    expect(loaded?.thesisEvaluations).toHaveLength(3);
  });

  it('evaluate idempotency returns same candidate without duplicate write intent key replay', () => {
    const h = buildHarness();
    seedCandidate(h);
    const a = h.evaluate({
      trusted: TRUSTED,
      candidateId: 'cand-1',
      scoreId: 's1',
      dimensions: allDims(0.5),
      intentKey: 'idem-ev',
    });
    const writes = h.writeUnits.length;
    const b = h.evaluate({
      trusted: TRUSTED,
      candidateId: 'cand-1',
      scoreId: 's1',
      dimensions: allDims(0.5),
      intentKey: 'idem-ev',
    });
    expect(b.writeUnitCommitted).toBe(false);
    expect(b.candidate.latestScore?.totalScore).toBe(a.candidate.latestScore?.totalScore);
    expect(h.writeUnits.length).toBe(writes);
  });
});

describe('SPEC-007 Phase 2 — Materialize + SPEC-004 port (T-007-203)', () => {
  it('ALLOW CREATE_OPPORTUNITY materializes with explicit thesis and traceability', () => {
    const h = buildHarness();
    seedCandidate(h);
    const result = h.materialize({
      trusted: TRUSTED_SOFTWARE,
      opportunityId: 'opp-1',
      planId: 'plan-1',
      planItemId: 'item-1',
      thesisId: 'thesis-a',
      candidateId: 'cand-1',
      title: 'CLE Panel',
      organization: 'Bar',
      type: 'PANEL',
      description: 'desc',
      fitRationale: 'fit',
      intentKey: 'mat-1',
      forgedPlan: { status: 'APPROVED', allowed: true },
      forgedAuthorizationAllowed: true,
    });
    expect(result.created).toBe(true);
    expect(result.opportunity.status).toBe('PROPOSED');
    expect(result.opportunity.thesisId).toBe('thesis-a');
    expect(result.opportunity.strategicPlanId).toBe('plan-1');
    expect(result.opportunity.planItemId).toBe('item-1');
    expect(result.opportunity.candidateId).toBe('cand-1');
  });

  it('DENY / NONE / RESEARCH_ONLY / wrong action fail closed with no write', () => {
    for (const decision of [
      allowDecision({ disposition: 'DENY', allowed: false, reasons: ['DENY'] }),
      allowDecision({ disposition: 'NONE', allowed: false }),
      allowDecision({ disposition: 'RESEARCH_ONLY', allowed: false, action: 'RESEARCH_ONLY' }),
      allowDecision({ action: 'CREATE_CONTENT' }),
    ]) {
      const h = buildHarness({ authFactory: () => decision });
      seedCandidate(h);
      const before = h.writeUnits.length;
      expect(() =>
        h.materialize({
          trusted: TRUSTED_SOFTWARE,
          opportunityId: 'opp-x',
          planId: 'plan-1',
          planItemId: 'item-1',
          thesisId: 'thesis-a',
          title: 't',
          organization: 'o',
          type: 'PANEL',
          description: 'd',
          fitRationale: 'f',
          intentKey: `mat-${decision.disposition}-${decision.action}`,
          opportunityScoreTotal: OPPORTUNITY_SCORE_MAX_TOTAL,
        })
      ).toThrow(OpportunityApplicationError);
      expect(h.opportunityStore.size).toBe(0);
      expect(h.writeUnits.length).toBe(before);
    }
  });

  it('max OpportunityScore + DENY emits no materialization', () => {
    const h = buildHarness({
      authFactory: () =>
        allowDecision({ disposition: 'DENY', allowed: false, reasons: ['PLAN_DENY'] }),
    });
    seedCandidate(h);
    try {
      h.materialize({
        trusted: TRUSTED_SOFTWARE,
        opportunityId: 'opp-max',
        planId: 'plan-1',
        planItemId: 'item-1',
        thesisId: 'thesis-a',
        title: 't',
        organization: 'o',
        type: 'PANEL',
        description: 'd',
        fitRationale: 'f',
        intentKey: 'mat-max-deny',
        opportunityScoreTotal: OPPORTUNITY_SCORE_MAX_TOTAL,
      });
      expect.fail('should deny');
    } catch (e) {
      expect((e as OpportunityApplicationError).code).toMatch(
        /CREATE_OPPORTUNITY_AUTHORIZATION_REQUIRED|SPEC004_DENY/
      );
    }
    expect(h.opportunityStore.size).toBe(0);
  });

  it('omitted thesis / thesis mismatch / tenant mismatch / stale plan denied', () => {
    const h = buildHarness();
    seedCandidate(h);
    expect(() =>
      h.materialize({
        trusted: TRUSTED_SOFTWARE,
        opportunityId: 'opp-1',
        planId: 'plan-1',
        planItemId: 'item-1',
        thesisId: '',
        title: 't',
        organization: 'o',
        type: 'PANEL',
        description: 'd',
        fitRationale: 'f',
        intentKey: 'mat-no-thesis',
      })
    ).toThrowError(/thesis/i);

    expect(() =>
      h.materialize({
        trusted: TRUSTED_SOFTWARE,
        opportunityId: 'opp-1',
        planId: 'plan-1',
        planItemId: 'item-1',
        thesisId: 'thesis-b',
        candidateId: 'cand-1',
        title: 't',
        organization: 'o',
        type: 'PANEL',
        description: 'd',
        fitRationale: 'f',
        intentKey: 'mat-thesis-b',
      })
    ).toThrow(OpportunityApplicationError);

    h.setAuth(() =>
      allowDecision({ organizationId: 'org_other', clientId: 'client_a' })
    );
    expect(() =>
      h.materialize({
        trusted: TRUSTED_SOFTWARE,
        opportunityId: 'opp-1',
        planId: 'plan-1',
        planItemId: 'item-1',
        thesisId: 'thesis-a',
        title: 't',
        organization: 'o',
        type: 'PANEL',
        description: 'd',
        fitRationale: 'f',
        intentKey: 'mat-tenant',
      })
    ).toThrowError(/tenant/i);

    h.setAuth(() =>
      allowDecision({
        planStatus: 'SUPERSEDED',
        reasons: ['PLAN_SUPERSEDED'],
      })
    );
    expect(() =>
      h.materialize({
        trusted: TRUSTED_SOFTWARE,
        opportunityId: 'opp-1',
        planId: 'plan-1',
        planItemId: 'item-1',
        thesisId: 'thesis-a',
        title: 't',
        organization: 'o',
        type: 'PANEL',
        description: 'd',
        fitRationale: 'f',
        intentKey: 'mat-stale',
      })
    ).toThrow(OpportunityApplicationError);
  });
});

describe('SPEC-007 Phase 2 — lifecycle (T-007-204…206)', () => {
  function seedProposed(h: ReturnType<typeof buildHarness>) {
    seedCandidate(h);
    return h.materialize({
      trusted: TRUSTED_SOFTWARE,
      opportunityId: 'opp-1',
      planId: 'plan-1',
      planItemId: 'item-1',
      thesisId: 'thesis-a',
      candidateId: 'cand-1',
      title: 't',
      organization: 'o',
      type: 'PANEL',
      description: 'd',
      fitRationale: 'f',
      intentKey: 'mat-life',
    }).opportunity;
  }

  it('human accept/decline via trusted context; SOFTWARE denied for accept', () => {
    const h = buildHarness();
    seedProposed(h);
    expect(() =>
      h.accept({
        trusted: TRUSTED_SOFTWARE,
        opportunityId: 'opp-1',
        actorType: 'HUMAN',
      })
    ).toThrow(OpportunityApplicationError);

    const accepted = h.accept({ trusted: TRUSTED, opportunityId: 'opp-1' });
    expect(accepted.opportunity.status).toBe('ACCEPTED');
  });

  it('caller snapshot ignored: repository ACCEPTED beats caller PROPOSED', () => {
    const h = buildHarness();
    seedProposed(h);
    h.accept({ trusted: TRUSTED, opportunityId: 'opp-1' });
    // Caller claims still PROPOSED and tries decline — Domain evaluates from ACCEPTED.
    expect(() =>
      h.decline({
        trusted: TRUSTED,
        opportunityId: 'opp-1',
        forgedStatus: 'PROPOSED',
        forgedOpportunity: { status: 'PROPOSED' },
      })
    ).toThrow(OpportunityApplicationError);
  });

  it('terminal current state beats caller non-terminal snapshot', () => {
    const h = buildHarness();
    seedProposed(h);
    h.decline({ trusted: TRUSTED, opportunityId: 'opp-1' });
    expect(() =>
      h.accept({
        trusted: TRUSTED,
        opportunityId: 'opp-1',
        forgedStatus: 'PROPOSED',
      })
    ).toThrow(OpportunityApplicationError);
  });

  it('checklist / submit / complete / archive with bounded software authority', () => {
    const h = buildHarness();
    seedProposed(h);
    h.accept({ trusted: TRUSTED, opportunityId: 'opp-1' });
    const checked = h.checklist({
      trusted: TRUSTED_SOFTWARE,
      opportunityId: 'opp-1',
      checklist: [{ id: 'c1', label: 'Bio', done: true }],
    });
    expect(checked.opportunity.status).toBe('CHECKLIST');
    const submitted = h.submit({ trusted: TRUSTED, opportunityId: 'opp-1' });
    expect(submitted.opportunity.status).toBe('SUBMITTED');
    const completed = h.complete({
      trusted: TRUSTED_SOFTWARE,
      opportunityId: 'opp-1',
    });
    expect(completed.opportunity.status).toBe('COMPLETED');
  });
});

describe('SPEC-007 Phase 2 — tenant-safe get/list (T-007-207)', () => {
  it('same opportunity id is isolated across tenants; no id-only authority', () => {
    const h = buildHarness();
    seedCandidate(h);
    h.materialize({
      trusted: TRUSTED_SOFTWARE,
      opportunityId: 'opp-shared',
      planId: 'plan-1',
      planItemId: 'item-1',
      thesisId: 'thesis-a',
      title: 'A',
      organization: 'o',
      type: 'PANEL',
      description: 'd',
      fitRationale: 'f',
      intentKey: 'mat-a',
    });

    // Plant foreign tenant row with same id.
    h.opportunityStore.set('org_b|client_b|opp-shared', {
      ...h.opportunityStore.get('org_a|client_a|opp-shared')!,
      organizationId: 'org_b',
      clientId: 'client_b',
      title: 'Foreign',
    });

    const got = h.get({ trusted: TRUSTED, opportunityId: 'opp-shared' });
    expect(got.title).toBe('A');
    expect(got.organizationId).toBe('org_a');

    const listed = h.list({ trusted: TRUSTED });
    expect(listed.every((o) => o.organizationId === 'org_a')).toBe(true);

    expect(() =>
      h.get({
        trusted: TRUSTED,
        opportunityId: 'opp-shared',
        claimedOrganizationId: 'org_b',
      })
    ).toThrow(OpportunityApplicationError);
  });
});

describe('SPEC-007 Phase 2 — history non-authority + errors', () => {
  it('history is AUDIT_ONLY and cannot establish current authority', () => {
    expect(() => denyHistoryAsCurrentAuthority()).toThrow(OpportunityApplicationError);
    const h = buildHarness();
    seedCandidate(h);
    expect(h.historyEntries.every((e) => e.authority === 'AUDIT_ONLY')).toBe(true);
  });
});
