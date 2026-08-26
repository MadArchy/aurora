/**
 * SPEC-007 Phase 3 — Persistence / infrastructure tests (T-007-301…308).
 */

import { describe, expect, it } from 'vitest';
import { OpportunityApplicationError } from '../src/application/opportunityScout/errors';
import type { OpportunityWriteUnit } from '../src/application/opportunityScout/ports/OpportunityCandidateRepository';
import {
  createLocalOpportunityScoutStore,
  createLegacyOpportunityV5CompatibilityReader,
  LocalOpportunityCandidateRepository,
  LocalOpportunityHistoryAdapter,
  LocalOpportunityRepository,
  LEGACY_OPPORTUNITIES_V5_KEY,
  parseStoredCandidate,
  parseStoredOpportunity,
  parseStoredOpportunityScore,
  tenantEntityKey,
  type StorageLike,
} from '../src/infrastructure/opportunityScout';
import type { OpportunityCandidate } from '../src/domain/opportunityCandidateCore';
import type { MaterializedOpportunity } from '../src/domain/opportunityCore';
import {
  OPPORTUNITY_SCORE_MODEL_VERSION,
  OPPORTUNITY_SCORE_SCHEMA_VERSION,
  type OpportunityScore,
} from '../src/domain/opportunityScoreCore';
import { createHistoryEventIntent } from '../src/domain/opportunityMaterialityCore';

const NOW = '2026-08-26T20:00:00.000Z';

function memoryKv(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

function makeScore(over: Partial<OpportunityScore> = {}): OpportunityScore {
  return {
    id: 'score-1',
    organizationId: 'org_a',
    clientId: 'client_a',
    candidateId: 'cand-1',
    scoringModelVersion: OPPORTUNITY_SCORE_MODEL_VERSION,
    totalScore: 100,
    band: 'CRITICAL',
    dimensions: [
      { key: 'strategicFit', rawInput: 1, weight: 0.25, contribution: 0.25, reasonCode: 'F' },
      { key: 'timeliness', rawInput: 1, weight: 0.2, contribution: 0.2, reasonCode: 'T' },
      { key: 'actionability', rawInput: 1, weight: 0.2, contribution: 0.2, reasonCode: 'A' },
      { key: 'expectedUpside', rawInput: 1, weight: 0.15, contribution: 0.15, reasonCode: 'U' },
      { key: 'effortCost', rawInput: 1, weight: 0.1, contribution: 0.1, reasonCode: 'E' },
      { key: 'risk', rawInput: 1, weight: 0.1, contribution: 0.1, reasonCode: 'R' },
    ],
    evidenceRefs: ['ev-1'],
    riskFlags: [],
    computedAt: NOW,
    schemaVersion: OPPORTUNITY_SCORE_SCHEMA_VERSION,
    ...over,
  };
}

function makeCandidate(over: Partial<OpportunityCandidate> = {}): OpportunityCandidate {
  return {
    id: 'cand-1',
    organizationId: 'org_a',
    clientId: 'client_a',
    title: 'CLE Panel',
    summary: 'summary',
    whyNow: 'deadline',
    opportunityType: 'PANEL',
    sourceRefs: ['sig:1'],
    signalIds: ['sig-1'],
    thesisEvaluations: [
      { thesisId: 'thesis-a', fitNotes: 'A', evaluationStatus: 'ELIGIBLE' },
      {
        thesisId: 'thesis-b',
        fitNotes: 'B highest strategic',
        evaluationStatus: 'ELIGIBLE',
        strategicScoreRef: { scoringVersion: 'strategic-score-v1', totalScore: 99 },
      },
      { thesisId: 'thesis-c', fitNotes: 'C', evaluationStatus: 'UNKNOWN' },
    ],
    status: 'SCORED',
    latestScore: makeScore(),
    riskFlags: [],
    recommendedNextStep: 'DRAFT_BRIEF',
    schemaVersion: 'opportunity-candidate-v1',
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: 'actor-1',
    ...over,
  };
}

function makeOpportunity(
  over: Partial<MaterializedOpportunity> = {}
): MaterializedOpportunity {
  return {
    id: 'opp-1',
    organizationId: 'org_a',
    clientId: 'client_a',
    thesisId: 'thesis-a',
    candidateId: 'cand-1',
    candidateVersion: 1,
    strategicBriefId: 'brief-1',
    strategicBriefVersion: 2,
    strategicPlanId: 'plan-1',
    strategicPlanVersion: 1,
    planItemId: 'item-1',
    title: 'CLE Panel',
    organization: 'Bar',
    type: 'PANEL',
    deadline: null,
    description: 'desc',
    fitRationale: 'fit',
    status: 'PROPOSED',
    submissionChecklist: [],
    schemaVersion: 'opportunity-v1',
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: 'sys',
    ...over,
  };
}

function harness() {
  const kv = memoryKv();
  const store = createLocalOpportunityScoutStore(kv);
  const candidates = new LocalOpportunityCandidateRepository(store);
  const opportunities = new LocalOpportunityRepository(store);
  const history = new LocalOpportunityHistoryAdapter(store);
  return { kv, store, candidates, opportunities, history };
}

describe('SPEC-007 Phase 3 — Candidate / Opportunity persistence (T-007-301/302)', () => {
  it('tenant-safe save/get/list with same-id cross-tenant isolation', () => {
    const h = harness();
    const a = makeCandidate();
    const b = makeCandidate({
      organizationId: 'org_b',
      clientId: 'client_b',
      latestScore: makeScore({
        organizationId: 'org_b',
        clientId: 'client_b',
      }),
    });
    h.candidates.commitWriteUnit({
      candidates: [a],
      history: [],
    });
    h.candidates.commitWriteUnit({
      candidates: [b],
      history: [],
    });

    expect(h.candidates.getById('cand-1', { organizationId: 'org_a', clientId: 'client_a' })?.title).toBe(
      'CLE Panel'
    );
    expect(
      h.candidates.getById('cand-1', { organizationId: 'org_b', clientId: 'client_b' })
        ?.organizationId
    ).toBe('org_b');
    expect(
      h.candidates.getById('cand-1', { organizationId: 'org_a', clientId: 'client_x' })
    ).toBeUndefined();
    expect(
      h.candidates.list({ organizationId: 'org_a', clientId: 'client_a' })
    ).toHaveLength(1);

    const oppA = makeOpportunity();
    const oppB = makeOpportunity({
      organizationId: 'org_b',
      clientId: 'client_b',
      title: 'Foreign',
    });
    h.opportunities.commitWriteUnit({ opportunities: [oppA], history: [] });
    h.opportunities.commitWriteUnit({ opportunities: [oppB], history: [] });
    expect(
      h.opportunities.getById('opp-1', { organizationId: 'org_a', clientId: 'client_a' })
        ?.title
    ).toBe('CLE Panel');
    expect(
      h.opportunities.getById('opp-1', { organizationId: 'org_b', clientId: 'client_b' })
        ?.title
    ).toBe('Foreign');
    expect(tenantEntityKey('org_a', 'client_a', 'opp-1')).not.toBe(
      tenantEntityKey('org_b', 'client_b', 'opp-1')
    );
  });

  it('preserves multi-thesis Candidate and one-thesis Opportunity + Plan traceability', () => {
    const h = harness();
    const c = makeCandidate();
    h.candidates.commitWriteUnit({ candidates: [c], history: [] });
    const loaded = h.candidates.getById('cand-1', {
      organizationId: 'org_a',
      clientId: 'client_a',
    })!;
    expect(loaded.thesisEvaluations).toHaveLength(3);
    expect(loaded.latestScore?.totalScore).toBe(100);
    expect(loaded.latestScore?.scoringModelVersion).toBe(OPPORTUNITY_SCORE_MODEL_VERSION);

    const o = makeOpportunity();
    h.opportunities.commitWriteUnit({ opportunities: [o], history: [] });
    const opp = h.opportunities.getById('opp-1', {
      organizationId: 'org_a',
      clientId: 'client_a',
    })!;
    expect(opp.thesisId).toBe('thesis-a');
    expect(opp.strategicPlanId).toBe('plan-1');
    expect(opp.planItemId).toBe('item-1');
    expect(opp.strategicBriefVersion).toBe(2);
  });
});

describe('SPEC-007 Phase 3 — schema / malformed fail-closed (T-007-304)', () => {
  it('unknown schemaVersion and malformed aggregates fail closed', () => {
    expect(() =>
      parseStoredCandidate({
        ...makeCandidate(),
        schemaVersion: 'future-v99',
      })
    ).toThrow(OpportunityApplicationError);

    expect(() =>
      parseStoredOpportunity({
        ...makeOpportunity(),
        status: 'NOT_A_STATUS',
      })
    ).toThrow(OpportunityApplicationError);

    expect(() =>
      parseStoredOpportunity({
        ...makeOpportunity(),
        thesisId: '',
      })
    ).toThrow(OpportunityApplicationError);

    expect(() =>
      parseStoredOpportunityScore({
        ...makeScore(),
        dimensions: makeScore().dimensions.slice(0, 3),
      })
    ).toThrow(OpportunityApplicationError);

    const h = harness();
    // Inject envelope with wrong schema into kv and force reload
    h.kv.setItem(
      'postura_opportunity_v1',
      JSON.stringify({ schemaVersion: 'unknown', opportunities: [] })
    );
    const store2 = createLocalOpportunityScoutStore(h.kv);
    expect(() =>
      store2.getOpportunity('opp-1', { organizationId: 'org_a', clientId: 'client_a' })
    ).toThrow(OpportunityApplicationError);
  });

  it('tenant envelope mismatch on stored vs requested key yields NOT_FOUND isolation', () => {
    const h = harness();
    h.candidates.commitWriteUnit({
      candidates: [makeCandidate()],
      history: [],
    });
    expect(
      h.candidates.getById('cand-1', { organizationId: 'org_b', clientId: 'client_b' })
    ).toBeUndefined();
  });
});

describe('SPEC-007 Phase 3 — version / stale / duplicate (T-007-305)', () => {
  it('stale write denied; version advances', () => {
    const h = harness();
    const o1 = makeOpportunity({ version: 2 });
    h.opportunities.commitWriteUnit({ opportunities: [o1], history: [] });
    expect(() =>
      h.opportunities.commitWriteUnit({
        opportunities: [makeOpportunity({ version: 1, title: 'stale' })],
        history: [],
      })
    ).toThrow(OpportunityApplicationError);

    h.opportunities.commitWriteUnit({
      opportunities: [makeOpportunity({ version: 3, status: 'ACCEPTED' })],
      history: [],
    });
    expect(
      h.opportunities.getById('opp-1', { organizationId: 'org_a', clientId: 'client_a' })
        ?.status
    ).toBe('ACCEPTED');
  });
});

describe('SPEC-007 Phase 3 — history + idempotency + write coherence (T-007-303/306)', () => {
  it('history is append-only AUDIT_ONLY and never overrides current aggregate', () => {
    const h = harness();
    h.opportunities.commitWriteUnit({
      opportunities: [makeOpportunity({ status: 'ACCEPTED', version: 2 })],
      history: [
        createHistoryEventIntent({
          kind: 'OPPORTUNITY_TRANSITION',
          organizationId: 'org_a',
          clientId: 'client_a',
          aggregateKind: 'OPPORTUNITY',
          aggregateId: 'opp-1',
          aggregateVersion: 2,
          actorKind: 'HUMAN',
          reasonCodes: ['TRANSITION_APPLIED'],
          materialFingerprint: 'fp',
          occurredAt: NOW,
        }),
      ],
    });
    // Forge declining history after accept — current remains ACCEPTED
    h.history.append(
      createHistoryEventIntent({
        kind: 'OPPORTUNITY_TRANSITION',
        organizationId: 'org_a',
        clientId: 'client_a',
        aggregateKind: 'OPPORTUNITY',
        aggregateId: 'opp-1',
        aggregateVersion: 99,
        actorKind: 'HUMAN',
        reasonCodes: ['FORGED_DECLINE'],
        materialFingerprint: 'fp-declined',
        occurredAt: NOW,
      })
    );
    const current = h.opportunities.getById('opp-1', {
      organizationId: 'org_a',
      clientId: 'client_a',
    });
    expect(current?.status).toBe('ACCEPTED');
    expect(h.history.listForInspection().every((e) => e.authority === 'AUDIT_ONLY')).toBe(
      true
    );
  });

  it('idempotency replay returns same binding; conflict fails closed', () => {
    const h = harness();
    const unit: OpportunityWriteUnit = {
      opportunities: [makeOpportunity()],
      history: [],
      idempotencyKeys: [
        {
          key: 'MaterializeOpportunity|mat-1',
          aggregateKind: 'OPPORTUNITY',
          aggregateId: 'opp-1',
          organizationId: 'org_a',
          clientId: 'client_a',
          at: NOW,
        },
      ],
    };
    h.opportunities.commitWriteUnit(unit);
    const hit = h.opportunities.findByIdempotencyKey(
      { organizationId: 'org_a', clientId: 'client_a' },
      'MaterializeOpportunity|mat-1'
    );
    expect(hit?.opportunityId).toBe('opp-1');

    // Same key same id = ok (no-op bind)
    h.opportunities.commitWriteUnit(unit);

    expect(() =>
      h.opportunities.commitWriteUnit({
        opportunities: [makeOpportunity({ id: 'opp-2' })],
        history: [],
        idempotencyKeys: [
          {
            key: 'MaterializeOpportunity|mat-1',
            aggregateKind: 'OPPORTUNITY',
            aggregateId: 'opp-2',
            organizationId: 'org_a',
            clientId: 'client_a',
            at: NOW,
          },
        ],
      })
    ).toThrow(OpportunityApplicationError);
  });

  it('write unit rolls back in-memory on persist failure (coherence)', () => {
    const h = harness();
    h.opportunities.commitWriteUnit({
      opportunities: [makeOpportunity()],
      history: [],
    });
    h.store.failBeforePersistForTest = true;
    expect(() =>
      h.opportunities.commitWriteUnit({
        opportunities: [makeOpportunity({ version: 2, title: 'should-rollback' })],
        history: [],
      })
    ).toThrow(OpportunityApplicationError);
    h.store.failBeforePersistForTest = false;
    expect(
      h.opportunities.getById('opp-1', { organizationId: 'org_a', clientId: 'client_a' })
        ?.title
    ).toBe('CLE Panel');
  });
});

describe('SPEC-007 Phase 3 — legacy v5 compatibility (T-007-307)', () => {
  it('maps lossless legacy rows and marks ambiguous COMPLETED+submitted for review', () => {
    const kv = memoryKv();
    kv.setItem(
      LEGACY_OPPORTUNITIES_V5_KEY,
      JSON.stringify([
        {
          id: 'leg-1',
          organizationId: 'org_a',
          clientId: 'client_a',
          status: 'SENT_TO_CLIENT',
          lifecycleStage: 'proposed',
          thesisId: 't1',
        },
        {
          id: 'leg-2',
          organizationId: 'org_a',
          clientId: 'client_a',
          status: 'COMPLETED',
          lifecycleStage: 'submitted',
        },
      ])
    );
    const reader = createLegacyOpportunityV5CompatibilityReader(kv);
    const rows = reader.listCompatibilityRecords();
    expect(rows[0].disposition).toBe('MAPPED');
    expect(rows[0].canonicalStatus).toBe('PROPOSED');
    expect(rows[0].authority).toBe('COMPATIBILITY_ONLY');
    expect(rows[1].disposition).toBe('MIGRATION_REVIEW_REQUIRED');
  });
});

describe('SPEC-007 Phase 3 — OpportunityScore lossless round-trip', () => {
  it('does not recalculate score on deserialize', () => {
    const score = makeScore({ totalScore: 73, band: 'HIGH' });
    const parsed = parseStoredOpportunityScore(JSON.parse(JSON.stringify(score)));
    expect(parsed.totalScore).toBe(73);
    expect(parsed.dimensions.map((d) => d.contribution)).toEqual(
      score.dimensions.map((d) => d.contribution)
    );
  });
});
