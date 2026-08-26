/**
 * SPEC-007 Phase 1 — Domain unit tests (T-007-110).
 */

import { describe, expect, it } from 'vitest';
import {
  attachOpportunityScore,
  createOpportunityCandidate,
  type OpportunityCandidate,
} from '../src/domain/opportunityCandidateCore';
import {
  materializeOpportunity,
  transitionMaterializedOpportunity,
} from '../src/domain/opportunityCore';
import {
  projectOpportunityCandidateExplainability,
  projectOpportunityScoreExplainability,
} from '../src/domain/opportunityExplainabilityCore';
import { mapLegacyToCanonicalOpportunityStatus } from '../src/domain/opportunityLegacyMappingCore';
import {
  assertActorMayEnterStatus,
  assertOpportunityTransition,
  HUMAN_REQUIRED_ENTRY_STATUSES,
} from '../src/domain/opportunityLifecycleCore';
import {
  assertHighScoreDoesNotAuthorize,
  assertMaterializeGate,
  CREATE_OPPORTUNITY_ACTION,
  type CreateOpportunityAuthorizationContext,
} from '../src/domain/opportunityMaterializeGateCore';
import {
  assertMaterialNotSilentlyOverwritten,
  candidateMaterialFingerprint,
  createHistoryEventIntent,
  opportunityCommandFingerprint,
} from '../src/domain/opportunityMaterialityCore';
import {
  assertCandidateThesisForBinding,
  assertExplicitThesisId,
  denyImplicitThesisWinner,
} from '../src/domain/opportunityMultiThesisCore';
import {
  computeOpportunityScore,
  OPPORTUNITY_SCORE_MAX_TOTAL,
  OPPORTUNITY_SCORE_MODEL_VERSION,
  type OpportunityScoreDimensionInput,
} from '../src/domain/opportunityScoreCore';
import {
  assertOpportunityTenantKeyedId,
  assertOpportunityTenantsMatch,
} from '../src/domain/opportunityTenantCore';

const NOW = '2026-08-26T12:00:00.000Z';

function allDimensionInputs(
  raw = 1
): OpportunityScoreDimensionInput[] {
  return [
    { key: 'strategicFit', rawInput: raw, reasonCode: 'FIT_OK' },
    { key: 'timeliness', rawInput: raw, reasonCode: 'TIME_OK' },
    { key: 'actionability', rawInput: raw, reasonCode: 'ACT_OK' },
    { key: 'expectedUpside', rawInput: raw, reasonCode: 'UP_OK' },
    { key: 'effortCost', rawInput: raw, reasonCode: 'EFF_OK' },
    { key: 'risk', rawInput: raw, reasonCode: 'RISK_OK' },
  ];
}

function baseCandidate(
  overrides: Partial<Parameters<typeof createOpportunityCandidate>[0]> = {}
): OpportunityCandidate {
  const result = createOpportunityCandidate({
    id: 'cand-1',
    organizationId: 'org-1',
    clientId: 'client-1',
    title: 'Panel CLE',
    summary: 'CLE panel opportunity',
    whyNow: 'Deadline in 14 days',
    opportunityType: 'PANEL',
    sourceRefs: ['signal:sig-1'],
    signalIds: ['sig-1'],
    thesisEvaluations: [
      {
        thesisId: 'thesis-a',
        fitNotes: 'Fit A',
        evaluationStatus: 'ELIGIBLE',
        strategicScoreRef: { scoringVersion: 'strategic-score-v1', totalScore: 70 },
      },
      {
        thesisId: 'thesis-b',
        fitNotes: 'Fit B highest strategic context',
        evaluationStatus: 'ELIGIBLE',
        strategicScoreRef: { scoringVersion: 'strategic-score-v1', totalScore: 95 },
      },
      {
        thesisId: 'thesis-c',
        fitNotes: 'Fit C',
        evaluationStatus: 'UNKNOWN',
      },
    ],
    riskFlags: ['DEADLINE_SOON'],
    recommendedNextStep: 'DRAFT_BRIEF',
    status: 'UNDER_EVALUATION',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: 'actor-human-1',
    ...overrides,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('candidate create failed');
  return result.value;
}

function authContext(
  overrides: Partial<CreateOpportunityAuthorizationContext> = {}
): CreateOpportunityAuthorizationContext {
  return {
    organizationId: 'org-1',
    clientId: 'client-1',
    thesisId: 'thesis-a',
    strategicBriefId: 'brief-1',
    strategicBriefVersion: 2,
    strategicPlanId: 'plan-1',
    strategicPlanVersion: 1,
    planItemId: 'item-1',
    action: CREATE_OPPORTUNITY_ACTION,
    authorizationAllowed: true,
    actorKind: 'SOFTWARE',
    ...overrides,
  };
}

describe('SPEC-007 Phase 1 — OpportunityCandidate (T-007-101)', () => {
  it('constructs candidate with required identity and multi-thesis evaluations', () => {
    const c = baseCandidate();
    expect(c.schemaVersion).toBe('opportunity-candidate-v1');
    expect(c.thesisEvaluations).toHaveLength(3);
    expect(c.organizationId).toBe('org-1');
    expect(c.clientId).toBe('client-1');
  });

  it('rejects missing thesis evaluations and missing tenant', () => {
    const noThesis = createOpportunityCandidate({
      id: 'c',
      organizationId: 'org-1',
      clientId: 'client-1',
      title: 't',
      summary: 's',
      whyNow: 'w',
      opportunityType: 'PANEL',
      sourceRefs: ['s1'],
      thesisEvaluations: [],
      riskFlags: [],
      recommendedNextStep: 'HOLD',
      createdAt: NOW,
      updatedAt: NOW,
      createdBy: 'a',
    });
    expect(noThesis.ok).toBe(false);
    if (!noThesis.ok) expect(noThesis.error.code).toBe('INVALID_CANDIDATE');

    const noTenant = createOpportunityCandidate({
      id: 'c',
      organizationId: '',
      clientId: 'client-1',
      title: 't',
      summary: 's',
      whyNow: 'w',
      opportunityType: 'PANEL',
      sourceRefs: ['s1'],
      thesisEvaluations: [
        { thesisId: 't1', fitNotes: 'n', evaluationStatus: 'ELIGIBLE' },
      ],
      riskFlags: [],
      recommendedNextStep: 'HOLD',
      createdAt: NOW,
      updatedAt: NOW,
      createdBy: 'a',
    });
    expect(noTenant.ok).toBe(false);
  });

  it('rejects duplicate thesis evaluations', () => {
    const dup = createOpportunityCandidate({
      id: 'c',
      organizationId: 'org-1',
      clientId: 'client-1',
      title: 't',
      summary: 's',
      whyNow: 'w',
      opportunityType: 'PANEL',
      sourceRefs: ['s1'],
      thesisEvaluations: [
        { thesisId: 't1', fitNotes: 'a', evaluationStatus: 'ELIGIBLE' },
        { thesisId: 't1', fitNotes: 'b', evaluationStatus: 'ELIGIBLE' },
      ],
      riskFlags: [],
      recommendedNextStep: 'HOLD',
      createdAt: NOW,
      updatedAt: NOW,
      createdBy: 'a',
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('DUPLICATE_THESIS_EVALUATION');
  });
});

describe('SPEC-007 Phase 1 — OpportunityScore (T-007-102)', () => {
  it('computes deterministic approved formula and band', () => {
    const a = computeOpportunityScore({
      id: 'score-1',
      organizationId: 'org-1',
      clientId: 'client-1',
      candidateId: 'cand-1',
      scoringModelVersion: OPPORTUNITY_SCORE_MODEL_VERSION,
      dimensions: allDimensionInputs(1),
      evidenceRefs: ['ev-1'],
      riskFlags: [],
      computedAt: NOW,
    });
    const b = computeOpportunityScore({
      id: 'score-1',
      organizationId: 'org-1',
      clientId: 'client-1',
      candidateId: 'cand-1',
      scoringModelVersion: OPPORTUNITY_SCORE_MODEL_VERSION,
      dimensions: allDimensionInputs(1),
      evidenceRefs: ['ev-1'],
      riskFlags: [],
      computedAt: NOW,
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.totalScore).toBe(OPPORTUNITY_SCORE_MAX_TOTAL);
      expect(a.value.totalScore).toBe(100);
      expect(a.value.band).toBe('CRITICAL');
      expect(a.value.totalScore).toBe(b.value.totalScore);
      expect(a.value.dimensions.map((d) => d.contribution)).toEqual(
        b.value.dimensions.map((d) => d.contribution)
      );
    }
  });

  it('fails closed on missing dimension, out of range, NaN, unknown model', () => {
    const missing = computeOpportunityScore({
      id: 's',
      organizationId: 'org-1',
      clientId: 'client-1',
      candidateId: 'c',
      scoringModelVersion: OPPORTUNITY_SCORE_MODEL_VERSION,
      dimensions: allDimensionInputs().slice(0, 5),
      evidenceRefs: [],
      riskFlags: [],
      computedAt: NOW,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('SCORE_INPUT_INVALID');

    const oor = computeOpportunityScore({
      id: 's',
      organizationId: 'org-1',
      clientId: 'client-1',
      candidateId: 'c',
      scoringModelVersion: OPPORTUNITY_SCORE_MODEL_VERSION,
      dimensions: allDimensionInputs(1.5),
      evidenceRefs: [],
      riskFlags: [],
      computedAt: NOW,
    });
    expect(oor.ok).toBe(false);

    const nan = computeOpportunityScore({
      id: 's',
      organizationId: 'org-1',
      clientId: 'client-1',
      candidateId: 'c',
      scoringModelVersion: OPPORTUNITY_SCORE_MODEL_VERSION,
      dimensions: allDimensionInputs().map((d, i) =>
        i === 0 ? { ...d, rawInput: Number.NaN } : d
      ),
      evidenceRefs: [],
      riskFlags: [],
      computedAt: NOW,
    });
    expect(nan.ok).toBe(false);

    const unknown = computeOpportunityScore({
      id: 's',
      organizationId: 'org-1',
      clientId: 'client-1',
      candidateId: 'c',
      scoringModelVersion: 'strategic-score-v1',
      dimensions: allDimensionInputs(),
      evidenceRefs: [],
      riskFlags: [],
      computedAt: NOW,
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe('UNKNOWN_SCORE_MODEL');
  });

  it('explainability exposes dimensions without chain-of-thought', () => {
    const score = computeOpportunityScore({
      id: 's',
      organizationId: 'org-1',
      clientId: 'client-1',
      candidateId: 'c',
      scoringModelVersion: OPPORTUNITY_SCORE_MODEL_VERSION,
      dimensions: allDimensionInputs(0.5),
      evidenceRefs: ['e1'],
      riskFlags: ['R1'],
      computedAt: NOW,
    });
    expect(score.ok).toBe(true);
    if (!score.ok) return;
    const expl = projectOpportunityScoreExplainability(score.value);
    expect(expl.totalScore).toBe(score.value.totalScore);
    expect(expl.dimensions).toHaveLength(6);
    expect(JSON.stringify(expl)).not.toMatch(/chain.of.thought|privateReasoning/i);
  });

  it('OpportunityScore is distinct from Strategic Score refs', () => {
    const c = baseCandidate();
    const strategicTotal =
      c.thesisEvaluations[1]?.strategicScoreRef?.totalScore ?? 0;
    const score = computeOpportunityScore({
      id: 's',
      organizationId: 'org-1',
      clientId: 'client-1',
      candidateId: c.id,
      scoringModelVersion: OPPORTUNITY_SCORE_MODEL_VERSION,
      dimensions: allDimensionInputs(0.4),
      evidenceRefs: [],
      riskFlags: [],
      computedAt: NOW,
    });
    expect(score.ok).toBe(true);
    if (!score.ok) return;
    expect(score.value.scoringModelVersion).toBe(OPPORTUNITY_SCORE_MODEL_VERSION);
    expect(score.value.scoringModelVersion).not.toBe('strategic-score-v1');
    expect(score.value.totalScore).not.toBe(strategicTotal);
  });
});

describe('SPEC-007 Phase 1 — multi-thesis (T-007-106)', () => {
  it('does not select highest strategic score as winner', () => {
    const c = baseCandidate();
    const omitted = assertExplicitThesisId(null);
    expect(omitted.ok).toBe(false);
    expect(denyImplicitThesisWinner().ok).toBe(false);

    const bindB = assertCandidateThesisForBinding(c, 'thesis-b');
    expect(bindB.ok).toBe(true);

    const missing = assertCandidateThesisForBinding(c, 'thesis-z');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('THESIS_MISMATCH');
  });

  it('denies materialization when thesis omitted even if B is highest', () => {
    const c = baseCandidate();
    const gate = assertMaterializeGate({
      authorization: authContext({ thesisId: 'thesis-b' }),
      candidate: c,
      thesisId: undefined,
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.error.code).toBe('THESIS_MISMATCH');
  });

  it('denies materialization thesis B without matching auth when candidate has A', () => {
    const c = baseCandidate();
    const gate = assertMaterializeGate({
      authorization: authContext({ thesisId: 'thesis-a' }),
      candidate: c,
      thesisId: 'thesis-b',
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.error.code).toBe('THESIS_MISMATCH');
  });
});

describe('SPEC-007 Phase 1 — materialize gate + Opportunity (T-007-103/107)', () => {
  it('materializes with explicit one thesis and candidate traceability', () => {
    const c = baseCandidate();
    const result = materializeOpportunity({
      id: 'opp-1',
      authorization: authContext(),
      thesisId: 'thesis-a',
      candidate: c,
      title: c.title,
      organization: 'Bar Assoc',
      type: c.opportunityType,
      description: c.summary,
      fitRationale: 'Explicit thesis-a',
      createdAt: NOW,
      updatedAt: NOW,
      createdBy: 'software-1',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.opportunity.thesisId).toBe('thesis-a');
    expect(result.value.opportunity.candidateId).toBe('cand-1');
    expect(result.value.opportunity.candidateVersion).toBe(1);
    expect(result.value.opportunity.status).toBe('PROPOSED');
    expect(result.value.opportunity.strategicPlanId).toBe('plan-1');
    expect(result.value.opportunity.planItemId).toBe('item-1');
  });

  it('high score without Plan allow denies execution authority', () => {
    const denyScore = assertHighScoreDoesNotAuthorize(OPPORTUNITY_SCORE_MAX_TOTAL, false);
    expect(denyScore.ok).toBe(false);
    if (!denyScore.ok) {
      expect(denyScore.error.code).toBe('CREATE_OPPORTUNITY_AUTHORIZATION_REQUIRED');
    }

    const gate = assertMaterializeGate({
      authorization: authContext({ authorizationAllowed: false }),
      candidate: baseCandidate(),
      thesisId: 'thesis-a',
    });
    expect(gate.ok).toBe(false);

    const mat = materializeOpportunity({
      id: 'opp-x',
      authorization: authContext({ authorizationAllowed: false }),
      thesisId: 'thesis-a',
      candidate: baseCandidate(),
      title: 't',
      organization: 'o',
      type: 'PANEL',
      description: 'd',
      fitRationale: 'f',
      createdAt: NOW,
      updatedAt: NOW,
      createdBy: 's',
    });
    expect(mat.ok).toBe(false);
  });

  it('requires CREATE_OPPORTUNITY action and tenant consistency', () => {
    const wrongAction = assertMaterializeGate({
      authorization: authContext({ action: 'CREATE_TASK' }),
      thesisId: 'thesis-a',
    });
    expect(wrongAction.ok).toBe(false);
    if (!wrongAction.ok) expect(wrongAction.error.code).toBe('ACTION_NOT_AUTHORIZED');

    const crossTenant = assertMaterializeGate({
      authorization: authContext(),
      candidate: baseCandidate({ organizationId: 'org-OTHER' }),
      thesisId: 'thesis-a',
    });
    expect(crossTenant.ok).toBe(false);
    if (!crossTenant.ok) expect(crossTenant.error.code).toBe('TENANT_MISMATCH');
  });
});

describe('SPEC-007 Phase 1 — lifecycle (T-007-104)', () => {
  it('allows valid transitions and denies invalid / terminal reopen', () => {
    const c = baseCandidate();
    const mat = materializeOpportunity({
      id: 'opp-1',
      authorization: authContext(),
      thesisId: 'thesis-a',
      candidate: c,
      title: c.title,
      organization: 'Org',
      type: 'PANEL',
      description: c.summary,
      fitRationale: 'r',
      createdAt: NOW,
      updatedAt: NOW,
      createdBy: 's',
    });
    expect(mat.ok).toBe(true);
    if (!mat.ok) return;

    const accepted = transitionMaterializedOpportunity(
      mat.value.opportunity,
      'ACCEPTED',
      'HUMAN',
      NOW
    );
    expect(accepted.ok).toBe(true);

    const invalid = assertOpportunityTransition('PROPOSED', 'SUBMITTED', 'HUMAN');
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.code).toBe('INVALID_TRANSITION');

    const declined = transitionMaterializedOpportunity(
      mat.value.opportunity,
      'DECLINED',
      'HUMAN',
      NOW
    );
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    const reopen = transitionMaterializedOpportunity(
      declined.value,
      'ACCEPTED',
      'HUMAN',
      NOW
    );
    expect(reopen.ok).toBe(false);
    if (!reopen.ok) expect(reopen.error.code).toBe('TERMINAL_STATE');
  });

  it('human-required transitions reject SOFTWARE/AI/UI/UNKNOWN', () => {
    for (const status of HUMAN_REQUIRED_ENTRY_STATUSES) {
      expect(assertActorMayEnterStatus('SOFTWARE', status).ok).toBe(false);
      expect(assertActorMayEnterStatus('AI', status).ok).toBe(false);
      expect(assertActorMayEnterStatus('UI', status).ok).toBe(false);
      expect(assertActorMayEnterStatus('UNKNOWN', status).ok).toBe(false);
      expect(assertActorMayEnterStatus('HUMAN', status).ok).toBe(true);
    }
  });

  it('AI claiming human-like label still denied as AI actor kind', () => {
    const ai = assertOpportunityTransition('PROPOSED', 'ACCEPTED', 'AI');
    expect(ai.ok).toBe(false);
    if (!ai.ok) expect(ai.error.code).toBe('AI_AUTHORITY_FORBIDDEN');
  });

  it('SOFTWARE may enter PROPOSED/CHECKLIST/COMPLETED/ARCHIVED but not ACCEPTED', () => {
    expect(assertActorMayEnterStatus('SOFTWARE', 'PROPOSED').ok).toBe(true);
    expect(assertActorMayEnterStatus('SOFTWARE', 'CHECKLIST').ok).toBe(true);
    expect(assertActorMayEnterStatus('SOFTWARE', 'ACCEPTED').ok).toBe(false);
  });
});

describe('SPEC-007 Phase 1 — tenant (T-007-105)', () => {
  it('requires org|client|id and denies cross-tenant', () => {
    const keyed = assertOpportunityTenantKeyedId({
      organizationId: 'org-1',
      clientId: 'client-1',
      id: 'opp-1',
    });
    expect(keyed.ok).toBe(true);

    const idOnly = assertOpportunityTenantKeyedId({
      organizationId: '',
      clientId: 'client-1',
      id: 'opp-1',
    });
    expect(idOnly.ok).toBe(false);

    const mismatch = assertOpportunityTenantsMatch(
      { organizationId: 'org-1', clientId: 'client-1' },
      { organizationId: 'org-1', clientId: 'client-OTHER' }
    );
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.error.code).toBe('TENANT_MISMATCH');
  });
});

describe('SPEC-007 Phase 1 — materiality / history / explainability (T-007-108/109)', () => {
  it('material fingerprint + version gate; history is AUDIT_ONLY', () => {
    const c = baseCandidate();
    const fp = candidateMaterialFingerprint(c);
    expect(fp.length).toBeGreaterThan(10);

    const silent = assertMaterialNotSilentlyOverwritten({
      beforeVersion: 1,
      afterVersion: 1,
      beforeFingerprint: fp,
      afterFingerprint: fp + '-changed',
    });
    expect(silent.ok).toBe(false);
    if (!silent.ok) {
      expect(silent.error.code).toBe('MATERIAL_CHANGE_REQUIRES_REVISION');
    }

    const hist = createHistoryEventIntent({
      kind: 'CANDIDATE_EVALUATED',
      organizationId: 'org-1',
      clientId: 'client-1',
      aggregateKind: 'CANDIDATE',
      aggregateId: c.id,
      aggregateVersion: c.version,
      actorKind: 'SOFTWARE',
      reasonCodes: ['SCORE_COMPUTED'],
      materialFingerprint: fp,
      occurredAt: NOW,
    });
    expect(hist.authority).toBe('AUDIT_ONLY');

    const idem = opportunityCommandFingerprint({
      organizationId: 'org-1',
      clientId: 'client-1',
      command: 'MaterializeOpportunity',
      intentKey: 'plan-1|item-1|thesis-a',
    });
    expect(idem).toContain('MaterializeOpportunity');
  });

  it('candidate explainability includes whyNow and thesis context', () => {
    let c = baseCandidate();
    const score = computeOpportunityScore({
      id: 's1',
      organizationId: 'org-1',
      clientId: 'client-1',
      candidateId: c.id,
      scoringModelVersion: OPPORTUNITY_SCORE_MODEL_VERSION,
      dimensions: allDimensionInputs(0.8),
      evidenceRefs: ['e'],
      riskFlags: [],
      computedAt: NOW,
    });
    expect(score.ok).toBe(true);
    if (!score.ok) return;
    const attached = attachOpportunityScore(c, score.value, NOW);
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;
    c = attached.value;
    const expl = projectOpportunityCandidateExplainability(c);
    expect(expl.whyNow).toBe(c.whyNow);
    expect(expl.thesisEvaluations).toHaveLength(3);
    expect(expl.score?.totalScore).toBe(score.value.totalScore);
  });
});

describe('SPEC-007 Phase 1 — legacy mapping fail-closed', () => {
  it('maps lossless paths and fails ambiguous COMPLETED+submitted', () => {
    expect(mapLegacyToCanonicalOpportunityStatus({ status: 'SENT_TO_CLIENT' }).value).toBe(
      'PROPOSED'
    );
    expect(mapLegacyToCanonicalOpportunityStatus({ status: 'REJECTED' }).value).toBe(
      'DECLINED'
    );
    expect(
      mapLegacyToCanonicalOpportunityStatus({
        status: 'ACCEPTED',
        lifecycleStage: 'accepted',
      }).value
    ).toBe('ACCEPTED');

    const amb = mapLegacyToCanonicalOpportunityStatus({
      status: 'COMPLETED',
      lifecycleStage: 'submitted',
    });
    expect(amb.ok).toBe(false);
    if (!amb.ok) expect(amb.error.code).toBe('LEGACY_MAPPING_AMBIGUOUS');
  });
});
