/**
 * SPEC-008 Phase 3 — Persistence / infrastructure tests (T-008-301…308).
 */

import { describe, expect, it } from 'vitest';
import { LearningApplicationError } from '../src/application/learningLoop/errors';
import type { LearningWriteUnit } from '../src/application/learningLoop/ports/LearningTenantScope';
import { createLearningHistoryRecord } from '../src/domain/learningMaterialityCore';
import type { LearningObservation } from '../src/domain/learningObservationCore';
import type { StrategicRecommendation } from '../src/domain/strategicRecommendationCore';
import type { RecommendationDecision } from '../src/domain/recommendationDecisionCore';
import {
  createLegacyLearningCompatibilityReader,
  createLocalLearningLoopStore,
  LEGACY_RESULTS_V5_KEY,
  LEGACY_SIGNAL_OUTCOMES_KEY,
  LocalLearningEvidenceRepository,
  LocalLearningHistoryAdapter,
  LocalLearningObservationRepository,
  LocalRecommendationDecisionAdapter,
  LocalStrategicRecommendationRepository,
  parseStoredObservation,
  parseStoredRecommendation,
  tenantEntityKey,
  type StorageLike,
} from '../src/infrastructure/learningLoop';

const NOW = '2026-08-26T21:00:00.000Z';

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

function makeObservation(over: Partial<LearningObservation> = {}): LearningObservation {
  return {
    observationId: 'obs-1',
    organizationId: 'org_a',
    clientId: 'client_a',
    thesisScope: { kind: 'SINGLE', thesisId: 'thesis-a' },
    sourceKind: 'SIGNAL_OUTCOME',
    sourceRef: { sourceSpec: 'SPEC-001', sourceId: 'sig-1' },
    observationKind: 'USEFUL',
    payload: { signalId: 'sig-1' },
    actorUid: 'actor-1',
    recordedAt: NOW,
    schemaVersion: 'learning-observation-v1',
    status: 'ACTIVE',
    ...over,
  };
}

function makeRecommendation(
  over: Partial<StrategicRecommendation> = {}
): StrategicRecommendation {
  return {
    recommendationId: 'rec-1',
    organizationId: 'org_a',
    clientId: 'client_a',
    thesisScope: { kind: 'MULTI', thesisIds: ['thesis-a', 'thesis-b'] },
    sourceObservationIds: ['obs-1'],
    learningEvidenceId: 'ev-1',
    recommendationType: 'STRATEGIC_SCORE_CONFIGURATION',
    targetAuthority: { specId: 'SPEC-002', domain: 'scoring' },
    proposedChange: {
      changeKind: 'WEIGHT_ADJUSTMENT',
      schemaVersion: 'score-v1',
      payload: { delta: 0.05 },
    },
    rationale: 'Evidence supports change',
    confidence: 'HIGH',
    risks: ['overfit'],
    expectedImpact: { summary: 'Better fit' },
    status: 'PROPOSED',
    version: 1,
    schemaVersion: 'strategic-recommendation-v1',
    createdBy: 'sys',
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function harness() {
  const kv = memoryKv();
  const store = createLocalLearningLoopStore(kv);
  const observations = new LocalLearningObservationRepository(store);
  const evidence = new LocalLearningEvidenceRepository(store);
  const recommendations = new LocalStrategicRecommendationRepository(store);
  const history = new LocalLearningHistoryAdapter(store);
  const decisions = new LocalRecommendationDecisionAdapter(store);
  return { kv, store, observations, evidence, recommendations, history, decisions };
}

describe('SPEC-008 Phase 3 — Observation / Recommendation persistence (T-008-301/303)', () => {
  it('tenant-safe save/get/list with same-id cross-tenant isolation', () => {
    const h = harness();
    const a = makeObservation();
    const b = makeObservation({
      organizationId: 'org_b',
      clientId: 'client_b',
      thesisScope: { kind: 'SINGLE', thesisId: 'thesis-b' },
    });
    h.observations.commitWriteUnit({ observations: [a], history: [] });
    h.observations.commitWriteUnit({ observations: [b], history: [] });

    expect(
      h.observations.getById('obs-1', { organizationId: 'org_a', clientId: 'client_a' })
        ?.organizationId
    ).toBe('org_a');
    expect(
      h.observations.getById('obs-1', { organizationId: 'org_b', clientId: 'client_b' })
        ?.organizationId
    ).toBe('org_b');
    expect(
      h.observations.getById('obs-1', { organizationId: 'org_a', clientId: 'client_x' })
    ).toBeUndefined();
    expect(tenantEntityKey('org_a', 'client_a', 'obs-1')).not.toBe(
      tenantEntityKey('org_b', 'client_b', 'obs-1')
    );

    const recA = makeRecommendation();
    const recB = makeRecommendation({
      organizationId: 'org_b',
      clientId: 'client_b',
      rationale: 'tenant B',
    });
    h.recommendations.commitWriteUnit({ recommendations: [recA], history: [] });
    h.recommendations.commitWriteUnit({ recommendations: [recB], history: [] });
    expect(
      h.recommendations.getById('rec-1', { organizationId: 'org_b', clientId: 'client_b' })
        ?.rationale
    ).toBe('tenant B');
  });

  it('preserves MULTI thesis and CLIENT_WIDE round-trip', () => {
    const h = harness();
    const multi = makeRecommendation({
      thesisScope: { kind: 'MULTI', thesisIds: ['thesis-a', 'thesis-b'] },
    });
    h.recommendations.commitWriteUnit({ recommendations: [multi], history: [] });
    const loaded = h.recommendations.getById('rec-1', {
      organizationId: 'org_a',
      clientId: 'client_a',
    })!;
    expect(loaded.thesisScope.kind).toBe('MULTI');
    if (loaded.thesisScope.kind === 'MULTI') {
      expect(loaded.thesisScope.thesisIds).toEqual(['thesis-a', 'thesis-b']);
    }

    const cw = makeObservation({
      observationId: 'obs-cw',
      thesisScope: { kind: 'CLIENT_WIDE' },
    });
    h.observations.commitWriteUnit({ observations: [cw], history: [] });
    const obs = h.observations.getById('obs-cw', {
      organizationId: 'org_a',
      clientId: 'client_a',
    })!;
    expect(obs.thesisScope.kind).toBe('CLIENT_WIDE');
  });

  it('preserves supersession — prior SUPERSEDED + successor ACTIVE', () => {
    const h = harness();
    const prior = makeObservation({ observationId: 'obs-old', status: 'SUPERSEDED' });
    const successor = makeObservation({
      observationId: 'obs-new',
      supersedesObservationId: 'obs-old',
      observationKind: 'NOT_USEFUL',
    });
    h.observations.commitWriteUnit({ observations: [prior, successor], history: [] });
    expect(
      h.observations.getById('obs-old', { organizationId: 'org_a', clientId: 'client_a' })
        ?.status
    ).toBe('SUPERSEDED');
    expect(
      h.observations.getById('obs-new', { organizationId: 'org_a', clientId: 'client_a' })
        ?.status
    ).toBe('ACTIVE');
  });
});

describe('SPEC-008 Phase 3 — schema / malformed fail-closed (T-008-306)', () => {
  it('unknown schemaVersion and malformed aggregates fail closed', () => {
    expect(() =>
      parseStoredObservation({
        ...makeObservation(),
        schemaVersion: 'future-v99',
      })
    ).toThrow(LearningApplicationError);

    expect(() =>
      parseStoredRecommendation({
        ...makeRecommendation(),
        status: 'NOT_A_STATUS',
      })
    ).toThrow(LearningApplicationError);

    const h = harness();
    h.kv.setItem(
      'postura_learning_recommendations_v1',
      JSON.stringify({ schemaVersion: 'unknown', recommendations: [] })
    );
    const store2 = createLocalLearningLoopStore(h.kv);
    expect(() =>
      store2.getRecommendation('rec-1', { organizationId: 'org_a', clientId: 'client_a' })
    ).toThrow(LearningApplicationError);
  });
});

describe('SPEC-008 Phase 3 — version / stale / duplicate (T-008-303)', () => {
  it('stale recommendation write denied; version advances', () => {
    const h = harness();
    h.recommendations.commitWriteUnit({
      recommendations: [makeRecommendation({ version: 2, status: 'UNDER_REVIEW' })],
      history: [],
    });
    expect(() =>
      h.recommendations.commitWriteUnit({
        recommendations: [makeRecommendation({ version: 1, status: 'APPROVED' })],
        history: [],
      })
    ).toThrow(LearningApplicationError);

    h.recommendations.commitWriteUnit({
      recommendations: [makeRecommendation({ version: 3, status: 'APPROVED' })],
      history: [],
    });
    expect(
      h.recommendations.getById('rec-1', { organizationId: 'org_a', clientId: 'client_a' })
        ?.status
    ).toBe('APPROVED');
  });

  it('immutable evidence per evidenceId — material change denied', () => {
    const h = harness();
    h.evidence.commitWriteUnit({
      evidence: [
        {
          evidenceId: 'ev-1',
          organizationId: 'org_a',
          clientId: 'client_a',
          thesisScope: { kind: 'SINGLE', thesisId: 'thesis-a' },
          observationIds: ['obs-1'],
          metrics: [{ key: 'k', label: 'K', value: 1 }],
          summary: 's',
          schemaVersion: 'learning-evidence-v1',
          builtAt: NOW,
        },
      ],
      history: [],
    });
    expect(() =>
      h.evidence.commitWriteUnit({
        evidence: [
          {
            evidenceId: 'ev-1',
            organizationId: 'org_a',
            clientId: 'client_a',
            thesisScope: { kind: 'SINGLE', thesisId: 'thesis-a' },
            observationIds: ['obs-1'],
            metrics: [{ key: 'k', label: 'K', value: 99 }],
            summary: 'changed',
            schemaVersion: 'learning-evidence-v1',
            builtAt: NOW,
          },
        ],
        history: [],
      })
    ).toThrow(LearningApplicationError);
  });
});

describe('SPEC-008 Phase 3 — history / decision / idempotency (T-008-304/305)', () => {
  it('history is append-only AUDIT_ONLY and never overrides current recommendation', () => {
    const h = harness();
    h.recommendations.commitWriteUnit({
      recommendations: [makeRecommendation({ status: 'APPROVED', version: 2 })],
      history: [
        createLearningHistoryRecord({
          kind: 'RECOMMENDATION_TRANSITION',
          organizationId: 'org_a',
          clientId: 'client_a',
          aggregateKind: 'RECOMMENDATION',
          aggregateId: 'rec-1',
          aggregateVersion: 2,
          actorKind: 'HUMAN',
          reasonCodes: ['HUMAN_APPROVAL_RECORDED'],
          materialFingerprint: 'fp',
          occurredAt: NOW,
        }),
      ],
    });
    h.history.append(
      createLearningHistoryRecord({
        kind: 'RECOMMENDATION_TRANSITION',
        organizationId: 'org_a',
        clientId: 'client_a',
        aggregateKind: 'RECOMMENDATION',
        aggregateId: 'rec-1',
        aggregateVersion: 99,
        actorKind: 'HUMAN',
        reasonCodes: ['FORGED_REJECT'],
        materialFingerprint: 'fp-reject',
        occurredAt: NOW,
      })
    );
    const current = h.recommendations.getById('rec-1', {
      organizationId: 'org_a',
      clientId: 'client_a',
    });
    expect(current?.status).toBe('APPROVED');
    expect(h.history.listForInspection().every((e) => e.authority === 'AUDIT_ONLY')).toBe(
      true
    );
  });

  it('decision append-only does not replace current recommendation authority', () => {
    const h = harness();
    h.recommendations.commitWriteUnit({
      recommendations: [makeRecommendation({ status: 'APPROVED', version: 2 })],
      history: [],
    });
    const decision: RecommendationDecision = {
      decisionId: 'dec-1',
      recommendationId: 'rec-1',
      recommendationVersion: 2,
      organizationId: 'org_a',
      clientId: 'client_a',
      decision: 'APPROVE',
      actorUid: 'mgr',
      reason: 'ok',
      decidedAt: NOW,
      previousStatus: 'UNDER_REVIEW',
      authority: 'AUDIT_ONLY',
    };
    h.decisions.append(decision);
    expect(
      h.recommendations.getById('rec-1', { organizationId: 'org_a', clientId: 'client_a' })
        ?.status
    ).toBe('APPROVED');
    expect(h.decisions.listForInspection()).toHaveLength(1);
  });

  it('idempotency replay same fingerprint; conflict on different fingerprint', () => {
    const h = harness();
    const unit: LearningWriteUnit = {
      observations: [makeObservation()],
      history: [],
      idempotencyKeys: [
        {
          key: 'idem-1',
          aggregateKind: 'OBSERVATION',
          aggregateId: 'obs-1',
          organizationId: 'org_a',
          clientId: 'client_a',
          materialFingerprint: 'fp-a',
          at: NOW,
        },
      ],
    };
    h.observations.commitWriteUnit(unit);
    expect(() =>
      h.observations.commitWriteUnit({
        history: [],
        idempotencyKeys: [
          {
            key: 'idem-1',
            aggregateKind: 'OBSERVATION',
            aggregateId: 'obs-1',
            organizationId: 'org_a',
            clientId: 'client_a',
            materialFingerprint: 'fp-b',
            at: NOW,
          },
        ],
      })
    ).toThrow(LearningApplicationError);

    h.observations.commitWriteUnit({
      history: [],
      idempotencyKeys: [
        {
          key: 'idem-1',
          aggregateKind: 'OBSERVATION',
          aggregateId: 'obs-1',
          organizationId: 'org_a',
          clientId: 'client_a',
          materialFingerprint: 'fp-a',
          at: NOW,
        },
      ],
    });
    expect(h.observations.findByIdempotencyKey(
      { organizationId: 'org_a', clientId: 'client_a' },
      'idem-1'
    )?.observationId).toBe('obs-1');
  });

  it('idempotency keys are tenant-isolated', () => {
    const h = harness();
    h.observations.commitWriteUnit({
      observations: [makeObservation()],
      history: [],
      idempotencyKeys: [
        {
          key: 'shared-key',
          aggregateKind: 'OBSERVATION',
          aggregateId: 'obs-1',
          organizationId: 'org_a',
          clientId: 'client_a',
          materialFingerprint: 'fp',
          at: NOW,
        },
      ],
    });
    h.observations.commitWriteUnit({
      observations: [
        makeObservation({
          observationId: 'obs-b',
          organizationId: 'org_b',
          clientId: 'client_b',
        }),
      ],
      history: [],
      idempotencyKeys: [
        {
          key: 'shared-key',
          aggregateKind: 'OBSERVATION',
          aggregateId: 'obs-b',
          organizationId: 'org_b',
          clientId: 'client_b',
          materialFingerprint: 'fp',
          at: NOW,
        },
      ],
    });
    expect(
      h.observations.findByIdempotencyKey(
        { organizationId: 'org_a', clientId: 'client_a' },
        'shared-key'
      )?.observationId
    ).toBe('obs-1');
    expect(
      h.observations.findByIdempotencyKey(
        { organizationId: 'org_b', clientId: 'client_b' },
        'shared-key'
      )?.observationId
    ).toBe('obs-b');
  });
});

describe('SPEC-008 Phase 3 — write coherence + reload (T-008-301…305)', () => {
  it('persists and reloads from kv with coherent write unit', () => {
    const kv = memoryKv();
    const store1 = createLocalLearningLoopStore(kv);
    const obs1 = new LocalLearningObservationRepository(store1);
    obs1.commitWriteUnit({ observations: [makeObservation()], history: [] });

    const store2 = createLocalLearningLoopStore(kv);
    const obs2 = new LocalLearningObservationRepository(store2);
    expect(
      obs2.getById('obs-1', { organizationId: 'org_a', clientId: 'client_a' })?.status
    ).toBe('ACTIVE');
  });

  it('rollback on persist failure restores prior state', () => {
    const h = harness();
    h.observations.commitWriteUnit({ observations: [makeObservation()], history: [] });
    h.store.failBeforePersistForTest = true;
    expect(() =>
      h.observations.commitWriteUnit({
        observations: [makeObservation({ observationId: 'obs-2' })],
        history: [],
      })
    ).toThrow(LearningApplicationError);
    expect(
      h.observations.getById('obs-2', { organizationId: 'org_a', clientId: 'client_a' })
    ).toBeUndefined();
    expect(
      h.observations.getById('obs-1', { organizationId: 'org_a', clientId: 'client_a' })
    ).toBeDefined();
  });
});

describe('SPEC-008 Phase 3 — legacy compatibility reader (T-008-307)', () => {
  it('reads legacy rows as COMPATIBILITY_ONLY; missing tenant → review required', () => {
    const kv = memoryKv();
    kv.setItem(
      LEGACY_SIGNAL_OUTCOMES_KEY,
      JSON.stringify([
        { signalId: 's1', organizationId: 'org_a', clientId: 'client_a', thesisId: 't1' },
        { signalId: 's2', status: 'USEFUL' },
      ])
    );
    kv.setItem(
      LEGACY_RESULTS_V5_KEY,
      JSON.stringify('not-an-array')
    );
    const reader = createLegacyLearningCompatibilityReader(kv);
    const signalRows = reader.listSignalOutcomeCompatibility();
    expect(signalRows[0].authority).toBe('COMPATIBILITY_ONLY');
    expect(signalRows[0].disposition).toBe('MAPPED');
    expect(signalRows[1].disposition).toBe('MIGRATION_REVIEW_REQUIRED');

    const resultRows = reader.listResultRecordCompatibility();
    expect(resultRows[0].disposition).toBe('SKIPPED_MALFORMED');
  });
});
