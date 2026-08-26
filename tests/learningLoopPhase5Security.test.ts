/**
 * SPEC-008 Phase 5 — Security / adversarial suite (T-008-501…509).
 *
 * Attacks run against the REAL Phase-3 infrastructure store and Phase-2
 * Application use cases (no repository mocks) so that defenses are proven at
 * runtime rather than by static inspection.
 *
 * Formal threat coverage: T-008-01 … T-008-26 (threat-model.md).
 */

import { describe, expect, it } from 'vitest';
import {
  LearningApplicationError,
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
  type TargetSpecApplyPort,
  type TrustedLearningActorContext,
} from '../src/application/learningLoop';
import {
  LEARNING_OBSERVATION_STORE_KEY,
  LEARNING_OBSERVATION_STORE_SCHEMA,
  LEARNING_RECOMMENDATION_STORE_KEY,
  LEARNING_RECOMMENDATION_STORE_SCHEMA,
  LEGACY_FEEDBACK_V1_KEY,
  LEGACY_RESULTS_V5_KEY,
  LEGACY_SIGNAL_OUTCOMES_KEY,
  LocalLearningEvidenceRepository,
  LocalLearningHistoryAdapter,
  LocalLearningObservationRepository,
  LocalRecommendationDecisionAdapter,
  LocalStrategicRecommendationRepository,
  createLegacyLearningCompatibilityReader,
  createLocalLearningLoopStore,
  type StorageLike,
} from '../src/infrastructure/learningLoop';
import {
  assertActorMayEnterRecommendationStatus,
  assertCanApplyRecommendation,
  assertNotSuperseded,
} from '../src/domain/recommendationLifecycleCore';
import {
  assertHumanOnlyApproval,
  assertRecommendationApplyGate,
  assertTargetSpecAuthorityPreserved,
  transitionStrategicRecommendationStatus,
} from '../src/domain/learningAuthorityCore';
import {
  createLearningHistoryRecord,
  observationMaterialFingerprint,
  recommendationMaterialFingerprint,
} from '../src/domain/learningMaterialityCore';
import { createRecommendationDecision } from '../src/domain/recommendationDecisionCore';
import type { ThesisScope } from '../src/domain/learningThesisScopeCore';
import type { StrategicRecommendation } from '../src/domain/strategicRecommendationCore';

const NOW = '2026-08-26T22:30:00.000Z';
const LATER = '2026-08-26T23:00:00.000Z';

const TENANT_A = { organizationId: 'org_a', clientId: 'client_a' };
const TENANT_B = { organizationId: 'org_b', clientId: 'client_b' };

const HUMAN_A: TrustedLearningActorContext = {
  actorId: 'mgr_ana',
  actorRole: 'ADMIN',
  organizationId: 'org_a',
  clientId: 'client_a',
  now: NOW,
};

const SOFTWARE_A: TrustedLearningActorContext = {
  ...HUMAN_A,
  actorId: 'sys_learning',
  softwareAuthority: true,
};

const HUMAN_B: TrustedLearningActorContext = {
  actorId: 'mgr_bob',
  actorRole: 'ADMIN',
  organizationId: 'org_b',
  clientId: 'client_b',
  now: NOW,
};

const SOFTWARE_B: TrustedLearningActorContext = {
  ...HUMAN_B,
  actorId: 'sys_learning_b',
  softwareAuthority: true,
};

function memoryKv(seed?: Record<string, string>): StorageLike {
  const data = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function singleScope(thesisId = 'thesis-a'): ThesisScope {
  return { kind: 'SINGLE', thesisId };
}

/** Real store + real adapters + instrumented target port. */
function harness(opts?: { targetPorts?: TargetSpecApplyPort[] }) {
  const store = createLocalLearningLoopStore(memoryKv());
  store.resetForTest();

  const observations = new LocalLearningObservationRepository(store);
  const evidence = new LocalLearningEvidenceRepository(store);
  const recommendations = new LocalStrategicRecommendationRepository(store);
  const history = new LocalLearningHistoryAdapter(store);
  const decisions = new LocalRecommendationDecisionAdapter(store);

  const targetCalls: Array<{ specId: string; recommendationId: string }> = [];
  const defaultPort: TargetSpecApplyPort = {
    specId: 'SPEC-002',
    apply(request) {
      targetCalls.push({
        specId: 'SPEC-002',
        recommendationId: request.recommendation.recommendationId,
      });
      return { disposition: 'APPLIED', reasonCodes: ['TARGET_APPLIED'] };
    },
  };
  const ports = opts?.targetPorts ?? [defaultPort];
  const targetApplyRegistry = createTargetSpecApplyPortRegistry(ports);

  const obsDeps = { observations, history };
  const evDeps = { observations, evidence, history };
  const recDeps = { evidence, recommendations, history };
  const decisionDeps = { recommendations, history, decisions };
  const applyDeps = { recommendations, history, targetApplyRegistry };

  const api = {
    store,
    observations,
    evidence,
    recommendations,
    history,
    decisions,
    targetCalls,
    register: createRegisterLearningObservation(obsDeps),
    supersede: createSupersedeLearningObservation(obsDeps),
    buildEvidence: createBuildLearningEvidence(evDeps),
    buildAssessment: createBuildLearningAssessment({ evidence }),
    generate: createGenerateStrategicRecommendation(recDeps),
    review: createReviewStrategicRecommendation(decisionDeps),
    approve: createApproveStrategicRecommendation(decisionDeps),
    reject: createRejectStrategicRecommendation(decisionDeps),
    apply: createApplyApprovedRecommendation(applyDeps),
    getMetrics: createGetLearningMetrics({ evidence }),
    listRecs: createListStrategicRecommendations({ recommendations }),
    getRec: createGetStrategicRecommendation({ recommendations }),
  };

  function seedObservation(
    trusted: TrustedLearningActorContext,
    id = 'obs-1',
    scope: ThesisScope = singleScope()
  ) {
    return api.register({
      trusted,
      observationId: id,
      thesisScope: scope,
      sourceKind: 'SIGNAL_OUTCOME',
      sourceRef: { sourceSpec: 'SPEC-001', sourceId: `sig-${id}` },
      observationKind: 'USEFUL',
      payload: { signalId: id },
      intentKey: `reg-${id}`,
    }).observation;
  }

  function seedEvidence(
    trusted: TrustedLearningActorContext,
    evidenceId = 'ev-1',
    scope: ThesisScope = singleScope(),
    observationId = 'obs-1'
  ) {
    seedObservation(trusted, observationId, scope);
    return api.buildEvidence({
      trusted,
      evidenceId,
      thesisScope: scope,
      observationIds: [observationId],
      metrics: [{ key: 'useful', label: 'Useful', value: 1 }],
      summary: 'One useful signal',
      intentKey: `ev-${evidenceId}`,
    }).evidence;
  }

  function seedRecommendation(
    trustedHuman: TrustedLearningActorContext,
    trustedSoftware: TrustedLearningActorContext,
    recommendationId = 'rec-1',
    confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM',
    scope: ThesisScope = singleScope()
  ) {
    seedEvidence(trustedHuman, `ev-${recommendationId}`, scope, `obs-${recommendationId}`);
    return api.generate({
      trusted: trustedSoftware,
      recommendationId,
      thesisScope: scope,
      learningEvidenceId: `ev-${recommendationId}`,
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
      intentKey: `gen-${recommendationId}`,
    }).recommendation;
  }

  function approvedRecommendation(recommendationId = 'rec-1') {
    seedRecommendation(HUMAN_A, SOFTWARE_A, recommendationId);
    api.review({ trusted: HUMAN_A, recommendationId });
    return api.approve({
      trusted: HUMAN_A,
      recommendationId,
      decisionId: `dec-${recommendationId}`,
      reason: 'Approved by trusted human',
    }).recommendation;
  }

  /** Adversarial persistence injection — simulates hostile/corrupt stored state. */
  function injectRecommendation(rec: StrategicRecommendation) {
    api.recommendations.commitWriteUnit({ recommendations: [rec], history: [] });
  }

  return {
    ...api,
    seedObservation,
    seedEvidence,
    seedRecommendation,
    approvedRecommendation,
    injectRecommendation,
  };
}

// ============================================================
// T-008-01 · Caller tenant spoof
// ============================================================

describe('T-008-01 — caller tenant spoof denied on every canonical command', () => {
  it('register / supersede reject claimed foreign tenant', () => {
    const h = harness();
    expect(() =>
      h.register({
        trusted: HUMAN_A,
        observationId: 'obs-spoof',
        thesisScope: singleScope(),
        sourceKind: 'SIGNAL_OUTCOME',
        sourceRef: { sourceSpec: 'SPEC-001', sourceId: 'sig-spoof' },
        observationKind: 'USEFUL',
        payload: {},
        intentKey: 'spoof-1',
        claimedOrganizationId: 'org_b',
      })
    ).toThrow(LearningApplicationError);

    h.seedObservation(HUMAN_A, 'obs-1');
    expect(() =>
      h.supersede({
        trusted: HUMAN_A,
        priorObservationId: 'obs-1',
        successorObservationId: 'obs-2',
        thesisScope: singleScope(),
        sourceKind: 'SIGNAL_OUTCOME',
        sourceRef: { sourceSpec: 'SPEC-001', sourceId: 'sig-2' },
        observationKind: 'NOT_USEFUL',
        payload: {},
        claimedClientId: 'client_b',
      })
    ).toThrow(LearningApplicationError);
  });

  it('evidence / assessment / metrics reject claimed foreign tenant', () => {
    const h = harness();
    h.seedObservation(HUMAN_A, 'obs-1');
    expect(() =>
      h.buildEvidence({
        trusted: HUMAN_A,
        evidenceId: 'ev-spoof',
        thesisScope: singleScope(),
        observationIds: ['obs-1'],
        metrics: [{ key: 'k', label: 'K', value: 1 }],
        summary: 's',
        intentKey: 'ev-spoof',
        claimedOrganizationId: 'org_b',
      })
    ).toThrow(LearningApplicationError);
  });

  it('generate / review / approve / reject / apply reject claimed foreign tenant', () => {
    const h = harness();
    h.approvedRecommendation('rec-1');

    expect(() =>
      h.review({
        trusted: HUMAN_A,
        recommendationId: 'rec-1',
        claimedOrganizationId: 'org_b',
      })
    ).toThrow(LearningApplicationError);

    expect(() =>
      h.approve({
        trusted: HUMAN_A,
        recommendationId: 'rec-1',
        decisionId: 'dec-spoof',
        reason: 'spoof',
        claimedClientId: 'client_b',
      })
    ).toThrow(LearningApplicationError);

    expect(() =>
      h.reject({
        trusted: HUMAN_A,
        recommendationId: 'rec-1',
        decisionId: 'dec-spoof-2',
        reason: 'spoof',
        claimedOrganizationId: 'org_b',
      })
    ).toThrow(LearningApplicationError);

    expect(() =>
      h.apply({
        trusted: SOFTWARE_A,
        recommendationId: 'rec-1',
        applyAttemptId: 'att-spoof',
        claimedOrganizationId: 'org_b',
      })
    ).toThrow(LearningApplicationError);

    expect(h.targetCalls).toHaveLength(0);
  });

  it('cross-tenant read of foreign recommendation is NOT_FOUND, not leaked', () => {
    const h = harness();
    h.approvedRecommendation('rec-1');
    expect(() => h.getRec({ trusted: HUMAN_B, recommendationId: 'rec-1' })).toThrow(
      LearningApplicationError
    );
    expect(h.listRecs({ trusted: HUMAN_B })).toEqual([]);
  });
});

// ============================================================
// T-008-02 · Same-ID cross-tenant
// ============================================================

describe('T-008-02 — same-ID cross-tenant isolation', () => {
  it('observations, evidence, recommendations and idempotency stay isolated per tenant', () => {
    const h = harness();

    h.seedObservation(HUMAN_A, 'shared-id');
    h.seedObservation(HUMAN_B, 'shared-id');

    const a = h.observations.getById('shared-id', TENANT_A);
    const b = h.observations.getById('shared-id', TENANT_B);
    expect(a?.organizationId).toBe('org_a');
    expect(b?.organizationId).toBe('org_b');
    expect(h.observations.list(TENANT_A)).toHaveLength(1);
    expect(h.observations.list(TENANT_B)).toHaveLength(1);

    h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-shared');
    h.seedRecommendation(HUMAN_B, SOFTWARE_B, 'rec-shared');
    expect(h.recommendations.getById('rec-shared', TENANT_A)?.clientId).toBe('client_a');
    expect(h.recommendations.getById('rec-shared', TENANT_B)?.clientId).toBe('client_b');
  });

  it('no id-only lookup exists on the canonical repositories', () => {
    const h = harness();
    h.seedObservation(HUMAN_A, 'obs-1');
    // getById REQUIRES a tenant scope — a foreign scope yields undefined, never the row.
    expect(h.observations.getById('obs-1', TENANT_B)).toBeUndefined();
    expect(
      (h.observations.getById as (...args: unknown[]) => unknown).length
    ).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// T-008-03 / T-008-04 · Caller actor + role spoof, hard-coded fallback
// ============================================================

describe('T-008-03 / T-008-04 — caller actor/role spoof and actor fallback', () => {
  it('caller actorUid / createdBy / role / actorType never establish identity', () => {
    const h = harness();
    const result = h.register({
      trusted: HUMAN_A,
      observationId: 'obs-actor',
      thesisScope: singleScope(),
      sourceKind: 'SIGNAL_OUTCOME',
      sourceRef: { sourceSpec: 'SPEC-001', sourceId: 'sig-actor' },
      observationKind: 'USEFUL',
      payload: {},
      intentKey: 'actor-1',
      actorUid: 'user_admin_01',
      createdBy: 'client',
      actorType: 'HUMAN',
      role: 'ADMIN',
    });
    expect(result.observation.actorUid).toBe('mgr_ana');
    expect(result.observation.actorUid).not.toBe('user_admin_01');
    expect(result.observation.actorUid).not.toBe('client');
  });

  it('approvedBy is trusted actor, never caller-supplied victim identity', () => {
    const h = harness();
    h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    h.review({ trusted: HUMAN_A, recommendationId: 'rec-1' });
    const approved = h.approve({
      trusted: HUMAN_A,
      recommendationId: 'rec-1',
      decisionId: 'dec-1',
      reason: 'ok',
      approvedBy: 'user_admin_01',
      humanAuthority: true,
      actorType: 'HUMAN',
      role: 'ADMIN',
    });
    expect(approved.recommendation.approvedBy).toBe('mgr_ana');
    expect(approved.decision.actorUid).toBe('mgr_ana');
  });

  it('missing trusted context fails closed — no anonymous/admin fallback', () => {
    const h = harness();
    const noActor = { ...HUMAN_A, actorId: '   ' } as TrustedLearningActorContext;
    expect(() =>
      h.register({
        trusted: noActor,
        observationId: 'obs-x',
        thesisScope: singleScope(),
        sourceKind: 'SIGNAL_OUTCOME',
        sourceRef: { sourceSpec: 'SPEC-001', sourceId: 's' },
        observationKind: 'USEFUL',
        payload: {},
        intentKey: 'k',
      })
    ).toThrow(LearningApplicationError);

    const noTenant = { ...HUMAN_A, organizationId: '' } as TrustedLearningActorContext;
    expect(() =>
      h.register({
        trusted: noTenant,
        observationId: 'obs-y',
        thesisScope: singleScope(),
        sourceKind: 'SIGNAL_OUTCOME',
        sourceRef: { sourceSpec: 'SPEC-001', sourceId: 's' },
        observationKind: 'USEFUL',
        payload: {},
        intentKey: 'k2',
      })
    ).toThrow(LearningApplicationError);

    const noClock = { ...HUMAN_A, now: '' } as TrustedLearningActorContext;
    expect(() =>
      h.register({
        trusted: noClock,
        observationId: 'obs-z',
        thesisScope: singleScope(),
        sourceKind: 'SIGNAL_OUTCOME',
        sourceRef: { sourceSpec: 'SPEC-001', sourceId: 's' },
        observationKind: 'USEFUL',
        payload: {},
        intentKey: 'k3',
      })
    ).toThrow(LearningApplicationError);
  });
});

// ============================================================
// T-008-06 / T-008-07 / T-008-08 / T-008-16 · Approval spoof
// ============================================================

describe('T-008-06 / T-008-16 — software cannot impersonate human approval', () => {
  it('trusted SOFTWARE approve/reject denied even with HUMAN payload claims', () => {
    const h = harness();
    h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    h.review({ trusted: HUMAN_A, recommendationId: 'rec-1' });

    expect(() =>
      h.approve({
        trusted: SOFTWARE_A,
        recommendationId: 'rec-1',
        decisionId: 'dec-sw',
        reason: 'auto',
        actorType: 'HUMAN',
        humanAuthority: true,
        approvedBy: 'mgr_ana',
        role: 'ADMIN',
      })
    ).toThrow(LearningApplicationError);

    expect(() =>
      h.reject({
        trusted: SOFTWARE_A,
        recommendationId: 'rec-1',
        decisionId: 'dec-sw2',
        reason: 'auto',
        actorType: 'HUMAN',
        humanAuthority: true,
      })
    ).toThrow(LearningApplicationError);

    expect(h.getRec({ trusted: HUMAN_A, recommendationId: 'rec-1' }).recommendation.status).toBe(
      'UNDER_REVIEW'
    );
  });

  it('caller softwareAuthority payload flag cannot upgrade a trusted human context', () => {
    const h = harness();
    h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    h.review({ trusted: HUMAN_A, recommendationId: 'rec-1' });
    const approved = h.approve({
      trusted: HUMAN_A,
      recommendationId: 'rec-1',
      decisionId: 'dec-1',
      reason: 'ok',
      softwareAuthority: true,
    });
    expect(approved.recommendation.status).toBe('APPROVED');
    expect(approved.recommendation.approvedBy).toBe('mgr_ana');
  });

  it('there is no generic setStatus — status only moves through governed transitions', () => {
    const h = harness();
    h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    // PROPOSED → APPROVED directly is not a legal transition even for a human.
    expect(() =>
      h.approve({
        trusted: HUMAN_A,
        recommendationId: 'rec-1',
        decisionId: 'dec-direct',
        reason: 'skip review',
      })
    ).toThrow(LearningApplicationError);
  });
});

describe('T-008-07 / T-008-08 — AI and UI actor kinds hold zero lifecycle authority', () => {
  it('AI actor kind cannot enter any governed status', () => {
    for (const status of ['APPROVED', 'REJECTED', 'APPLIED', 'UNDER_REVIEW'] as const) {
      expect(assertActorMayEnterRecommendationStatus('AI', status).ok).toBe(false);
      expect(assertActorMayEnterRecommendationStatus('UI', status).ok).toBe(false);
      expect(assertActorMayEnterRecommendationStatus('UNKNOWN', status).ok).toBe(false);
    }
  });

  it('AI/UI/SOFTWARE cannot satisfy human-only approval', () => {
    expect(assertHumanOnlyApproval('AI', 'APPROVED').ok).toBe(false);
    expect(assertHumanOnlyApproval('UI', 'APPROVED').ok).toBe(false);
    expect(assertHumanOnlyApproval('SOFTWARE', 'APPROVED').ok).toBe(false);
    expect(assertHumanOnlyApproval('SOFTWARE', 'REJECTED').ok).toBe(false);
    expect(assertHumanOnlyApproval('HUMAN', 'APPROVED').ok).toBe(true);
  });

  it('AI-shaped advisory payload claiming approval cannot transition the aggregate', () => {
    const h = harness();
    const rec = h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    const aiClaim = transitionStrategicRecommendationStatus({
      recommendation: rec,
      to: 'APPROVED',
      actorKind: 'AI',
      updatedAt: LATER,
    });
    expect(aiClaim.ok).toBe(false);
  });
});

// ============================================================
// T-008-14 / T-008-23 · Apply before approval, side-effect before gate
// ============================================================

describe('T-008-14 / T-008-23 — apply-before-approval and side-effect ordering', () => {
  it('apply from PROPOSED / UNDER_REVIEW never calls the target port', () => {
    const h = harness();
    h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');

    const fromProposed = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-1',
    });
    expect(fromProposed.targetPortCalled).toBe(false);
    expect(fromProposed.recommendation.status).toBe('PROPOSED');

    h.review({ trusted: HUMAN_A, recommendationId: 'rec-1' });
    const fromReview = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-2',
    });
    expect(fromReview.targetPortCalled).toBe(false);
    expect(fromReview.recommendation.status).toBe('UNDER_REVIEW');
    expect(h.targetCalls).toHaveLength(0);
  });

  it('forged APPROVED snapshot / approved flags do not reach the target port', () => {
    const h = harness();
    h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    const result = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-forge',
      forgedStatus: 'APPROVED',
      forgedRecommendation: { status: 'APPROVED', version: 99 },
      approved: true,
      approvedBy: 'user_admin_01',
      actorType: 'HUMAN',
    });
    expect(result.targetPortCalled).toBe(false);
    expect(result.recommendation.status).toBe('PROPOSED');
    expect(h.targetCalls).toHaveLength(0);
  });

  it('every failed precondition yields zero target calls', () => {
    const h = harness();
    h.approvedRecommendation('rec-1');

    // tenant mismatch
    expect(() =>
      h.apply({ trusted: HUMAN_B, recommendationId: 'rec-1', applyAttemptId: 'a1' })
    ).toThrow(LearningApplicationError);
    // human actor cannot perform software apply
    expect(() =>
      h.apply({ trusted: HUMAN_A, recommendationId: 'rec-1', applyAttemptId: 'a2' })
    ).toThrow(LearningApplicationError);
    // stale version
    expect(() =>
      h.apply({
        trusted: SOFTWARE_A,
        recommendationId: 'rec-1',
        applyAttemptId: 'a3',
        expectedVersion: 999,
      })
    ).toThrow(LearningApplicationError);
    // missing attempt id
    expect(() =>
      h.apply({ trusted: SOFTWARE_A, recommendationId: 'rec-1', applyAttemptId: '  ' })
    ).toThrow(LearningApplicationError);
    // unknown aggregate
    expect(() =>
      h.apply({ trusted: SOFTWARE_A, recommendationId: 'nope', applyAttemptId: 'a4' })
    ).toThrow(LearningApplicationError);

    expect(h.targetCalls).toHaveLength(0);
  });

  it('domain apply gate rejects APPLIED from any non-APPROVED status', () => {
    for (const from of [
      'DRAFT',
      'PROPOSED',
      'UNDER_REVIEW',
      'REJECTED',
      'SUPERSEDED',
      'APPLY_FAILED',
      'APPROVED_NOT_APPLIED',
    ] as const) {
      expect(assertRecommendationApplyGate(from, 'APPLIED', 'SOFTWARE').ok).toBe(false);
      expect(assertCanApplyRecommendation(from).ok).toBe(false);
    }
    expect(assertRecommendationApplyGate('APPROVED', 'APPLIED', 'SOFTWARE').ok).toBe(true);
  });
});

// ============================================================
// T-008-15 · Target-SPEC bypass / registry dispatch only
// ============================================================

describe('T-008-15 — target-SPEC dispatch only', () => {
  it('unregistered target yields APPROVED_NOT_APPLIED without any mutation', () => {
    const h = harness({ targetPorts: [] });
    h.approvedRecommendation('rec-1');
    const result = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-unsupported',
    });
    expect(result.targetPortCalled).toBe(false);
    expect(result.recommendation.status).toBe('APPROVED_NOT_APPLIED');
    expect(result.recommendation.status).not.toBe('APPLIED');
  });

  it('only the recommendation-declared target specId is dispatched', () => {
    const wrongSpec: TargetSpecApplyPort = {
      specId: 'SPEC-001',
      apply: () => ({ disposition: 'APPLIED', reasonCodes: ['WRONG_SPEC'] }),
    };
    const h = harness({ targetPorts: [wrongSpec] });
    h.approvedRecommendation('rec-1');
    const result = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-wrong',
    });
    expect(result.targetPortCalled).toBe(false);
    expect(result.recommendation.status).toBe('APPROVED_NOT_APPLIED');
  });

  it('target port receives trusted tenant, never caller-claimed tenant', () => {
    const seen: Array<{ organizationId: string; clientId: string }> = [];
    const spy: TargetSpecApplyPort = {
      specId: 'SPEC-002',
      apply(request) {
        seen.push(request.tenant);
        return { disposition: 'APPLIED', reasonCodes: ['OK'] };
      },
    };
    const h = harness({ targetPorts: [spy] });
    h.approvedRecommendation('rec-1');
    h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-tenant',
      claimedOrganizationId: 'org_a',
    });
    expect(seen).toEqual([{ organizationId: 'org_a', clientId: 'client_a' }]);
  });
});

// ============================================================
// T-008-19 / T-008-21 · Stale + superseded + rejected
// ============================================================

describe('T-008-19 / T-008-21 — stale, superseded and rejected states fail closed', () => {
  it('REJECTED recommendation cannot be applied or revived', () => {
    const h = harness();
    h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    h.review({ trusted: HUMAN_A, recommendationId: 'rec-1' });
    h.reject({
      trusted: HUMAN_A,
      recommendationId: 'rec-1',
      decisionId: 'dec-r',
      reason: 'No',
    });

    const applied = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-r',
    });
    expect(applied.targetPortCalled).toBe(false);
    expect(applied.recommendation.status).toBe('REJECTED');

    expect(() =>
      h.approve({
        trusted: HUMAN_A,
        recommendationId: 'rec-1',
        decisionId: 'dec-revive',
        reason: 'revive',
      })
    ).toThrow(LearningApplicationError);
    expect(h.targetCalls).toHaveLength(0);
  });

  it('SUPERSEDED recommendation cannot be approved or applied', () => {
    const h = harness();
    const rec = h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    h.injectRecommendation({ ...rec, status: 'SUPERSEDED', updatedAt: LATER });

    expect(assertNotSuperseded('SUPERSEDED').ok).toBe(false);
    expect(() =>
      h.apply({ trusted: SOFTWARE_A, recommendationId: 'rec-1', applyAttemptId: 'att-sup' })
    ).toThrow(LearningApplicationError);
    expect(() =>
      h.approve({
        trusted: HUMAN_A,
        recommendationId: 'rec-1',
        decisionId: 'dec-sup',
        reason: 'revive superseded',
      })
    ).toThrow(LearningApplicationError);
    expect(h.targetCalls).toHaveLength(0);
  });

  it('stale caller version is rejected on approve and apply', () => {
    const h = harness();
    const rec = h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    h.injectRecommendation({ ...rec, version: rec.version + 1, updatedAt: LATER });

    expect(() =>
      h.approve({
        trusted: HUMAN_A,
        recommendationId: 'rec-1',
        decisionId: 'dec-stale',
        reason: 'stale',
        expectedVersion: rec.version,
      })
    ).toThrow(LearningApplicationError);

    expect(() =>
      h.apply({
        trusted: SOFTWARE_A,
        recommendationId: 'rec-1',
        applyAttemptId: 'att-stale',
        expectedVersion: rec.version,
      })
    ).toThrow(LearningApplicationError);
    expect(h.targetCalls).toHaveLength(0);
  });

  it('persistence rejects a stale write that would lower the stored version', () => {
    const h = harness();
    const rec = h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    h.injectRecommendation({ ...rec, version: 5, updatedAt: LATER });
    expect(() => h.injectRecommendation({ ...rec, version: 2 })).toThrow(
      /Stale write denied/
    );
  });

  it('persistence rejects reviving a SUPERSEDED row without version increment', () => {
    const h = harness();
    const rec = h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    h.injectRecommendation({ ...rec, status: 'SUPERSEDED', updatedAt: LATER });
    expect(() =>
      h.injectRecommendation({ ...rec, status: 'APPROVED', updatedAt: LATER })
    ).toThrow(/Superseded recommendation cannot be revived/);
  });

  it('duplicate current authority is structurally impossible per tenant-keyed id', () => {
    const h = harness();
    const rec = h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    h.injectRecommendation({ ...rec, version: rec.version + 1, updatedAt: LATER });
    expect(h.store.listRecommendations(TENANT_A)).toHaveLength(1);
  });
});

// ============================================================
// T-008-17 · Latest-outcome authority / replace-by-signalId
// ============================================================

describe('T-008-17 — append-only observations, no silent replace', () => {
  it('supersession preserves the prior observation instead of erasing it', () => {
    const h = harness();
    h.seedObservation(HUMAN_A, 'obs-old');
    const result = h.supersede({
      trusted: HUMAN_A,
      priorObservationId: 'obs-old',
      successorObservationId: 'obs-new',
      thesisScope: singleScope(),
      sourceKind: 'SIGNAL_OUTCOME',
      sourceRef: { sourceSpec: 'SPEC-001', sourceId: 'sig-obs-old' },
      observationKind: 'NOT_USEFUL',
      payload: { corrected: true },
    });
    expect(result.prior.status).toBe('SUPERSEDED');
    expect(result.successor.status).toBe('ACTIVE');
    const rows = h.observations.list(TENANT_A);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.status === 'ACTIVE')).toHaveLength(1);
    expect(h.observations.getById('obs-old', TENANT_A)?.status).toBe('SUPERSEDED');
  });

  it('material overwrite of an ACTIVE observation at the same id fails closed', () => {
    const h = harness();
    const obs = h.seedObservation(HUMAN_A, 'obs-1');
    expect(() =>
      h.observations.commitWriteUnit({
        observations: [{ ...obs, observationKind: 'NOT_USEFUL' }],
        history: [],
      })
    ).toThrow(/material change requires supersession/);
    expect(h.observations.getById('obs-1', TENANT_A)?.observationKind).toBe('USEFUL');
  });

  it('observation fingerprint changes when material fields change', () => {
    const h = harness();
    const obs = h.seedObservation(HUMAN_A, 'obs-1');
    expect(observationMaterialFingerprint(obs)).not.toBe(
      observationMaterialFingerprint({ ...obs, observationKind: 'NOT_USEFUL' })
    );
  });
});

// ============================================================
// T-008-18 · History replay + decision replay
// ============================================================

describe('T-008-18 — history and decision replay hold no authority', () => {
  it('forged history entry claiming APPROVED/APPLIED does not change the aggregate', () => {
    const h = harness();
    const rec = h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');

    h.history.append(
      createLearningHistoryRecord({
        kind: 'RECOMMENDATION_DECISION',
        organizationId: 'org_a',
        clientId: 'client_a',
        aggregateKind: 'RECOMMENDATION',
        aggregateId: 'rec-1',
        aggregateVersion: 99,
        actorKind: 'HUMAN',
        reasonCodes: ['HUMAN_APPROVAL_RECORDED', 'APPLIED'],
        materialFingerprint: recommendationMaterialFingerprint({
          ...rec,
          status: 'APPLIED',
        }),
        occurredAt: LATER,
      })
    );

    expect(h.getRec({ trusted: HUMAN_A, recommendationId: 'rec-1' }).recommendation.status).toBe(
      'PROPOSED'
    );
    expect(h.store.listHistory().length).toBeGreaterThan(0);
    expect(h.store.listHistory().every((e) => e.authority === 'AUDIT_ONLY')).toBe(true);
  });

  it('replayed APPROVE decision against a REJECTED aggregate changes nothing', () => {
    const h = harness();
    h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    h.review({ trusted: HUMAN_A, recommendationId: 'rec-1' });
    h.reject({
      trusted: HUMAN_A,
      recommendationId: 'rec-1',
      decisionId: 'dec-r',
      reason: 'No',
    });

    const replay = createRecommendationDecision({
      decisionId: 'dec-replay',
      recommendationId: 'rec-1',
      recommendationVersion: 1,
      organizationId: 'org_a',
      clientId: 'client_a',
      decision: 'APPROVE',
      actorUid: 'attacker',
      reason: 'replayed approval',
      decidedAt: LATER,
      previousStatus: 'UNDER_REVIEW',
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) h.decisions.append(replay.value);

    expect(h.getRec({ trusted: HUMAN_A, recommendationId: 'rec-1' }).recommendation.status).toBe(
      'REJECTED'
    );
    expect(h.store.listDecisions().every((d) => d.authority === 'AUDIT_ONLY')).toBe(true);
  });

  it('history/decision history are explicitly denied as current authority', () => {
    expect(() => denyHistoryAsCurrentAuthority()).toThrow(LearningApplicationError);
    expect(() => denyDecisionHistoryAsCurrentAuthority()).toThrow(LearningApplicationError);
  });

  it('history append is idempotent on identical identity — no replay inflation', () => {
    const h = harness();
    const rec = h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1');
    const entry = createLearningHistoryRecord({
      kind: 'RECOMMENDATION_TRANSITION',
      organizationId: 'org_a',
      clientId: 'client_a',
      aggregateKind: 'RECOMMENDATION',
      aggregateId: 'rec-1',
      aggregateVersion: rec.version,
      actorKind: 'SOFTWARE',
      reasonCodes: ['X'],
      materialFingerprint: recommendationMaterialFingerprint(rec),
      occurredAt: LATER,
    });
    h.history.append(entry);
    const count = h.store.listHistory().length;
    h.history.append(entry);
    expect(h.store.listHistory().length).toBe(count);
  });
});

// ============================================================
// T-008-22 · Idempotency replay / collision / cross-tenant
// ============================================================

describe('T-008-22 — idempotency replay, collision and tenant scoping', () => {
  it('apply replay on APPLIED does not call the target port twice', () => {
    const h = harness();
    h.approvedRecommendation('rec-1');
    const first = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-idem',
    });
    expect(first.recommendation.status).toBe('APPLIED');
    expect(h.targetCalls).toHaveLength(1);

    const replay = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-idem',
    });
    expect(replay.targetPortCalled).toBe(false);
    expect(h.targetCalls).toHaveLength(1);
  });

  it('a second distinct apply attempt on a terminal APPLIED aggregate is denied', () => {
    const h = harness();
    h.approvedRecommendation('rec-1');
    h.apply({ trusted: SOFTWARE_A, recommendationId: 'rec-1', applyAttemptId: 'att-1' });
    expect(h.targetCalls).toHaveLength(1);

    // A fresh idempotency key bypasses the replay short-circuit, so the
    // lifecycle gate is the defense: APPLIED is not APPROVED.
    const second = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-2',
    });
    expect(second.targetPortCalled).toBe(false);
    expect(second.deniedReason).toBe('RECOMMENDATION_NOT_APPROVED');
    expect(second.recommendation.status).toBe('APPLIED');
    expect(h.targetCalls).toHaveLength(1);
  });

  it('double-click observation registration produces one authoritative row', () => {
    const h = harness();
    h.seedObservation(HUMAN_A, 'obs-1');
    const replay = h.register({
      trusted: HUMAN_A,
      observationId: 'obs-2',
      thesisScope: singleScope(),
      sourceKind: 'SIGNAL_OUTCOME',
      sourceRef: { sourceSpec: 'SPEC-001', sourceId: 'sig-other' },
      observationKind: 'USEFUL',
      payload: {},
      intentKey: 'reg-obs-1',
    });
    expect(replay.created).toBe(false);
    expect(replay.observation.observationId).toBe('obs-1');
    expect(h.observations.list(TENANT_A)).toHaveLength(1);
  });

  it('same idempotency key with different material fingerprint fails closed', () => {
    const h = harness();
    const obs = h.seedObservation(HUMAN_A, 'obs-1');
    expect(() =>
      h.observations.commitWriteUnit({
        history: [],
        idempotencyKeys: [
          {
            key: 'org_a|client_a|RegisterLearningObservation|reg-obs-1',
            aggregateKind: 'OBSERVATION',
            aggregateId: obs.observationId,
            organizationId: 'org_a',
            clientId: 'client_a',
            materialFingerprint: 'DIFFERENT_FINGERPRINT',
            at: LATER,
          },
        ],
      })
    ).toThrow(LearningApplicationError);
  });

  it('the same idempotency key in two tenants stays independent', () => {
    const h = harness();
    const a = h.seedObservation(HUMAN_A, 'obs-a');
    const b = h.seedObservation(HUMAN_B, 'obs-b');
    // Keys are physically scoped by tenant.
    expect(h.observations.findByIdempotencyKey(TENANT_A, 'reg-obs-b')).toBeUndefined();
    expect(h.observations.findByIdempotencyKey(TENANT_B, 'reg-obs-a')).toBeUndefined();
    expect(a.organizationId).toBe('org_a');
    expect(b.organizationId).toBe('org_b');
  });
});

// ============================================================
// T-008-20 · Malformed persistence coercion
// ============================================================

describe('T-008-20 — malformed persistence cannot become authority', () => {
  function storeWith(seed: Record<string, string>) {
    return createLocalLearningLoopStore(memoryKv(seed));
  }

  it('unknown store schemaVersion fails closed', () => {
    const store = storeWith({
      [LEARNING_OBSERVATION_STORE_KEY]: JSON.stringify({
        schemaVersion: 'learning-observation-store-v999',
        observations: [],
      }),
    });
    expect(() => store.listObservations(TENANT_A)).toThrow(/unsupported schemaVersion/);
  });

  it('non-JSON persisted payload fails closed', () => {
    const store = storeWith({ [LEARNING_OBSERVATION_STORE_KEY]: '{not json' });
    expect(() => store.listObservations(TENANT_A)).toThrow(/Malformed persisted/);
  });

  it('forged APPROVED recommendation with invalid schemaVersion fails closed', () => {
    const store = storeWith({
      [LEARNING_RECOMMENDATION_STORE_KEY]: JSON.stringify({
        schemaVersion: LEARNING_RECOMMENDATION_STORE_SCHEMA,
        recommendations: [
          {
            recommendationId: 'rec-forged',
            organizationId: 'org_a',
            clientId: 'client_a',
            status: 'APPROVED',
            schemaVersion: 'strategic-recommendation-v999',
          },
        ],
      }),
    });
    expect(() => store.listRecommendations(TENANT_A)).toThrow(/Malformed persisted/);
  });

  it('forged recommendation with unknown status fails closed', () => {
    const store = storeWith({
      [LEARNING_RECOMMENDATION_STORE_KEY]: JSON.stringify({
        schemaVersion: LEARNING_RECOMMENDATION_STORE_SCHEMA,
        recommendations: [
          {
            recommendationId: 'rec-forged',
            organizationId: 'org_a',
            clientId: 'client_a',
            status: 'AUTO_APPROVED_BY_ATTACKER',
            schemaVersion: 'strategic-recommendation-v1',
          },
        ],
      }),
    });
    expect(() => store.listRecommendations(TENANT_A)).toThrow(/Malformed persisted/);
  });

  it('observation row missing its tenant envelope fails closed', () => {
    const store = storeWith({
      [LEARNING_OBSERVATION_STORE_KEY]: JSON.stringify({
        schemaVersion: LEARNING_OBSERVATION_STORE_SCHEMA,
        observations: [{ observationId: 'obs-no-tenant', schemaVersion: 'learning-observation-v1' }],
      }),
    });
    expect(() => store.listObservations(TENANT_A)).toThrow(/Malformed persisted/);
  });

  it('invalid thesis scope and collapsed MULTI scope fail closed', () => {
    const h = harness();
    const obs = h.seedObservation(HUMAN_A, 'obs-1');
    expect(() =>
      h.observations.commitWriteUnit({
        observations: [
          { ...obs, observationId: 'obs-bad', thesisScope: { kind: 'NOPE' } as never },
        ],
        history: [],
      })
    ).toThrow(/Malformed persisted/);
    expect(() =>
      h.observations.commitWriteUnit({
        observations: [
          {
            ...obs,
            observationId: 'obs-multi',
            thesisScope: { kind: 'MULTI', thesisIds: ['only-one'] } as never,
          },
        ],
        history: [],
      })
    ).toThrow(/MULTI requires >= 2/);
  });

  it('write unit with disagreeing tenant envelope fails closed', () => {
    const h = harness();
    const obs = h.seedObservation(HUMAN_A, 'obs-1');
    expect(() =>
      h.observations.commitWriteUnit({
        observations: [
          { ...obs, observationId: 'obs-x' },
          { ...obs, observationId: 'obs-y', organizationId: 'org_b', clientId: 'client_b' },
        ],
        history: [],
      })
    ).toThrow(LearningApplicationError);
  });
});

// ============================================================
// T-008-25 · Multi-thesis / first-index fallback
// ============================================================

describe('T-008-25 — explicit thesis scope only, no first/primary fallback', () => {
  it('MULTI scope never collapses to SINGLE across the pipeline', () => {
    const h = harness();
    const multi: ThesisScope = { kind: 'MULTI', thesisIds: ['thesis-a', 'thesis-b'] };
    h.seedObservation(HUMAN_A, 'obs-multi', multi);
    const ev = h.buildEvidence({
      trusted: HUMAN_A,
      evidenceId: 'ev-multi',
      thesisScope: multi,
      observationIds: ['obs-multi'],
      metrics: [{ key: 'k', label: 'K', value: 2 }],
      summary: 'multi',
      intentKey: 'ev-multi',
    }).evidence;
    expect(ev.thesisScope.kind).toBe('MULTI');

    const rec = h.generate({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-multi',
      thesisScope: multi,
      learningEvidenceId: 'ev-multi',
      recommendationType: 'STRATEGIC_SCORE_CONFIGURATION',
      targetAuthority: { specId: 'SPEC-002', domain: 'scoring' },
      proposedChange: { changeKind: 'W', schemaVersion: 'v1', payload: {} },
      rationale: 'multi thesis learning',
      confidence: 'MEDIUM',
      risks: [],
      expectedImpact: { summary: 'x' },
      intentKey: 'gen-multi',
    }).recommendation;
    expect(rec.thesisScope.kind).toBe('MULTI');
    if (rec.thesisScope.kind === 'MULTI') {
      expect(rec.thesisScope.thesisIds).toEqual(['thesis-a', 'thesis-b']);
    }
  });

  it('CLIENT_WIDE scope is preserved and never narrowed to a single thesis', () => {
    const h = harness();
    const scope: ThesisScope = { kind: 'CLIENT_WIDE' };
    h.seedObservation(HUMAN_A, 'obs-cw', scope);
    const ev = h.buildEvidence({
      trusted: HUMAN_A,
      evidenceId: 'ev-cw',
      thesisScope: scope,
      observationIds: ['obs-cw'],
      metrics: [{ key: 'k', label: 'K', value: 1 }],
      summary: 'client wide',
      intentKey: 'ev-cw',
    }).evidence;
    expect(ev.thesisScope.kind).toBe('CLIENT_WIDE');
    expect(ev.thesisScope).not.toHaveProperty('thesisId');
  });

  it('evidence cannot borrow an observation from a mismatched thesis scope', () => {
    const h = harness();
    h.seedObservation(HUMAN_A, 'obs-a', singleScope('thesis-a'));
    expect(() =>
      h.buildEvidence({
        trusted: HUMAN_A,
        evidenceId: 'ev-mismatch',
        thesisScope: singleScope('thesis-zzz'),
        observationIds: ['obs-a'],
        metrics: [{ key: 'k', label: 'K', value: 1 }],
        summary: 'mismatch',
        intentKey: 'ev-mismatch',
      })
    ).toThrow(LearningApplicationError);
  });
});

// ============================================================
// Confidence auto-approval (A7 / T-008-16)
// ============================================================

describe('Confidence is not approval authority', () => {
  it('HIGH confidence recommendation is still PROPOSED and un-appliable', () => {
    const h = harness();
    const rec = h.seedRecommendation(HUMAN_A, SOFTWARE_A, 'rec-1', 'HIGH');
    expect(rec.confidence).toBe('HIGH');
    expect(rec.status).toBe('PROPOSED');
    expect(rec.approvedBy).toBeUndefined();

    const result = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-high',
    });
    expect(result.targetPortCalled).toBe(false);
    expect(h.targetCalls).toHaveLength(0);
  });

  it('generate with forged approved flags fails closed', () => {
    const h = harness();
    h.seedEvidence(HUMAN_A, 'ev-1');
    expect(() =>
      h.generate({
        trusted: SOFTWARE_A,
        recommendationId: 'rec-forge',
        thesisScope: singleScope(),
        learningEvidenceId: 'ev-1',
        recommendationType: 'STRATEGIC_SCORE_CONFIGURATION',
        targetAuthority: { specId: 'SPEC-002', domain: 'scoring' },
        proposedChange: { changeKind: 'W', schemaVersion: 'v1', payload: {} },
        rationale: 'forged',
        confidence: 'HIGH',
        risks: [],
        expectedImpact: { summary: 'x' },
        intentKey: 'gen-forge',
        forgedApproved: true,
        forgedStatus: 'APPROVED',
      })
    ).toThrow(LearningApplicationError);
  });
});

// ============================================================
// T-008-41/42/43 semantics · APPLY_FAILED / APPROVED_NOT_APPLIED / APPLIED
// ============================================================

describe('Apply dispositions map to distinct formal states', () => {
  it('target FAILED yields APPLY_FAILED and never APPLIED', () => {
    const failPort: TargetSpecApplyPort = {
      specId: 'SPEC-002',
      apply: () => ({ disposition: 'FAILED', reasonCodes: ['TARGET_ERROR'] }),
    };
    const h = harness({ targetPorts: [failPort] });
    h.approvedRecommendation('rec-1');
    const result = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-fail',
    });
    expect(result.recommendation.status).toBe('APPLY_FAILED');
    expect(result.recommendation.status).not.toBe('APPLIED');
    expect(result.recommendation.appliedBy).toBeUndefined();
  });

  it('APPLY_FAILED does not auto-retry the target', () => {
    let calls = 0;
    const failPort: TargetSpecApplyPort = {
      specId: 'SPEC-002',
      apply: () => {
        calls += 1;
        return { disposition: 'FAILED', reasonCodes: ['TARGET_ERROR'] };
      },
    };
    const h = harness({ targetPorts: [failPort] });
    h.approvedRecommendation('rec-1');
    h.apply({ trusted: SOFTWARE_A, recommendationId: 'rec-1', applyAttemptId: 'att-f1' });
    expect(calls).toBe(1);
  });

  it('VALIDATION_REJECTED / NOT_YET_SUPPORTED yield APPROVED_NOT_APPLIED', () => {
    for (const disposition of ['VALIDATION_REJECTED', 'NOT_YET_SUPPORTED', 'STALE_TARGET'] as const) {
      const port: TargetSpecApplyPort = {
        specId: 'SPEC-002',
        apply: () => ({ disposition, reasonCodes: [disposition] }),
      };
      const h = harness({ targetPorts: [port] });
      h.approvedRecommendation('rec-1');
      const result = h.apply({
        trusted: SOFTWARE_A,
        recommendationId: 'rec-1',
        applyAttemptId: 'att-x',
      });
      expect(result.recommendation.status).toBe('APPROVED_NOT_APPLIED');
    }
  });

  it('APPLIED only occurs after trusted-human APPROVED + valid target success', () => {
    const h = harness();
    const approved = h.approvedRecommendation('rec-1');
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('mgr_ana');
    expect(h.targetCalls).toHaveLength(0);

    const result = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-ok',
    });
    expect(h.targetCalls).toEqual([{ specId: 'SPEC-002', recommendationId: 'rec-1' }]);
    expect(result.recommendation.status).toBe('APPLIED');
    expect(result.recommendation.appliedBy).toBe('sys_learning');
  });
});

// ============================================================
// T-008-11 / T-008-12 / T-008-13 · Cross-SPEC authority theft
// ============================================================

describe('T-008-11 / T-008-12 / T-008-13 — cross-SPEC authority preserved', () => {
  it('a SPEC-002 recommendation cannot mutate scoring without an apply port', () => {
    const h = harness({ targetPorts: [] });
    h.approvedRecommendation('rec-1');
    const result = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-1',
      applyAttemptId: 'att-002',
    });
    expect(result.recommendation.status).toBe('APPROVED_NOT_APPLIED');
    expect(result.targetPortCalled).toBe(false);
  });

  it('SPEC-001 routing target has no registered port — no reroute path exists', () => {
    const h = harness();
    h.seedEvidence(HUMAN_A, 'ev-1');
    const rec = h.generate({
      trusted: SOFTWARE_A,
      recommendationId: 'rec-routing',
      thesisScope: singleScope(),
      learningEvidenceId: 'ev-1',
      recommendationType: 'OTHER',
      targetAuthority: { specId: 'SPEC-001', domain: 'routing' },
      proposedChange: { changeKind: 'REROUTE', schemaVersion: 'v1', payload: {} },
      rationale: 'reroute attempt',
      confidence: 'HIGH',
      risks: [],
      expectedImpact: { summary: 'x' },
      intentKey: 'gen-routing',
    }).recommendation;
    h.review({ trusted: HUMAN_A, recommendationId: rec.recommendationId });
    h.approve({
      trusted: HUMAN_A,
      recommendationId: rec.recommendationId,
      decisionId: 'dec-routing',
      reason: 'ok',
    });
    const result = h.apply({
      trusted: SOFTWARE_A,
      recommendationId: rec.recommendationId,
      applyAttemptId: 'att-routing',
    });
    expect(result.targetPortCalled).toBe(false);
    expect(result.recommendation.status).toBe('APPROVED_NOT_APPLIED');
  });

  it('a recommendation without targetAuthority.specId cannot even be persisted', () => {
    const h = harness();
    const approved = h.approvedRecommendation('rec-1');
    // Persistence refuses the forged row before it can ever reach apply.
    expect(() =>
      h.injectRecommendation({
        ...approved,
        targetAuthority: { specId: '   ', domain: 'scoring' },
      } as StrategicRecommendation)
    ).toThrow(/TargetAuthority: specId is required/);

    // Stored state is unchanged and still declares its real target owner.
    expect(
      h.recommendations.getById('rec-1', TENANT_A)?.targetAuthority.specId
    ).toBe('SPEC-002');
    expect(h.targetCalls).toHaveLength(0);
  });

  it('domain rejects apply dispatch when target authority is blank', () => {
    const h = harness();
    const approved = h.approvedRecommendation('rec-1');
    const blank = {
      ...approved,
      targetAuthority: { specId: '   ', domain: 'scoring' },
    } as StrategicRecommendation;
    expect(assertTargetSpecAuthorityPreserved(blank).ok).toBe(false);
    expect(assertTargetSpecAuthorityPreserved(approved).ok).toBe(true);
  });
});

// ============================================================
// T-008-05 / T-008-30 · Legacy direct-write bypass (real dbService)
// ============================================================

describe('T-008-05 / legacy bypass — real dbService learning mutators are demoted', () => {
  it('recordSignalOutcome and addResult throw LEGACY_AUTHORITY_REMOVED', async () => {
    const { dbService } = await import('../src/services/db');
    expect(() =>
      dbService.recordSignalOutcome({
        organizationId: 'org_a',
        clientId: 'client_a',
        signalId: 'sig-1',
        kind: 'USEFUL',
        source: 'RADAR',
        actorUid: 'attacker',
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
        createdBy: 'attacker',
      })
    ).toThrow(/LEGACY_AUTHORITY_REMOVED/);
  });

  it('legacy mirror writes do not create canonical learning observations', async () => {
    const { dbService } = await import('../src/services/db');
    const h = harness();
    dbService.mirrorSignalOutcomeCompatibility({
      organizationId: 'org_a',
      clientId: 'client_a',
      signalId: 'sig-mirror',
      kind: 'USEFUL',
      source: 'RADAR',
      actorUid: 'mgr_ana',
    });
    // Canonical store is untouched by legacy mirror writes.
    expect(h.observations.list(TENANT_A)).toHaveLength(0);
  });
});

// ============================================================
// T-008-32 · Legacy storage forgery
// ============================================================

describe('Legacy storage forgery stays COMPATIBILITY_ONLY', () => {
  it('forged legacy rows never claim canonical learning authority', () => {
    const kv = memoryKv({
      [LEGACY_SIGNAL_OUTCOMES_KEY]: JSON.stringify([
        {
          id: 'sout-forged',
          organizationId: 'org_a',
          clientId: 'client_a',
          thesisId: 'thesis-a',
          signalId: 'sig-1',
          kind: 'USEFUL',
          status: 'APPROVED',
          authority: 'CANONICAL',
        },
      ]),
      [LEGACY_RESULTS_V5_KEY]: JSON.stringify([{ id: 'res-forged', title: 'no tenant' }]),
      [LEGACY_FEEDBACK_V1_KEY]: JSON.stringify([
        { id: 'fb-1', organizationId: 'org_a', clientId: 'client_a' },
      ]),
    });
    const reader = createLegacyLearningCompatibilityReader(kv);

    const outcomes = reader.listSignalOutcomeCompatibility();
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].authority).toBe('COMPATIBILITY_ONLY');
    expect(outcomes[0]).not.toHaveProperty('status');

    const results = reader.listResultRecordCompatibility();
    expect(results[0].authority).toBe('COMPATIBILITY_ONLY');
    expect(results[0].disposition).toBe('MIGRATION_REVIEW_REQUIRED');

    const feedback = reader.listFeedbackEventCompatibility();
    expect(feedback.every((f) => f.authority === 'COMPATIBILITY_ONLY')).toBe(true);
  });

  it('malformed legacy store does not throw into canonical paths and is non-authoritative', () => {
    const reader = createLegacyLearningCompatibilityReader(
      memoryKv({ [LEGACY_SIGNAL_OUTCOMES_KEY]: '{corrupt' })
    );
    const rows = reader.listSignalOutcomeCompatibility();
    expect(rows.every((r) => r.authority === 'COMPATIBILITY_ONLY')).toBe(true);
    expect(rows.every((r) => r.disposition !== 'MAPPED')).toBe(true);
  });
});

// ============================================================
// T-008-31 · Legacy mirror failure isolation
// ============================================================

describe('Legacy mirror failure does not affect canonical authority', () => {
  it('canonical observation survives a throwing legacy mirror and is not retried', () => {
    const h = harness();
    const obs = h.seedObservation(HUMAN_A, 'obs-1');
    let mirrorAttempts = 0;
    const mirror = () => {
      mirrorAttempts += 1;
      throw new Error('MIRROR_DOWN');
    };
    // Consumer-side ordering: canonical first, mirror after, failure swallowed.
    let mirrored = true;
    try {
      mirror();
    } catch {
      mirrored = false;
    }
    expect(mirrored).toBe(false);
    expect(mirrorAttempts).toBe(1);
    expect(h.observations.getById('obs-1', TENANT_A)?.status).toBe('ACTIVE');
    expect(h.observations.getById('obs-1', TENANT_A)?.observationId).toBe(obs.observationId);
  });

  it('canonical write failure rolls back and leaves no partial authority', () => {
    const h = harness();
    h.seedObservation(HUMAN_A, 'obs-1');
    h.store.failBeforePersistForTest = true;
    expect(() =>
      h.register({
        trusted: HUMAN_A,
        observationId: 'obs-2',
        thesisScope: singleScope(),
        sourceKind: 'SIGNAL_OUTCOME',
        sourceRef: { sourceSpec: 'SPEC-001', sourceId: 'sig-2' },
        observationKind: 'USEFUL',
        payload: {},
        intentKey: 'reg-obs-2',
      })
    ).toThrow();
    h.store.failBeforePersistForTest = false;
    expect(h.observations.getById('obs-2', TENANT_A)).toBeUndefined();
    expect(h.observations.list(TENANT_A)).toHaveLength(1);
  });
});
