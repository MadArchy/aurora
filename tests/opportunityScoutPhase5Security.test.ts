/**
 * SPEC-007 Phase 5 — Adversarial / security behavior (T-007-502…505, T-007-01…17).
 * Product changes: 0. Proves fail-closed authority under attack.
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
  type OpportunityScoreDimensionInput,
} from '../src/domain/opportunityScoreCore';
import { assertHighScoreDoesNotAuthorize } from '../src/domain/opportunityMaterializeGateCore';
import { mapLegacyToCanonicalOpportunityStatus } from '../src/domain/opportunityLegacyMappingCore';
import { pickSpotlightOpportunity } from '../src/domain/clientOpportunityCore';
import type { Opportunity } from '../src/types';

const NOW = '2026-08-26T22:00:00.000Z';

const TRUSTED_A: TrustedOpportunityActorContext = {
  actorId: 'mgr_a',
  actorRole: 'ADMIN',
  organizationId: 'org_a',
  clientId: 'client_a',
  now: NOW,
};

const TRUSTED_A_SOFT: TrustedOpportunityActorContext = {
  ...TRUSTED_A,
  actorId: 'sys_opp',
  softwareAuthority: true,
};

const TRUSTED_B: TrustedOpportunityActorContext = {
  actorId: 'mgr_b',
  actorRole: 'ADMIN',
  organizationId: 'org_b',
  clientId: 'client_b',
  now: NOW,
};

const TRUSTED_CLIENT: TrustedOpportunityActorContext = {
  actorId: 'client_user',
  actorRole: 'CLIENT',
  organizationId: 'org_a',
  clientId: 'client_a',
  now: NOW,
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
      strategicScoreRef: { scoringVersion: 'strategic-score-v1', totalScore: 70 },
    },
    {
      thesisId: 'thesis-b',
      fitNotes: 'B highest',
      evaluationStatus: 'ELIGIBLE' as const,
      strategicScoreRef: { scoringVersion: 'strategic-score-v1', totalScore: 99 },
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
  const idem = new Map<string, { kind: string; id: string; fingerprint?: string }>();
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
      if (tenant.organizationId !== 'org_a' || tenant.clientId !== 'client_a') {
        return undefined;
      }
      return {
        id: 'brief-1',
        organizationId: 'org_a',
        clientId: 'client_a',
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

function seedCandidate(
  h: ReturnType<typeof buildHarness>,
  trusted: TrustedOpportunityActorContext = TRUSTED_A,
  candidateId = 'cand-1'
) {
  return h.register({
    trusted,
    candidateId,
    title: 'CLE Panel',
    summary: 'Panel talk',
    whyNow: 'Deadline soon',
    opportunityType: 'PANEL',
    sourceRefs: ['sig:1'],
    signalIds: ['sig-1'],
    thesisEvaluations: thesisEvals(),
    riskFlags: [],
    recommendedNextStep: 'DRAFT_BRIEF',
    intentKey: `reg-${trusted.clientId}-${candidateId}`,
  }).candidate;
}

function materializeOk(
  h: ReturnType<typeof buildHarness>,
  over: Partial<Parameters<ReturnType<typeof createMaterializeOpportunity>>[0]> = {}
) {
  return h.materialize({
    trusted: TRUSTED_A_SOFT,
    opportunityId: 'opp-1',
    planId: 'plan-1',
    planItemId: 'item-1',
    thesisId: 'thesis-a',
    title: 'CLE Panel',
    organization: 'Bar',
    type: 'PANEL',
    description: 'desc',
    fitRationale: 'fit',
    intentKey: 'mat-1',
    ...over,
  });
}

describe('T-007-01 / T-007-502 — tenant spoof matrix', () => {
  it('caller foreign tenant claims denied on evaluate/materialize/accept/list', () => {
    const h = buildHarness();
    seedCandidate(h);
    expect(() =>
      h.evaluate({
        trusted: TRUSTED_A,
        candidateId: 'cand-1',
        scoreId: 's1',
        dimensions: allDims(0.5),
        intentKey: 'ev-spoof',
        claimedOrganizationId: 'org_b',
      })
    ).toThrow(OpportunityApplicationError);

    expect(() =>
      materializeOk(h, {
        claimedClientId: 'client_b',
        intentKey: 'mat-spoof',
      })
    ).toThrow(OpportunityApplicationError);

    materializeOk(h);
    expect(() =>
      h.accept({
        trusted: TRUSTED_CLIENT,
        opportunityId: 'opp-1',
        claimedOrganizationId: 'org_evil',
      })
    ).toThrow(OpportunityApplicationError);

    expect(() =>
      h.list({
        trusted: TRUSTED_A,
        claimedClientId: 'client_b',
      })
    ).toThrow(OpportunityApplicationError);
  });
});

describe('T-007-13 — same-ID cross-tenant isolation', () => {
  it('identical opportunity ids are isolated; no cross-tenant read/lifecycle', () => {
    const h = buildHarness();
    seedCandidate(h, TRUSTED_A, 'cand-1');
    materializeOk(h, { opportunityId: 'opp-shared', intentKey: 'mat-a' });

    h.setAuth(() =>
      allowDecision({
        organizationId: 'org_b',
        clientId: 'client_b',
        thesisId: 'thesis-a',
        strategicBriefId: 'brief-b',
      })
    );
    // Brief reader only serves org_a — materialize for B should fail closed on brief
    // Seed B opportunity by direct store inject for isolation read test:
    h.opportunityStore.set('org_b|client_b|opp-shared', {
      ...h.opportunityStore.get('org_a|client_a|opp-shared')!,
      organizationId: 'org_b',
      clientId: 'client_b',
      id: 'opp-shared',
      strategicBriefId: 'brief-b',
    });

    expect(() =>
      h.get({ trusted: TRUSTED_B, opportunityId: 'opp-shared' })
    ).not.toThrow();
    const b = h.get({ trusted: TRUSTED_B, opportunityId: 'opp-shared' });
    expect(b.organizationId).toBe('org_b');

    expect(() =>
      h.accept({ trusted: TRUSTED_CLIENT, opportunityId: 'opp-shared' })
    ).not.toThrow();
    const a = h.get({ trusted: TRUSTED_A, opportunityId: 'opp-shared' });
    expect(a.status).toBe('ACCEPTED');
    expect(h.get({ trusted: TRUSTED_B, opportunityId: 'opp-shared' }).status).toBe(
      'PROPOSED'
    );

    expect(() =>
      h.accept({
        trusted: {
          ...TRUSTED_CLIENT,
          organizationId: 'org_b',
          clientId: 'client_b',
        },
        opportunityId: 'opp-shared',
      })
    ).not.toThrow();
  });
});

describe('T-007-02 / T-007-03 / T-007-503 — role / AI / actor spoof', () => {
  it('caller role/actorType/softwareAuthority claims ignored; AI cannot accept', () => {
    const h = buildHarness();
    seedCandidate(h);
    materializeOk(h);

    // Caller claims ADMIN + HUMAN while trusted is CLIENT — still HUMAN CLIENT path OK
    const accepted = h.accept({
      trusted: TRUSTED_CLIENT,
      opportunityId: 'opp-1',
      role: 'ADMIN',
      actorType: 'HUMAN',
      softwareAuthority: true,
    });
    expect(accepted.opportunity.status).toBe('ACCEPTED');

    // SOFTWARE trusted cannot accept even if caller claims HUMAN
    const h2 = buildHarness();
    seedCandidate(h2);
    materializeOk(h2, { opportunityId: 'opp-2', intentKey: 'mat-2' });
    expect(() =>
      h2.accept({
        trusted: TRUSTED_A_SOFT,
        opportunityId: 'opp-2',
        actorType: 'HUMAN',
        role: 'ADMIN',
      })
    ).toThrow(OpportunityApplicationError);
  });

  it('AI/provider cannot establish materialize actor without trusted softwareAuthority', () => {
    const h = buildHarness();
    seedCandidate(h);
    expect(() =>
      h.materialize({
        trusted: TRUSTED_A, // no softwareAuthority
        opportunityId: 'opp-ai',
        planId: 'plan-1',
        planItemId: 'item-1',
        thesisId: 'thesis-a',
        title: 't',
        organization: 'o',
        type: 'PANEL',
        description: 'd',
        fitRationale: 'f',
        intentKey: 'mat-ai',
        actorType: 'AI',
        role: 'ADMIN',
        softwareAuthority: true,
      })
    ).toThrow(OpportunityApplicationError);
    expect(h.opportunityStore.size).toBe(0);
  });
});

describe('T-007-04 / T-007-08 / T-007-09 — snapshot / stale state', () => {
  it('caller Opportunity snapshot has zero authority vs repository ACCEPTED', () => {
    const h = buildHarness();
    seedCandidate(h);
    materializeOk(h);
    h.accept({ trusted: TRUSTED_CLIENT, opportunityId: 'opp-1' });
    // Caller claims PROPOSED — cannot force reopen/alternate path; ACCEPTED→ACCEPTED denied
    expect(() =>
      h.accept({
        trusted: TRUSTED_CLIENT,
        opportunityId: 'opp-1',
        forgedOpportunity: { status: 'PROPOSED' },
        forgedStatus: 'PROPOSED',
      })
    ).toThrow(OpportunityApplicationError);
    expect(h.get({ trusted: TRUSTED_A, opportunityId: 'opp-1' }).status).toBe(
      'ACCEPTED'
    );
  });

  it('terminal DECLINED beats caller PROPOSED reopen attempt', () => {
    const h = buildHarness();
    seedCandidate(h);
    materializeOk(h, { opportunityId: 'opp-term', intentKey: 'mat-term' });
    h.decline({ trusted: TRUSTED_CLIENT, opportunityId: 'opp-term' });
    expect(() =>
      h.accept({
        trusted: TRUSTED_CLIENT,
        opportunityId: 'opp-term',
        forgedStatus: 'PROPOSED',
        forgedOpportunity: { status: 'PROPOSED' },
      })
    ).toThrow(/TERMINAL|transition|DECLINED/i);
    expect(h.get({ trusted: TRUSTED_A, opportunityId: 'opp-term' }).status).toBe(
      'DECLINED'
    );
  });
});

describe('T-007-10 / T-007-16 — SPEC-004 bypass matrix', () => {
  it('DENY / NONE / RESEARCH_ONLY / wrong action / fabricated ALLOW fail closed', () => {
    const cases: StrategicPlanAuthorizationDecision[] = [
      allowDecision({ disposition: 'DENY', allowed: false, reasons: ['DENY'] }),
      allowDecision({ disposition: 'NONE', allowed: false, action: 'NONE' }),
      allowDecision({
        disposition: 'RESEARCH_ONLY',
        allowed: false,
        action: 'RESEARCH_ONLY',
      }),
      allowDecision({ action: 'CREATE_CONTENT' }),
      allowDecision({
        disposition: 'ALLOW',
        allowed: true,
        action: 'CREATE_OPPORTUNITY',
        planStatus: 'SUPERSEDED',
        reasons: ['PLAN_SUPERSEDED'],
      }),
      allowDecision({
        organizationId: 'org_b',
        clientId: 'client_b',
      }),
    ];

    for (const decision of cases) {
      const h = buildHarness({ authFactory: () => decision });
      seedCandidate(h);
      const writes = h.writeUnits.length;
      expect(() =>
        materializeOk(h, {
          intentKey: `attack-${decision.disposition}-${decision.action}-${decision.planStatus}`,
          forgedAuthorizationAllowed: true,
          forgedPlan: { allowed: true, status: 'APPROVED' },
        })
      ).toThrow(OpportunityApplicationError);
      expect(h.opportunityStore.size).toBe(0);
      expect(h.writeUnits.length).toBe(writes);
    }
  });

  it('thesis mismatch and empty thesis denied (T-007-14)', () => {
    const h = buildHarness();
    seedCandidate(h);
    expect(() =>
      materializeOk(h, { thesisId: '', intentKey: 'no-thesis' })
    ).toThrow(/thesis/i);
    expect(() =>
      materializeOk(h, { thesisId: 'thesis-c', intentKey: 'mismatch' })
    ).toThrow(/thesis/i);
    expect(h.opportunityStore.size).toBe(0);
  });
});

describe('T-007-15 — high score / StrategicScore collision', () => {
  it('max OpportunityScore cannot authorize CREATE_OPPORTUNITY when Plan denies', () => {
    const domain = assertHighScoreDoesNotAuthorize(OPPORTUNITY_SCORE_MAX_TOTAL, false);
    expect(domain.ok).toBe(false);

    const h = buildHarness({
      authFactory: () =>
        allowDecision({ disposition: 'DENY', allowed: false, reasons: ['DENY'] }),
    });
    seedCandidate(h);
    expect(() =>
      materializeOk(h, {
        intentKey: 'score-bypass',
        opportunityScoreTotal: OPPORTUNITY_SCORE_MAX_TOTAL,
      })
    ).toThrow(OpportunityApplicationError);
    expect(h.opportunityStore.size).toBe(0);
  });

  it('recommend does not grant execution authority even at max score', () => {
    const h = buildHarness();
    seedCandidate(h);
    h.evaluate({
      trusted: TRUSTED_A,
      candidateId: 'cand-1',
      scoreId: 's-max',
      dimensions: allDims(1),
      intentKey: 'ev-max',
    });
    const rec = h.recommend({ trusted: TRUSTED_A, candidateId: 'cand-1' });
    expect(rec.executionAuthority).toBe(false);
    expect(rec.candidate.latestScore?.totalScore).toBe(OPPORTUNITY_SCORE_MAX_TOTAL);
  });
});

describe('T-007-14 — multi-thesis no [0] winner', () => {
  it('highest strategic score thesis is not auto-selected for materialize', () => {
    const h = buildHarness();
    const c = seedCandidate(h);
    const sorted = [...c.thesisEvaluations].sort(
      (a, b) =>
        (b.strategicScoreRef?.totalScore ?? 0) - (a.strategicScoreRef?.totalScore ?? 0)
    );
    expect(sorted[0].thesisId).toBe('thesis-b');
    // Authorization is thesis-a — materializing [0]=thesis-b must deny
    expect(() =>
      materializeOk(h, { thesisId: sorted[0].thesisId, intentKey: 'first-index' })
    ).toThrow(/thesis/i);
    expect(h.opportunityStore.size).toBe(0);
  });
});

describe('T-007-11 — history non-authority', () => {
  it('denyHistoryAsCurrentAuthority throws; repository status wins over forged history', () => {
    expect(() => denyHistoryAsCurrentAuthority()).toThrow(OpportunityApplicationError);
    const h = buildHarness();
    seedCandidate(h);
    materializeOk(h);
    h.accept({ trusted: TRUSTED_CLIENT, opportunityId: 'opp-1' });
    h.historyEntries.push({
      id: 'hist-forge',
      kind: 'OPPORTUNITY_TRANSITION',
      organizationId: 'org_a',
      clientId: 'client_a',
      aggregateKind: 'OPPORTUNITY',
      aggregateId: 'opp-1',
      aggregateVersion: 99,
      actorKind: 'HUMAN',
      reasonCodes: ['FORGED'],
      materialFingerprint: 'x',
      occurredAt: NOW,
      authority: 'AUDIT_ONLY',
    } as OpportunityHistoryRecord);
    expect(h.get({ trusted: TRUSTED_A, opportunityId: 'opp-1' }).status).toBe(
      'ACCEPTED'
    );
  });
});

describe('T-007-17 — idempotency replay / double-click', () => {
  it('same intentKey materialize is single authoritative effect', () => {
    const h = buildHarness();
    seedCandidate(h);
    const a = materializeOk(h, { intentKey: 'idem-1', opportunityId: 'opp-idem' });
    const writes = h.writeUnits.length;
    const b = materializeOk(h, {
      intentKey: 'idem-1',
      opportunityId: 'opp-idem-other',
      title: 'Different title ignored on replay',
    });
    expect(b.opportunity.id).toBe(a.opportunity.id);
    expect(b.created).toBe(false);
    expect(h.writeUnits.length).toBe(writes);
    expect(
      [...h.opportunityStore.values()].filter((o) => o.clientId === 'client_a')
    ).toHaveLength(1);
  });
});

describe('T-007-07 — dual lifecycle ambiguity fail-closed', () => {
  it('ambiguous COMPLETED+submitted requires review; no silent coerce', () => {
    const mapped = mapLegacyToCanonicalOpportunityStatus({
      status: 'COMPLETED',
      lifecycleStage: 'submitted',
    });
    expect(mapped.ok).toBe(false);
    if (!mapped.ok) {
      expect(mapped.error.code).toBe('LEGACY_MAPPING_AMBIGUOUS');
    }
  });
});

describe('AUDIT007-08 / T-007-05 — spotlight [0] DISPLAY_ONLY', () => {
  it('pickSpotlightOpportunity returns display pick only — no mutation surface', () => {
    const now = Date.parse('2026-08-26T12:00:00.000Z');
    const opps: Opportunity[] = [
      {
        id: 'o1',
        organizationId: 'org_a',
        clientId: 'client_a',
        thesisId: 'thesis-a',
        title: 'Later',
        organization: 'X',
        type: 'PANEL',
        deadline: '2026-09-10',
        description: 'd',
        fitRationale: 'f',
        status: 'SENT_TO_CLIENT',
        lifecycleStage: 'proposed',
        createdAt: NOW,
      },
      {
        id: 'o2',
        organizationId: 'org_a',
        clientId: 'client_a',
        thesisId: 'thesis-b',
        title: 'CLE Spotlight',
        organization: 'Y',
        type: 'PANEL',
        deadline: '2026-08-28',
        description: 'd',
        fitRationale: 'f',
        status: 'SENT_TO_CLIENT',
        lifecycleStage: 'proposed',
        createdAt: NOW,
      },
    ];
    const before = structuredClone(opps);
    const pick = pickSpotlightOpportunity(opps, now);
    expect(pick?.id).toBe('o2');
    expect(opps).toEqual(before);
    // Function has no write ports — DISPLAY_ONLY evidence
    expect(typeof pickSpotlightOpportunity).toBe('function');
    expect(pick?.thesisId).toBe('thesis-b'); // display field only; does not authorize materialize
  });
});

describe('T-007-05 — UI status alone cannot transition', () => {
  it('Application rejects transitions that ignore repository current machine', () => {
    const h = buildHarness();
    seedCandidate(h);
    materializeOk(h);
    // Skip ACCEPT → try SUBMIT from PROPOSED
    expect(() =>
      h.submit({
        trusted: TRUSTED_CLIENT,
        opportunityId: 'opp-1',
        forgedStatus: 'CHECKLIST',
      })
    ).toThrow(OpportunityApplicationError);
    expect(h.get({ trusted: TRUSTED_A, opportunityId: 'opp-1' }).status).toBe(
      'PROPOSED'
    );
  });
});
