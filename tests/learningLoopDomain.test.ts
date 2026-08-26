/**
 * SPEC-008 Phase 1 — Domain unit tests (T-008-110).
 */

import { describe, expect, it } from 'vitest';
import {
  assertLearningStagesCannotAutoApply,
  assertConfidenceNotApprovalAuthority,
  assertHumanOnlyApproval,
  assertNoOpportunityLifecycleAuthority,
  assertNoRoutingMutationAuthority,
  assertNoStrategicScoreMutationAuthority,
  assertRecommendationApplyGate,
  assertTargetSpecAuthorityPreserved,
  transitionStrategicRecommendationStatus,
} from '../src/domain/learningAuthorityCore';
import {
  buildLearningAssessment,
  createLearningEvidence,
  assertObservationsCompatibleWithEvidence,
} from '../src/domain/learningEvidenceCore';
import {
  projectLearningEvidenceExplainability,
  projectStrategicRecommendationExplainability,
} from '../src/domain/learningExplainabilityCore';
import {
  assertHistoryIsNonAuthoritative,
  assertMaterialNotSilentlyOverwritten,
  assertVersionMonotonic,
  createLearningHistoryRecord,
  recommendationMaterialFingerprint,
} from '../src/domain/learningMaterialityCore';
import {
  createLearningObservation,
  markObservationSuperseded,
  resolveCurrentObservation,
  supersedeLearningObservation,
} from '../src/domain/learningObservationCore';
import {
  createRecommendationDecision,
  assertDecisionDoesNotApply,
} from '../src/domain/recommendationDecisionCore';
import {
  assertCanApplyRecommendation,
  assertNotSuperseded,
  assertRecommendationTransition,
  HUMAN_REQUIRED_TRANSITIONS,
} from '../src/domain/recommendationLifecycleCore';
import {
  assertLearningTenantKeyedId,
  assertLearningTenantsMatch,
} from '../src/domain/learningTenantCore';
import {
  assertExplicitThesisId,
  assertThesisScope,
  denyImplicitThesisWinner,
  type ThesisScope,
} from '../src/domain/learningThesisScopeCore';
import {
  createStrategicRecommendation,
  type StrategicRecommendation,
} from '../src/domain/strategicRecommendationCore';

const NOW = '2026-08-26T16:30:00.000Z';
const TENANT = { organizationId: 'org-1', clientId: 'client-1' };

function singleScope(thesisId = 'thesis-a'): ThesisScope {
  return { kind: 'SINGLE', thesisId };
}

function baseObservation(overrides: Partial<Parameters<typeof createLearningObservation>[0]> = {}) {
  const result = createLearningObservation({
    observationId: 'obs-1',
    organizationId: TENANT.organizationId,
    clientId: TENANT.clientId,
    thesisScope: singleScope(),
    sourceKind: 'SIGNAL_OUTCOME',
    sourceRef: { sourceSpec: 'SPEC-001', sourceId: 'sig-1' },
    observationKind: 'USEFUL',
    payload: { signalId: 'sig-1' },
    actorUid: 'manager-1',
    recordedAt: NOW,
    ...overrides,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function baseEvidence(observationIds: string[]) {
  const result = createLearningEvidence({
    evidenceId: 'ev-1',
    organizationId: TENANT.organizationId,
    clientId: TENANT.clientId,
    thesisScope: singleScope(),
    observationIds,
    metrics: [{ key: 'useful', label: 'Useful signals', value: 1 }],
    summary: '1 useful signal',
    builtAt: NOW,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function baseRecommendation(
  overrides: Partial<Parameters<typeof createStrategicRecommendation>[0]> = {}
): StrategicRecommendation {
  const result = createStrategicRecommendation({
    recommendationId: 'rec-1',
    organizationId: TENANT.organizationId,
    clientId: TENANT.clientId,
    thesisScope: singleScope(),
    sourceObservationIds: ['obs-1'],
    learningEvidenceId: 'ev-1',
    recommendationType: 'STRATEGIC_SCORE_CONFIGURATION',
    targetAuthority: { specId: '002', domain: 'strategic-scoring' },
    proposedChange: {
      changeKind: 'WEIGHT_PROFILE',
      schemaVersion: 'weight-v1',
      payload: { profileId: 'p1' },
    },
    rationale: 'Increase timeliness weight based on useful outcomes',
    confidence: 'MEDIUM',
    risks: ['Overfitting to recent signals'],
    expectedImpact: { summary: 'Better timeliness alignment' },
    status: 'PROPOSED',
    createdBy: 'software-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('SPEC-008 Phase 1 — tenant invariants (T-008-105)', () => {
  it('requires organizationId and clientId', () => {
    const bad = assertLearningTenantKeyedId({
      id: 'x',
      organizationId: '',
      clientId: 'client-1',
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('INVALID_TENANT');
  });

  it('denies cross-tenant match', () => {
    const mismatch = assertLearningTenantsMatch(
      { organizationId: 'org-1', clientId: 'client-1' },
      { organizationId: 'org-2', clientId: 'client-1' }
    );
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.error.code).toBe('TENANT_MISMATCH');
  });
});

describe('SPEC-008 Phase 1 — thesis scope (T-008-106)', () => {
  it('SINGLE requires exactly one explicit thesisId', () => {
    const scope = assertThesisScope({ kind: 'SINGLE', thesisId: 'thesis-a' });
    expect(scope.ok).toBe(true);
  });

  it('MULTI requires at least two thesisIds', () => {
    const bad = assertThesisScope({ kind: 'MULTI', thesisIds: ['a'] });
    expect(bad.ok).toBe(false);
    const good = assertThesisScope({ kind: 'MULTI', thesisIds: ['a', 'b'] });
    expect(good.ok).toBe(true);
  });

  it('CLIENT_WIDE has no hidden primary thesis', () => {
    const scope = assertThesisScope({ kind: 'CLIENT_WIDE' });
    expect(scope.ok).toBe(true);
    if (scope.ok) expect(scope.value.kind).toBe('CLIENT_WIDE');
  });

  it('denies implicit thesis winner', () => {
    const denied = denyImplicitThesisWinner();
    expect(denied.ok).toBe(false);
    expect(assertExplicitThesisId('').ok).toBe(false);
  });
});

describe('SPEC-008 Phase 1 — LearningObservation (T-008-101)', () => {
  it('creates valid observation', () => {
    const obs = baseObservation();
    expect(obs.status).toBe('ACTIVE');
    expect(obs.schemaVersion).toBe('learning-observation-v1');
  });

  it('supersedes via successor — not in-place replace', () => {
    const prior = baseObservation();
    const successor = baseObservation({
      observationId: 'obs-2',
      supersedesObservationId: 'obs-1',
      observationKind: 'NOT_USEFUL',
    });
    const result = supersedeLearningObservation({ prior, successor: successor });
    expect(result.ok).toBe(true);
    const superseded = markObservationSuperseded(prior);
    expect(superseded.ok).toBe(true);
    if (superseded.ok) expect(superseded.value.status).toBe('SUPERSEDED');
  });

  it('resolveCurrentObservation picks latest ACTIVE by source', () => {
    const first = baseObservation({ observationId: 'obs-a', recordedAt: '2026-01-01T00:00:00.000Z' });
    const second = baseObservation({
      observationId: 'obs-b',
      recordedAt: '2026-02-01T00:00:00.000Z',
      supersedesObservationId: 'obs-a',
    });
    const current = resolveCurrentObservation([first, second], first.sourceRef);
    expect(current?.observationId).toBe('obs-b');
  });
});

describe('SPEC-008 Phase 1 — LearningEvidence + Assessment (T-008-102)', () => {
  it('builds evidence from observations', () => {
    const obs = baseObservation();
    const evidence = baseEvidence([obs.observationId]);
    const compat = assertObservationsCompatibleWithEvidence(evidence, [obs]);
    expect(compat.ok).toBe(true);
    const assessment = buildLearningAssessment({
      assessmentId: 'assess-1',
      evidence,
      signalsUseful: 1,
      builtAt: NOW,
    });
    expect(assessment.ok).toBe(true);
  });

  it('evidence explainability has no chain-of-thought field', () => {
    const evidence = baseEvidence(['obs-1']);
    const projection = projectLearningEvidenceExplainability(evidence);
    expect(projection).not.toHaveProperty('chainOfThought');
    expect(projection.reasonCodes).toContain('EVIDENCE_BUILT');
  });
});

describe('SPEC-008 Phase 1 — StrategicRecommendation (T-008-103)', () => {
  it('creates recommendation with target authority', () => {
    const rec = baseRecommendation();
    expect(rec.targetAuthority.specId).toBe('002');
    expect(rec.status).toBe('PROPOSED');
  });

  it('PROPOSED recommendation is not APPROVED', () => {
    const rec = baseRecommendation({ confidence: 'HIGH', status: 'PROPOSED' });
    expect(rec.status).not.toBe('APPROVED');
    expect(rec.status).not.toBe('APPLIED');
  });
});

describe('SPEC-008 Phase 1 — lifecycle (T-008-104 / T-008-107)', () => {
  it('allows DRAFT → PROPOSED', () => {
    const t = assertRecommendationTransition('DRAFT', 'PROPOSED', 'SOFTWARE');
    expect(t.ok).toBe(true);
  });

  it('requires HUMAN for APPROVED', () => {
    expect(HUMAN_REQUIRED_TRANSITIONS).toContain('APPROVED');
    const ai = assertRecommendationTransition('UNDER_REVIEW', 'APPROVED', 'AI');
    expect(ai.ok).toBe(false);
    if (!ai.ok) expect(ai.error.code).toBe('AI_AUTHORITY_FORBIDDEN');
    const human = assertHumanOnlyApproval('HUMAN', 'APPROVED');
    expect(human.ok).toBe(true);
  });

  it('denies UI approval', () => {
    const ui = assertRecommendationTransition('UNDER_REVIEW', 'APPROVED', 'UI');
    expect(ui.ok).toBe(false);
  });

  it('denies apply before approval', () => {
    const gate = assertCanApplyRecommendation('PROPOSED');
    expect(gate.ok).toBe(false);
    const apply = assertRecommendationApplyGate('PROPOSED', 'APPLIED', 'SOFTWARE');
    expect(apply.ok).toBe(false);
  });

  it('allows APPROVED → APPLIED with SOFTWARE after human approval path', () => {
    const apply = assertRecommendationApplyGate('APPROVED', 'APPLIED', 'SOFTWARE');
    expect(apply.ok).toBe(true);
  });

  it('APPROVED_NOT_APPLIED ≠ APPLIED', () => {
    const t = assertRecommendationTransition('APPROVED', 'APPROVED_NOT_APPLIED', 'SOFTWARE');
    expect(t.ok).toBe(true);
    expect(t.ok && 'APPROVED_NOT_APPLIED').not.toBe('APPLIED');
  });

  it('APPLY_FAILED can retry to APPROVED with HUMAN not required for retry path', () => {
    const retry = assertRecommendationTransition('APPLY_FAILED', 'APPROVED', 'SOFTWARE');
    expect(retry.ok).toBe(false);
    const humanRetry = assertRecommendationTransition('APPLY_FAILED', 'APPROVED', 'HUMAN');
    expect(humanRetry.ok).toBe(true);
  });

  it('superseded cannot apply', () => {
    const denied = assertNotSuperseded('SUPERSEDED');
    expect(denied.ok).toBe(false);
  });

  it('invalid transition fail closed', () => {
    const bad = assertRecommendationTransition('DRAFT', 'APPLIED', 'SOFTWARE');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('INVALID_TRANSITION');
  });
});

describe('SPEC-008 Phase 1 — RecommendationDecision', () => {
  it('decision is audit-only and cannot apply', () => {
    const decision = createRecommendationDecision({
      decisionId: 'dec-1',
      recommendationId: 'rec-1',
      recommendationVersion: 1,
      organizationId: TENANT.organizationId,
      clientId: TENANT.clientId,
      decision: 'APPROVE',
      actorUid: 'human-1',
      reason: 'Looks sound',
      decidedAt: NOW,
      previousStatus: 'UNDER_REVIEW',
    });
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.value.authority).toBe('AUDIT_ONLY');
      expect(assertDecisionDoesNotApply(decision.value).ok).toBe(true);
    }
  });
});

describe('SPEC-008 Phase 1 — materiality + history (T-008-108)', () => {
  it('denies silent material overwrite after approval', () => {
    const rec = baseRecommendation({ status: 'APPROVED', version: 1 });
    const fp1 = recommendationMaterialFingerprint(rec);
    const changed = baseRecommendation({
      status: 'APPROVED',
      version: 1,
      proposedChange: {
        changeKind: 'WEIGHT_PROFILE',
        schemaVersion: 'weight-v1',
        payload: { profileId: 'p2' },
      },
    });
    const fp2 = recommendationMaterialFingerprint(changed);
    const denied = assertMaterialNotSilentlyOverwritten({
      beforeVersion: 1,
      afterVersion: 1,
      beforeFingerprint: fp1,
      afterFingerprint: fp2,
      afterStatus: 'APPROVED',
    });
    expect(denied.ok).toBe(false);
  });

  it('requires version increment for material change when not approved', () => {
    const rec = baseRecommendation({ version: 1 });
    const fp1 = recommendationMaterialFingerprint(rec);
    const changed = baseRecommendation({
      version: 1,
      proposedChange: {
        changeKind: 'WEIGHT_PROFILE',
        schemaVersion: 'weight-v1',
        payload: { profileId: 'p9' },
      },
    });
    const fp2 = recommendationMaterialFingerprint(changed);
    const denied = assertMaterialNotSilentlyOverwritten({
      beforeVersion: 1,
      afterVersion: 1,
      beforeFingerprint: fp1,
      afterFingerprint: fp2,
      afterStatus: 'PROPOSED',
    });
    expect(denied.ok).toBe(false);
  });

  it('history is non-authoritative', () => {
    const record = createLearningHistoryRecord({
      kind: 'RECOMMENDATION_TRANSITION',
      organizationId: TENANT.organizationId,
      clientId: TENANT.clientId,
      aggregateKind: 'RECOMMENDATION',
      aggregateId: 'rec-1',
      aggregateVersion: 1,
      actorKind: 'HUMAN',
      reasonCodes: ['HUMAN_APPROVAL_RECORDED'],
      materialFingerprint: 'fp',
      occurredAt: NOW,
    });
    expect(assertHistoryIsNonAuthoritative(record).ok).toBe(true);
    expect(record.authority).toBe('AUDIT_ONLY');
  });

  it('version monotonic', () => {
    expect(assertVersionMonotonic({ beforeVersion: 2, afterVersion: 1 }).ok).toBe(false);
    expect(assertVersionMonotonic({ beforeVersion: 2, afterVersion: 3 }).ok).toBe(true);
  });
});

describe('SPEC-008 Phase 1 — authority invariants (T-008-107 / auto-mutation)', () => {
  it('learning stages cannot auto-apply', () => {
    const obs = baseObservation();
    const evidence = baseEvidence([obs.observationId]);
    const assessment = buildLearningAssessment({
      assessmentId: 'a1',
      evidence,
      builtAt: NOW,
    });
    if (!assessment.ok) throw new Error('assessment failed');
    expect(assertLearningStagesCannotAutoApply(obs, evidence, assessment.value).ok).toBe(true);
  });

  it('HIGH confidence does not grant approval authority', () => {
    const denied = assertConfidenceNotApprovalAuthority({
      confidence: 'HIGH',
      attemptingApprovalWithoutHuman: true,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('CONFIDENCE_NOT_AUTHORITY');
  });

  it('target-SPEC authority preserved', () => {
    const rec = baseRecommendation();
    expect(assertTargetSpecAuthorityPreserved(rec).ok).toBe(true);
    const explain = projectStrategicRecommendationExplainability(rec);
    expect(explain.reasonCodes).toContain('TARGET_SPEC_AUTHORITY_PRESERVED');
  });

  it('no SPEC-001/002/007 mutation authority in Domain', () => {
    expect(assertNoRoutingMutationAuthority().ok).toBe(true);
    expect(assertNoStrategicScoreMutationAuthority().ok).toBe(true);
    expect(assertNoOpportunityLifecycleAuthority().ok).toBe(true);
  });

  it('human transition updates recommendation status', () => {
    let rec = baseRecommendation({ status: 'UNDER_REVIEW' });
    const approved = transitionStrategicRecommendationStatus({
      recommendation: rec,
      to: 'APPROVED',
      actorKind: 'HUMAN',
      updatedAt: NOW,
    });
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      rec = approved.value;
      expect(rec.status).toBe('APPROVED');
    }
    const applied = transitionStrategicRecommendationStatus({
      recommendation: rec,
      to: 'APPLIED',
      actorKind: 'SOFTWARE',
      updatedAt: NOW,
    });
    expect(applied.ok).toBe(true);
  });
});

describe('SPEC-008 Phase 1 — explainability (T-008-109)', () => {
  it('structured explainability without chain-of-thought', () => {
    const rec = baseRecommendation();
    const explain = projectStrategicRecommendationExplainability(rec);
    expect(explain.rationale).toBeTruthy();
    expect(explain.sourceObservationIds.length).toBeGreaterThan(0);
    expect(explain).not.toHaveProperty('chainOfThought');
  });
});
