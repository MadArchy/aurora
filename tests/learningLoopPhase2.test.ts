/**
 * SPEC-008 Phase 2 — Application use-case tests (T-008-211).
 */

import { describe, expect, it } from 'vitest';
import {
  createApplyApprovedRecommendation,
  createApproveStrategicRecommendation,
  createBuildLearningAssessment,
  createBuildLearningEvidence,
  createGenerateStrategicRecommendation,
  createGetLearningMetrics,
  createGetStrategicRecommendation,
  createListStrategicRecommendations,
  createRegisterLearningObservation,
  createRejectStrategicRecommendation,
  createReviewStrategicRecommendation,
  createSupersedeLearningObservation,
  createTargetSpecApplyPortRegistry,
  denyDecisionHistoryAsCurrentAuthority,
  denyHistoryAsCurrentAuthority,
  LearningApplicationError,
  type LearningEvidenceRepository,
  type LearningHistoryPort,
  type LearningHistoryRecord,
  type LearningObservationRepository,
  type LearningWriteUnit,
  type RecommendationDecisionRepository,
  type StrategicRecommendationRepository,
  type TargetSpecApplyPort,
  type TrustedLearningActorContext,
} from '../src/application/learningLoop';
import type { LearningAssessment, LearningEvidence } from '../src/domain/learningEvidenceCore';
import type { LearningObservation } from '../src/domain/learningObservationCore';
import type { RecommendationDecision } from '../src/domain/recommendationDecisionCore';
import type { StrategicRecommendation } from '../src/domain/strategicRecommendationCore';
import type { ThesisScope } from '../src/domain/learningThesisScopeCore';

const NOW = '2026-08-26T20:00:00.000Z';

const TRUSTED: TrustedLearningActorContext = {
  actorId: 'mgr_ana',
  actorRole: 'ADMIN',
  organizationId: 'org_a',
  clientId: 'client_a',
  now: NOW,
};

const TRUSTED_SOFTWARE: TrustedLearningActorContext = {
  ...TRUSTED,
  actorId: 'sys_learning',
  softwareAuthority: true,
};

function singleScope(thesisId = 'thesis-a'): ThesisScope {
  return { kind: 'SINGLE', thesisId };
}

function multiScope(): ThesisScope {
  return { kind: 'MULTI', thesisIds: ['thesis-a', 'thesis-b'] };
}

function buildHarness(opts?: {
  targetPorts?: TargetSpecApplyPort[];
}) {
  const observationStore = new Map<string, LearningObservation>();
  const evidenceStore = new Map<string, LearningEvidence>();
  const assessmentStore = new Map<string, LearningAssessment>();
  const recommendationStore = new Map<string, StrategicRecommendation>();
  const idem = new Map<string, { kind: string; id: string; fp: string }>();
  const historyEntries: LearningHistoryRecord[] = [];
  const decisionEntries: RecommendationDecision[] = [];
  const writeUnits: LearningWriteUnit[] = [];
  let targetCallCount = 0;

  function tenantKey(org: string, client: string, id: string) {
    return `${org}|${client}|${id}`;
  }

  function commit(unit: LearningWriteUnit) {
    writeUnits.push(unit);
    for (const o of unit.observations ?? []) {
      observationStore.set(
        tenantKey(o.organizationId, o.clientId, o.observationId),
        structuredClone(o)
      );
    }
    for (const e of unit.evidence ?? []) {
      evidenceStore.set(
        tenantKey(e.organizationId, e.clientId, e.evidenceId),
        structuredClone(e)
      );
    }
    for (const r of unit.recommendations ?? []) {
      recommendationStore.set(
        tenantKey(r.organizationId, r.clientId, r.recommendationId),
        structuredClone(r)
      );
    }
    for (const entry of unit.idempotencyKeys ?? []) {
      const scoped = `${entry.organizationId}|${entry.clientId}|${entry.key}`;
      idem.set(scoped, {
        kind: entry.aggregateKind,
        id: entry.aggregateId,
        fp: entry.materialFingerprint,
      });
    }
  }

  const observations: LearningObservationRepository = {
    getById(observationId, tenant) {
      return observationStore.get(
        tenantKey(tenant.organizationId, tenant.clientId, observationId)
      );
    },
    list(tenant) {
      return [...observationStore.values()].filter(
        (o) =>
          o.organizationId === tenant.organizationId && o.clientId === tenant.clientId
      );
    },
    findByIdempotencyKey(tenant, key) {
      const hit = idem.get(`${tenant.organizationId}|${tenant.clientId}|${key}`);
      return hit?.kind === 'OBSERVATION'
        ? { observationId: hit.id, materialFingerprint: hit.fp }
        : undefined;
    },
    commitWriteUnit: commit,
  };

  const evidence: LearningEvidenceRepository = {
    getById(evidenceId, tenant) {
      return evidenceStore.get(
        tenantKey(tenant.organizationId, tenant.clientId, evidenceId)
      );
    },
    getAssessmentByEvidenceId(evidenceId, tenant) {
      return assessmentStore.get(
        tenantKey(tenant.organizationId, tenant.clientId, evidenceId)
      );
    },
    list(tenant) {
      return [...evidenceStore.values()].filter(
        (e) =>
          e.organizationId === tenant.organizationId && e.clientId === tenant.clientId
      );
    },
    findByIdempotencyKey(tenant, key) {
      const hit = idem.get(`${tenant.organizationId}|${tenant.clientId}|${key}`);
      return hit?.kind === 'EVIDENCE'
        ? { evidenceId: hit.id, materialFingerprint: hit.fp }
        : undefined;
    },
    commitWriteUnit: commit,
  };

  const recommendations: StrategicRecommendationRepository = {
    getById(recommendationId, tenant) {
      return recommendationStore.get(
        tenantKey(tenant.organizationId, tenant.clientId, recommendationId)
      );
    },
    list(tenant, filter) {
      return [...recommendationStore.values()]
        .filter(
          (r) =>
            r.organizationId === tenant.organizationId && r.clientId === tenant.clientId
        )
        .filter((r) => (filter?.status ? r.status === filter.status : true))
        .filter((r) =>
          filter?.thesisId && r.thesisScope.kind === 'SINGLE'
            ? r.thesisScope.thesisId === filter.thesisId
            : true
        );
    },
    findByIdempotencyKey(tenant, key) {
      const hit = idem.get(`${tenant.organizationId}|${tenant.clientId}|${key}`);
      return hit?.kind === 'RECOMMENDATION'
        ? { recommendationId: hit.id, materialFingerprint: hit.fp }
        : undefined;
    },
    commitWriteUnit: commit,
  };

  const history: LearningHistoryPort = { append: (e) => historyEntries.push(e) };

  const decisions: RecommendationDecisionRepository = {
    append: (d) => decisionEntries.push(d),
    listByRecommendation: (id, tenant) =>
      decisionEntries.filter(
        (d) =>
          d.recommendationId === id &&
          d.organizationId === tenant.organizationId &&
          d.clientId === tenant.clientId
      ),
  };

  const defaultTargetPort: TargetSpecApplyPort = {
    specId: 'SPEC-002',
    apply() {
      targetCallCount += 1;
      return { disposition: 'APPLIED', reasonCodes: ['TARGET_APPLIED'] };
    },
  };

  const targetApplyRegistry = createTargetSpecApplyPortRegistry(
    opts?.targetPorts ?? [defaultTargetPort]
  );

  const obsDeps = { observations, history };
  const evDeps = { observations, evidence, history };
  const recDeps = { evidence, recommendations, history };
  const decisionDeps = { recommendations, history, decisions };
  const applyDeps = { recommendations, history, targetApplyRegistry };

  const register = createRegisterLearningObservation(obsDeps);
  const supersede = createSupersedeLearningObservation(obsDeps);
  const buildEvidence = createBuildLearningEvidence(evDeps);
  const buildAssessment = createBuildLearningAssessment({ evidence });
  const generate = createGenerateStrategicRecommendation(recDeps);
  const review = createReviewStrategicRecommendation(decisionDeps);
  const approve = createApproveStrategicRecommendation(decisionDeps);
  const reject = createRejectStrategicRecommendation(decisionDeps);
  const apply = createApplyApprovedRecommendation(applyDeps);
  const getMetrics = createGetLearningMetrics({ evidence });
  const listRecs = createListStrategicRecommendations({ recommendations });
  const getRec = createGetStrategicRecommendation({ recommendations });

  function seedObservation(id = 'obs-1', scope: ThesisScope = singleScope()) {
    return register({
      trusted: TRUSTED,
      observationId: id,
      thesisScope: scope,
      sourceKind: 'SIGNAL_OUTCOME',
      sourceRef: { sourceSpec: 'SPEC-001', sourceId: `sig-${id}` },
      observationKind: 'USEFUL',
      payload: { signalId: id },
      intentKey: `reg-${id}`,
    }).observation;
  }

  function seedEvidence(scope: ThesisScope = singleScope()) {
    seedObservation('obs-1', scope);
    return buildEvidence({
      trusted: TRUSTED,
      evidenceId: 'ev-1',
      thesisScope: scope,
      observationIds: ['obs-1'],
      metrics: [{ key: 'useful', label: 'Useful', value: 1 }],
      summary: 'One useful signal',
      intentKey: 'ev-build-1',
    }).evidence;
  }

  function seedRecommendation(
    scope: ThesisScope = singleScope(),
    confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
  ) {
    seedEvidence(scope);
    return generate({
      trusted: TRUSTED_SOFTWARE,
      recommendationId: 'rec-1',
      thesisScope: scope,
      learningEvidenceId: 'ev-1',
      recommendationType: 'STRATEGIC_SCORE_CONFIGURATION',
      targetAuthority: { specId: 'SPEC-002', domain: 'scoring' },
      proposedChange: {
        changeKind: 'WEIGHT_ADJUSTMENT',
        schemaVersion: 'score-v1',
        payload: { dimension: 'strategicFit', delta: 0.05 },
      },
      rationale: 'Evidence supports weight increase',
      confidence,
      risks: ['Overfitting'],
      expectedImpact: { summary: 'Better fit signals' },
      intentKey: 'gen-1',
    }).recommendation;
  }

  function approveFlow() {
    seedRecommendation();
    review({ trusted: TRUSTED, recommendationId: 'rec-1' });
    return approve({
      trusted: TRUSTED,
      recommendationId: 'rec-1',
      decisionId: 'dec-1',
      reason: 'Looks good',
    });
  }

  return {
    observationStore,
    evidenceStore,
    recommendationStore,
    historyEntries,
    decisionEntries,
    writeUnits,
    get targetCallCount() {
      return targetCallCount;
    },
    register,
    supersede,
    buildEvidence,
    buildAssessment,
    generate,
    review,
    approve,
    reject,
    apply,
    getMetrics,
    listRecs,
    getRec,
    seedObservation,
    seedEvidence,
    seedRecommendation,
    approveFlow,
  };
}

describe('SPEC-008 Phase 2 — trusted context (T-008-208)', () => {
  it('trusted tenant wins; caller tenant spoof denied', () => {
    const h = buildHarness();
    h.seedObservation();
    expect(() =>
      h.buildEvidence({
        trusted: TRUSTED,
        evidenceId: 'ev-1',
        thesisScope: singleScope(),
        observationIds: ['obs-1'],
        metrics: [{ key: 'k', label: 'K', value: 1 }],
        summary: 's',
        intentKey: 'k1',
        claimedOrganizationId: 'org_b',
      })
    ).toThrow(LearningApplicationError);
  });

  it('caller HUMAN / approvedBy claims do not establish approval authority', () => {
    const h = buildHarness();
    h.seedRecommendation();
    h.review({ trusted: TRUSTED, recommendationId: 'rec-1' });
    expect(() =>
      h.approve({
        trusted: TRUSTED_SOFTWARE,
        recommendationId: 'rec-1',
        decisionId: 'dec-spoof',
        reason: 'spoof',
        actorType: 'HUMAN',
        approvedBy: 'user_admin_01',
        humanAuthority: true,
      })
    ).toThrow(LearningApplicationError);
  });

  it('history and decision history cannot be current authority', () => {
    expect(() => denyHistoryAsCurrentAuthority()).toThrow(LearningApplicationError);
    expect(() => denyDecisionHistoryAsCurrentAuthority()).toThrow(LearningApplicationError);
  });
});

describe('SPEC-008 Phase 2 — observations (T-008-201)', () => {
  it('registers observation with trusted tenant and explicit thesis scope', () => {
    const h = buildHarness();
    const obs = h.seedObservation('obs-1', multiScope());
    expect(obs.thesisScope.kind).toBe('MULTI');
    expect(obs.status).toBe('ACTIVE');
    expect(h.writeUnits.length).toBeGreaterThan(0);
  });

  it('register idempotency returns same observation without duplicate write', () => {
    const h = buildHarness();
    h.seedObservation();
    const writes = h.writeUnits.length;
    const replay = h.register({
      trusted: TRUSTED,
      observationId: 'obs-2',
      thesisScope: singleScope(),
      sourceKind: 'SIGNAL_OUTCOME',
      sourceRef: { sourceSpec: 'SPEC-001', sourceId: 'sig-x' },
      observationKind: 'USEFUL',
      payload: {},
      intentKey: 'reg-obs-1',
    });
    expect(replay.created).toBe(false);
    expect(h.writeUnits.length).toBe(writes);
  });

  it('supersedes prior observation via repository-loaded current state', () => {
    const h = buildHarness();
    h.seedObservation('obs-old');
    const result = h.supersede({
      trusted: TRUSTED,
      priorObservationId: 'obs-old',
      successorObservationId: 'obs-new',
      thesisScope: singleScope(),
      sourceKind: 'SIGNAL_OUTCOME',
      sourceRef: { sourceSpec: 'SPEC-001', sourceId: 'sig-new' },
      observationKind: 'NOT_USEFUL',
      payload: { corrected: true },
    });
    expect(result.prior.status).toBe('SUPERSEDED');
    expect(result.successor.status).toBe('ACTIVE');
  });

  it('same-ID cross-tenant isolation', () => {
    const h = buildHarness();
    h.register({
      trusted: TRUSTED,
      observationId: 'shared-id',
      thesisScope: singleScope(),
      sourceKind: 'SIGNAL_OUTCOME',
      sourceRef: { sourceSpec: 'SPEC-001', sourceId: 's1' },
      observationKind: 'USEFUL',
      payload: {},
      intentKey: 'a',
    });
    const otherTrusted: TrustedLearningActorContext = {
      ...TRUSTED,
      organizationId: 'org_b',
      clientId: 'client_b',
    };
    h.register({
      trusted: otherTrusted,
      observationId: 'shared-id',
      thesisScope: singleScope('thesis-b'),
      sourceKind: 'SIGNAL_OUTCOME',
      sourceRef: { sourceSpec: 'SPEC-001', sourceId: 's2' },
      observationKind: 'USEFUL',
      payload: {},
      intentKey: 'b',
    });
    expect(h.observationStore.has('org_a|client_a|shared-id')).toBe(true);
    expect(h.observationStore.has('org_b|client_b|shared-id')).toBe(true);
  });
});

describe('SPEC-008 Phase 2 — evidence + assessment (T-008-202)', () => {
  it('builds evidence from repository-loaded observations; cross-tenant denied', () => {
    const h = buildHarness();
    h.seedObservation('obs-a');
    const otherTrusted: TrustedLearningActorContext = {
      ...TRUSTED,
      organizationId: 'org_b',
      clientId: 'client_b',
    };
    h.register({
      trusted: otherTrusted,
      observationId: 'obs-b',
      thesisScope: singleScope('thesis-b'),
      sourceKind: 'SIGNAL_OUTCOME',
      sourceRef: { sourceSpec: 'SPEC-001', sourceId: 's-b' },
      observationKind: 'USEFUL',
      payload: {},
      intentKey: 'b',
    });
    expect(() =>
      h.buildEvidence({
        trusted: TRUSTED,
        evidenceId: 'ev-x',
        thesisScope: singleScope(),
        observationIds: ['obs-b'],
        metrics: [{ key: 'k', label: 'K', value: 1 }],
        summary: 'bad link',
        intentKey: 'x',
      })
    ).toThrow(LearningApplicationError);
  });

  it('builds assessment projection from canonical evidence', () => {
    const h = buildHarness();
    h.seedEvidence();
    const result = h.buildAssessment({
      trusted: TRUSTED,
      assessmentId: 'asmt-1',
      evidenceId: 'ev-1',
      signalsUseful: 3,
      signalsNotUseful: 1,
    });
    expect(result.assessment.evidenceId).toBe('ev-1');
    expect(result.explainability.reasonCodes).toContain('ASSESSMENT_PROJECTED');
  });

  it('GetLearningMetrics returns tenant-scoped assessment', () => {
    const h = buildHarness();
    h.seedEvidence();
    const metrics = h.getMetrics({
      trusted: TRUSTED,
      evidenceId: 'ev-1',
      assessmentId: 'asmt-1',
    });
    expect(metrics.assessment.organizationId).toBe('org_a');
  });
});

describe('SPEC-008 Phase 2 — recommendation lifecycle (T-008-203…206)', () => {
  it('generate creates PROPOSED — not APPROVED', () => {
    const h = buildHarness();
    const rec = h.seedRecommendation(undefined, 'HIGH');
    expect(rec.status).toBe('PROPOSED');
    expect(rec.confidence).toBe('HIGH');
  });

  it('maximum confidence does not auto-approve or call target port', () => {
    const h = buildHarness();
    h.seedRecommendation(undefined, 'HIGH');
    const applyResult = h.apply({
      trusted: TRUSTED_SOFTWARE,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-1',
    });
    expect(applyResult.targetPortCalled).toBe(false);
    expect(applyResult.recommendation.status).toBe('PROPOSED');
  });

  it('human approval required; approve ≠ apply', () => {
    const h = buildHarness();
    const approved = h.approveFlow();
    expect(approved.recommendation.status).toBe('APPROVED');
    expect(h.targetCallCount).toBe(0);
  });

  it('apply invokes target port only after APPROVED', () => {
    const h = buildHarness();
    h.approveFlow();
    const result = h.apply({
      trusted: TRUSTED_SOFTWARE,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-1',
    });
    expect(result.targetPortCalled).toBe(true);
    expect(result.recommendation.status).toBe('APPLIED');
    expect(h.targetCallCount).toBe(1);
  });

  it('rejected recommendation cannot apply — target port calls = 0', () => {
    const h = buildHarness();
    h.seedRecommendation();
    h.review({ trusted: TRUSTED, recommendationId: 'rec-1' });
    h.reject({
      trusted: TRUSTED,
      recommendationId: 'rec-1',
      decisionId: 'dec-r',
      reason: 'No',
    });
    const result = h.apply({
      trusted: TRUSTED_SOFTWARE,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-r',
    });
    expect(result.targetPortCalled).toBe(false);
    expect(result.recommendation.status).toBe('REJECTED');
  });

  it('caller forged APPROVED snapshot ignored — repository current wins', () => {
    const h = buildHarness();
    h.seedRecommendation();
    const result = h.apply({
      trusted: TRUSTED_SOFTWARE,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-forge',
      forgedStatus: 'APPROVED',
      approved: true,
      approvedBy: 'user_admin_01',
    });
    expect(result.targetPortCalled).toBe(false);
    expect(result.recommendation.status).toBe('PROPOSED');
  });

  it('unsupported target → APPROVED_NOT_APPLIED', () => {
    const h = buildHarness({ targetPorts: [] });
    h.approveFlow();
    const result = h.apply({
      trusted: TRUSTED_SOFTWARE,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-unsupported',
    });
    expect(result.targetPortCalled).toBe(false);
    expect(result.recommendation.status).toBe('APPROVED_NOT_APPLIED');
  });

  it('target validation rejected → APPROVED_NOT_APPLIED not APPLIED', () => {
    const rejectPort: TargetSpecApplyPort = {
      specId: 'SPEC-002',
      apply: () => ({
        disposition: 'VALIDATION_REJECTED',
        reasonCodes: ['TARGET_VALIDATION_DENIED'],
      }),
    };
    const h = buildHarness({ targetPorts: [rejectPort] });
    h.approveFlow();
    const result = h.apply({
      trusted: TRUSTED_SOFTWARE,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-reject',
    });
    expect(result.targetPortCalled).toBe(true);
    expect(result.recommendation.status).toBe('APPROVED_NOT_APPLIED');
    expect(result.recommendation.status).not.toBe('APPLIED');
  });

  it('target failure → APPLY_FAILED', () => {
    const failPort: TargetSpecApplyPort = {
      specId: 'SPEC-002',
      apply: () => ({ disposition: 'FAILED', reasonCodes: ['TARGET_ERROR'] }),
    };
    const h = buildHarness({ targetPorts: [failPort] });
    h.approveFlow();
    const result = h.apply({
      trusted: TRUSTED_SOFTWARE,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-fail',
    });
    expect(result.recommendation.status).toBe('APPLY_FAILED');
  });

  it('tenant mismatch on recommendation load denied', () => {
    const h = buildHarness();
    h.seedRecommendation();
    const otherTrusted: TrustedLearningActorContext = {
      ...TRUSTED,
      organizationId: 'org_b',
      clientId: 'client_b',
    };
    expect(() =>
      h.getRec({ trusted: otherTrusted, recommendationId: 'rec-1' })
    ).toThrow(LearningApplicationError);
  });

  it('ListStrategicRecommendations is tenant-safe', () => {
    const h = buildHarness();
    h.seedRecommendation();
    const items = h.listRecs({ trusted: TRUSTED, status: 'PROPOSED' });
    expect(items).toHaveLength(1);
    expect(items[0].recommendation.organizationId).toBe('org_a');
  });

  it('CLIENT_WIDE thesis scope preserved', () => {
    const h = buildHarness();
    const scope: ThesisScope = { kind: 'CLIENT_WIDE' };
    h.seedObservation('obs-cw', scope);
    const ev = h.buildEvidence({
      trusted: TRUSTED,
      evidenceId: 'ev-cw',
      thesisScope: scope,
      observationIds: ['obs-cw'],
      metrics: [{ key: 'k', label: 'K', value: 1 }],
      summary: 'client wide',
      intentKey: 'cw',
    });
    expect(ev.evidence.thesisScope.kind).toBe('CLIENT_WIDE');
  });
});

describe('SPEC-008 Phase 2 — idempotency + side-effect ordering (T-008-206)', () => {
  it('apply idempotent replay on APPLIED does not double target call', () => {
    const h = buildHarness();
    h.approveFlow();
    h.apply({
      trusted: TRUSTED_SOFTWARE,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-idem',
    });
    expect(h.targetCallCount).toBe(1);
    const replay = h.apply({
      trusted: TRUSTED_SOFTWARE,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-idem',
    });
    expect(replay.targetPortCalled).toBe(false);
    expect(h.targetCallCount).toBe(1);
  });
});
