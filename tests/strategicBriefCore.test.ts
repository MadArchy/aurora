import { describe, expect, it } from 'vitest';
import {
  BRIEF_SCHEMA_VERSION,
  BRIEF_STATUS_TRANSITIONS,
  assertApprovedNotMutatedInPlace,
  assertBriefActionable,
  assertOverridePreservesInvariants,
  approveDraftBrief,
  canAuthorizeStrategicAction,
  canAuthorizeStrategicDownstream,
  canTransitionBriefStatus,
  createBriefHistoryRecord,
  createDraftStrategicBrief,
  nextBriefVersion,
  planMaterialRevisionFromApproved,
  rejectDraftBrief,
  reopenRejectedBrief,
  supersedeBrief,
  toMaterialIdentity,
  transitionBriefStatus,
  validateOverrideRecord,
  type CreateDraftStrategicBriefInput,
  type StrategicBrief,
  type StrategicBriefOverrideRecord,
  type StrategicDecisionSnapshot,
} from '../src/domain/strategicBriefCore';
import {
  briefMaterialFingerprint,
  isMaterialBriefChange,
  isMaterialStrategicContentChange,
  isSameMaterialIdentity,
} from '../src/domain/briefMaterialityCore';
import {
  evaluateBriefRoutingEligibility,
  isClearGovernedThesisMatch,
  type BriefRoutingContextInput,
} from '../src/domain/briefRoutingGateCore';
import {
  assertBriefTenantStructure,
  assertResolvedRefsMatchBriefTenant,
} from '../src/domain/briefTenantCore';

const NOW = '2026-08-24T18:00:00.000Z';
const LATER = '2026-08-24T19:00:00.000Z';

function validDecision(overrides: Partial<StrategicDecisionSnapshot> = {}): StrategicDecisionSnapshot {
  return {
    decisionRationale: 'Governed CLEAR thesis with timely regulatory signal.',
    authorizedAction: 'CREATE_CONTENT',
    dispositionDecision: 'SAVE',
    formatDecision: 'ARTICLE',
    upstreamRoutingRef: {
      routingState: 'CLEAR',
      algorithmVersion: 'routing-v1',
      routedAt: NOW,
      source: 'AUTO',
    },
    upstreamScoreRef: {
      scoringVersion: 'scoring-v1',
      totalScore: 82,
      priorityBand: 'HIGH',
      scoredAt: NOW,
      recommendedDisposition: 'SAVE',
      recommendedOutputFormat: 'ARTICLE',
    },
    signalContextRefs: [{ signalId: 'sig_1', scoreSnapshotId: 'sc_1', routingSnapshotId: 'rt_1' }],
    ...overrides,
  };
}

function validDraftInput(
  overrides: Partial<CreateDraftStrategicBriefInput> = {}
): CreateDraftStrategicBriefInput {
  return {
    id: 'brief_1',
    organizationId: 'org_aurora_01',
    clientId: 'client_juan_001',
    thesisId: 'th_1',
    signalIds: ['sig_1'],
    primaryAudience: 'General Counsel',
    geography: 'CO',
    territory: 'AI Governance',
    framework: 'Preventive regulatory narrative',
    whyNow: { reason: 'NIST update this week', score: 15 },
    strategicAngle: 'Translate the NIST update into board-ready governance advice.',
    supportingEvidenceIds: ['ev_1'],
    riskFlags: ['REGULATORY'],
    recommendedChannel: 'LINKEDIN',
    recommendedFormat: 'ARTICLE',
    CTA: 'Request a governance diagnostic',
    createdBy: 'mgr_ana',
    createdAt: NOW,
    decision: validDecision(),
    ...overrides,
  };
}

function mustDraft(overrides: Partial<CreateDraftStrategicBriefInput> = {}): StrategicBrief {
  const created = createDraftStrategicBrief(validDraftInput(overrides));
  if (!created.ok) throw created.error;
  return created.value;
}

function mustApproved(brief = mustDraft()): StrategicBrief {
  const approved = approveDraftBrief(brief, {
    approvedBy: 'mgr_ana',
    approvedAt: LATER,
    routing: { routingState: 'CLEAR', governedThesisId: brief.thesisId },
    signalRouting: brief.signalIds.map((signalId) => ({
      signalId,
      routingState: 'CLEAR' as const,
      governedThesisId: brief.thesisId,
    })),
  });
  if (!approved.ok) throw approved.error;
  return approved.value;
}

const CLEAR: BriefRoutingContextInput = {
  routingState: 'CLEAR',
  governedThesisId: 'th_1',
};

describe('SPEC-003 Phase 1 — StrategicBrief aggregate', () => {
  it('constructs a valid DRAFT with constitutional fields and schemaVersion', () => {
    const brief = mustDraft();
    expect(brief.status).toBe('DRAFT');
    expect(brief.version).toBe(1);
    expect(brief.schemaVersion).toBe(BRIEF_SCHEMA_VERSION);
    expect(brief.approvedBy).toBeNull();
    expect(brief.organizationId).toBe('org_aurora_01');
    expect(brief.clientId).toBe('client_juan_001');
    expect(brief.thesisId).toBe('th_1');
    expect(brief.CTA).toBe('Request a governance diagnostic');
    expect(brief.decision.authorizedAction).toBe('CREATE_CONTENT');
    expect(brief.decision.upstreamScoreRef.scoringVersion).toBe('scoring-v1');
  });

  it('rejects missing required constitutional fields', () => {
    for (const field of ['thesisId', 'primaryAudience', 'geography', 'territory', 'framework', 'strategicAngle', 'recommendedChannel', 'recommendedFormat', 'CTA', 'createdBy'] as const) {
      const created = createDraftStrategicBrief(validDraftInput({ [field]: '' }));
      expect(created.ok).toBe(false);
      if (!created.ok) expect(created.error.code).toBe('INVALID_BRIEF');
    }
  });

  it('rejects duplicate signalIds', () => {
    const created = createDraftStrategicBrief(validDraftInput({ signalIds: ['sig_1', 'sig_1'] }));
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.error.code).toBe('INVALID_BRIEF');
  });

  it('deduplicates supportingEvidenceIds and preserves first order', () => {
    const brief = mustDraft({ supportingEvidenceIds: ['ev_1', 'ev_2', 'ev_1'] });
    expect(brief.supportingEvidenceIds).toEqual(['ev_1', 'ev_2']);
  });

  it('rejects empty signalIds', () => {
    const created = createDraftStrategicBrief(validDraftInput({ signalIds: [] }));
    expect(created.ok).toBe(false);
  });

  it('rejects invalid version', () => {
    expect(createDraftStrategicBrief(validDraftInput({ version: 0 })).ok).toBe(false);
    expect(createDraftStrategicBrief(validDraftInput({ version: -1 })).ok).toBe(false);
    expect(createDraftStrategicBrief(validDraftInput({ version: 1.5 })).ok).toBe(false);
  });

  it('requires a decision snapshot', () => {
    const created = createDraftStrategicBrief(
      validDraftInput({ decision: undefined as unknown as StrategicDecisionSnapshot })
    );
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.error.code).toBe('INVALID_DECISION');
  });

  it('requires override rationale when disposition differs from SPEC-002 recommendation', () => {
    const created = createDraftStrategicBrief(
      validDraftInput({
        decision: validDecision({
          dispositionDecision: 'MONITOR',
          dispositionOverrideReason: '',
        }),
      })
    );
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.error.code).toBe('INVALID_DECISION');
  });

  it('accepts disposition override when rationale is present', () => {
    const brief = mustDraft({
      decision: validDecision({
        dispositionDecision: 'MONITOR',
        dispositionOverrideReason: 'Manager holds for more evidence',
      }),
    });
    expect(brief.decision.dispositionDecision).toBe('MONITOR');
  });
});

describe('SPEC-003 Phase 1 — tenant structure', () => {
  it('requires organizationId and clientId', () => {
    expect(assertBriefTenantStructure({ organizationId: '', clientId: 'c1' }).ok).toBe(false);
    expect(assertBriefTenantStructure({ organizationId: 'o1', clientId: '' }).ok).toBe(false);
    expect(assertBriefTenantStructure({ organizationId: 'o1', clientId: 'c1' }).ok).toBe(true);
  });

  it('compares resolved tenant refs structurally without a repository', () => {
    const brief = { organizationId: 'org_1', clientId: 'client_1' };
    expect(
      assertResolvedRefsMatchBriefTenant(brief, [{ organizationId: 'org_1', clientId: 'client_1' }]).ok
    ).toBe(true);
    expect(
      assertResolvedRefsMatchBriefTenant(brief, [{ organizationId: 'org_1', clientId: 'other' }]).ok
    ).toBe(false);
  });
});

describe('SPEC-003 Phase 1 — CLEAR routing gate', () => {
  it('CLEAR + matching governed thesis is eligible for approval', () => {
    const brief = mustDraft();
    const approved = approveDraftBrief(brief, {
      approvedBy: 'mgr_ana',
      approvedAt: LATER,
      routing: CLEAR,
      signalRouting: [{ signalId: 'sig_1', routingState: 'CLEAR', governedThesisId: 'th_1' }],
    });
    expect(approved.ok).toBe(true);
    expect(isClearGovernedThesisMatch('th_1', CLEAR)).toBe(true);
  });

  it('CLEAR + mismatching governed thesis fails', () => {
    const brief = mustDraft();
    const approved = approveDraftBrief(brief, {
      approvedBy: 'mgr_ana',
      approvedAt: LATER,
      routing: { routingState: 'CLEAR', governedThesisId: 'th_other' },
    });
    expect(approved.ok).toBe(false);
    if (!approved.ok) expect(approved.error.code).toBe('ROUTING_CONTEXT_INVALID');
  });
});

describe('SPEC-003 Phase 1 — CONTESTED fail-closed', () => {
  it('cannot approve CONTESTED routing', () => {
    const brief = mustDraft();
    const approved = approveDraftBrief(brief, {
      approvedBy: 'mgr_ana',
      approvedAt: LATER,
      routing: { routingState: 'CONTESTED', governedThesisId: 'th_1' },
    });
    expect(approved.ok).toBe(false);
    if (!approved.ok) expect(approved.error.code).toBe('ROUTING_CONTEXT_INVALID');
  });

  it('cannot authorize downstream from CONTESTED snapshot', () => {
    const approved = mustApproved();
    const contested: StrategicBrief = {
      ...approved,
      decision: {
        ...approved.decision,
        upstreamRoutingRef: { ...approved.decision.upstreamRoutingRef, routingState: 'CONTESTED' },
      },
    };
    expect(canAuthorizeStrategicDownstream(contested)).toBe(false);
  });
});

describe('SPEC-003 Phase 1 — UNROUTED fail-closed', () => {
  it('cannot approve UNROUTED routing', () => {
    const brief = mustDraft();
    const approved = approveDraftBrief(brief, {
      approvedBy: 'mgr_ana',
      approvedAt: LATER,
      routing: { routingState: 'UNROUTED' },
    });
    expect(approved.ok).toBe(false);
    if (!approved.ok) expect(approved.error.code).toBe('ROUTING_CONTEXT_INVALID');
  });

  it('cannot authorize downstream from UNROUTED snapshot', () => {
    const approved = mustApproved();
    const unrouted: StrategicBrief = {
      ...approved,
      decision: {
        ...approved.decision,
        upstreamRoutingRef: { ...approved.decision.upstreamRoutingRef, routingState: 'UNROUTED' },
      },
    };
    expect(canAuthorizeStrategicDownstream(unrouted)).toBe(false);
  });
});

describe('SPEC-003 Phase 1 — multi-signal / one thesis', () => {
  it('supports N unique signalIds for the same thesis', () => {
    const brief = mustDraft({
      signalIds: ['sig_1', 'sig_2'],
      decision: validDecision({
        signalContextRefs: [{ signalId: 'sig_1' }, { signalId: 'sig_2' }],
      }),
    });
    const approved = approveDraftBrief(brief, {
      approvedBy: 'mgr_ana',
      approvedAt: LATER,
      routing: CLEAR,
      signalRouting: [
        { signalId: 'sig_1', routingState: 'CLEAR', governedThesisId: 'th_1' },
        { signalId: 'sig_2', routingState: 'CLEAR', governedThesisId: 'th_1' },
      ],
    });
    expect(approved.ok).toBe(true);
    if (approved.ok) expect(approved.value.signalIds).toEqual(['sig_1', 'sig_2']);
  });

  it('rejects mixed-thesis signal routing contexts', () => {
    const result = evaluateBriefRoutingEligibility({
      thesisId: 'th_1',
      signalIds: ['sig_1', 'sig_2'],
      routing: CLEAR,
      signalRouting: [
        { signalId: 'sig_1', routingState: 'CLEAR', governedThesisId: 'th_1' },
        { signalId: 'sig_2', routingState: 'CLEAR', governedThesisId: 'th_2' },
      ],
    });
    expect(result.ok).toBe(false);
  });
});

describe('SPEC-003 Phase 1 — status machine', () => {
  it('allows documented transitions and rejects illegal ones', () => {
    expect(canTransitionBriefStatus('DRAFT', 'APPROVED')).toBe(true);
    expect(canTransitionBriefStatus('DRAFT', 'REJECTED')).toBe(true);
    expect(canTransitionBriefStatus('DRAFT', 'SUPERSEDED')).toBe(true);
    expect(canTransitionBriefStatus('APPROVED', 'SUPERSEDED')).toBe(true);
    expect(canTransitionBriefStatus('REJECTED', 'DRAFT')).toBe(true);
    expect(canTransitionBriefStatus('APPROVED', 'DRAFT')).toBe(false);
    expect(canTransitionBriefStatus('APPROVED', 'REJECTED')).toBe(false);
    expect(canTransitionBriefStatus('SUPERSEDED', 'APPROVED')).toBe(false);
    expect(canTransitionBriefStatus('SUPERSEDED', 'DRAFT')).toBe(false);
    expect(canTransitionBriefStatus('REJECTED', 'APPROVED')).toBe(false);
    expect(BRIEF_STATUS_TRANSITIONS.SUPERSEDED).toEqual([]);
  });

  it('transitionBriefStatus executes legal paths and fails illegal ones', () => {
    const draft = mustDraft();
    const rejected = transitionBriefStatus(draft, 'REJECTED', {
      now: LATER,
      rejectionReason: 'Off thesis',
    });
    expect(rejected.ok).toBe(true);

    const illegal = transitionBriefStatus(mustApproved(), 'DRAFT', { now: LATER });
    expect(illegal.ok).toBe(false);
    if (!illegal.ok) expect(illegal.error.code).toBe('INVALID_STATE_TRANSITION');
  });
});

describe('SPEC-003 Phase 1 — approval invariant', () => {
  it('APPROVED requires approval metadata, valid decision, and CLEAR routing', () => {
    const draft = mustDraft();
    const missingActor = approveDraftBrief(draft, {
      approvedBy: '',
      approvedAt: LATER,
      routing: CLEAR,
    });
    expect(missingActor.ok).toBe(false);

    const approved = mustApproved(draft);
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('mgr_ana');
    expect(approved.approvedAt).toBe(LATER);
  });

  it('does not infer approval from createdBy', () => {
    const draft = mustDraft({ createdBy: 'mgr_ana' });
    expect(draft.status).toBe('DRAFT');
    expect(canAuthorizeStrategicDownstream(draft)).toBe(false);
  });
});

describe('SPEC-003 Phase 1 — rejection and superseded', () => {
  it('REJECTED is not downstream-authorizing and records reason', () => {
    const rejected = rejectDraftBrief(mustDraft(), {
      rejectionReason: 'Wrong territory',
      rejectedAt: LATER,
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.value.status).toBe('REJECTED');
    expect(rejected.value.rejectionReason).toBe('Wrong territory');
    expect(canAuthorizeStrategicDownstream(rejected.value)).toBe(false);
    expect(assertBriefActionable(rejected.value).ok).toBe(false);
  });

  it('requires rejectionReason', () => {
    const rejected = rejectDraftBrief(mustDraft(), { rejectionReason: '  ', rejectedAt: LATER });
    expect(rejected.ok).toBe(false);
  });

  it('SUPERSEDED cannot authorize downstream', () => {
    const superseded = supersedeBrief(mustApproved(), {
      supersededByBriefId: 'brief_2',
      supersededAt: LATER,
    });
    expect(superseded.ok).toBe(true);
    if (!superseded.ok) return;
    expect(superseded.value.status).toBe('SUPERSEDED');
    expect(canAuthorizeStrategicDownstream(superseded.value)).toBe(false);
  });

  it('can reopen REJECTED to DRAFT', () => {
    const rejected = rejectDraftBrief(mustDraft(), {
      rejectionReason: 'Needs work',
      rejectedAt: LATER,
    });
    if (!rejected.ok) throw rejected.error;
    const reopened = reopenRejectedBrief(rejected.value, { reopenedAt: LATER });
    expect(reopened.ok).toBe(true);
    if (reopened.ok) expect(reopened.value.status).toBe('DRAFT');
  });
});

describe('SPEC-003 Phase 1 — downstream authorization', () => {
  it('only current APPROVED briefs authorize strategic downstream', () => {
    expect(canAuthorizeStrategicDownstream(mustDraft())).toBe(false);
    expect(canAuthorizeStrategicDownstream(mustApproved())).toBe(true);
    expect(canAuthorizeStrategicAction(mustApproved(), 'CREATE_CONTENT')).toBe(true);
    expect(canAuthorizeStrategicAction(mustApproved(), 'CREATE_TASK')).toBe(false);
  });

  it('NONE authorizedAction does not authorize downstream', () => {
    const brief = mustApproved(
      mustDraft({ decision: validDecision({ authorizedAction: 'NONE' }) })
    );
    expect(canAuthorizeStrategicDownstream(brief)).toBe(false);
  });
});

describe('SPEC-003 Phase 1 — materiality', () => {
  it('treats each formal material field change as material', () => {
    const base = mustDraft();
    const fields: Array<[string, StrategicBrief]> = [
      ['thesisId', { ...base, thesisId: 'th_2' }],
      ['signalIds', { ...base, signalIds: ['sig_1', 'sig_9'] }],
      ['strategicAngle', { ...base, strategicAngle: 'Different angle' }],
      ['supportingEvidenceIds', { ...base, supportingEvidenceIds: ['ev_9'] }],
      ['riskFlags', { ...base, riskFlags: ['LEGAL'] }],
      ['recommendedChannel', { ...base, recommendedChannel: 'YOUTUBE' }],
      ['recommendedFormat', { ...base, recommendedFormat: 'VIDEO' }],
      ['CTA', { ...base, CTA: 'Book a call' }],
      ['framework', { ...base, framework: 'Other frame' }],
      ['territory', { ...base, territory: 'Privacy' }],
      ['geography', { ...base, geography: 'US' }],
      ['primaryAudience', { ...base, primaryAudience: 'CIOs' }],
      [
        'decision',
        {
          ...base,
          decision: { ...base.decision, decisionRationale: 'Changed rationale' },
        },
      ],
    ];
    for (const [label, next] of fields) {
      expect(isMaterialBriefChange(base, next), label).toBe(true);
    }
  });

  it('timestamp-only change is not material', () => {
    const base = mustDraft();
    const later: StrategicBrief = { ...base, createdAt: LATER, updatedAt: LATER };
    expect(isMaterialBriefChange(base, later)).toBe(false);
    expect(isMaterialStrategicContentChange(base, later)).toBe(false);
  });

  it('treats signalIds / evidence / riskFlags as order-independent sets', () => {
    const a = mustDraft({
      signalIds: ['sig_1', 'sig_2'],
      supportingEvidenceIds: ['ev_1', 'ev_2'],
      riskFlags: ['A', 'B'],
      decision: validDecision({
        signalContextRefs: [{ signalId: 'sig_1' }, { signalId: 'sig_2' }],
      }),
    });
    const b: StrategicBrief = {
      ...a,
      signalIds: ['sig_2', 'sig_1'],
      supportingEvidenceIds: ['ev_2', 'ev_1'],
      riskFlags: ['B', 'A'],
    };
    expect(isMaterialBriefChange(a, b)).toBe(false);
  });

  it('AI advisory ref refresh is not material', () => {
    const base = mustDraft();
    const refreshed: StrategicBrief = {
      ...base,
      decision: {
        ...base.decision,
        aiAdvisoryRefs: [{ operation: 'ADVISOR_CURATION_ANGLE', suggestedAngle: 'x' }],
      },
    };
    expect(isMaterialBriefChange(base, refreshed)).toBe(false);
  });
});

describe('SPEC-003 Phase 1 — version / approved revision', () => {
  it('material revision of APPROVED yields monotonic next version and SUPERSEDED prior', () => {
    const previous = mustApproved();
    const planned = planMaterialRevisionFromApproved({
      previous,
      now: LATER,
      nextInput: validDraftInput({
        id: 'brief_2',
        strategicAngle: 'Revised angle after new evidence',
        createdAt: LATER,
      }),
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.superseded.status).toBe('SUPERSEDED');
    expect(planned.value.superseded.supersededByBriefId).toBe('brief_2');
    expect(planned.value.revision.status).toBe('DRAFT');
    expect(planned.value.revision.version).toBe(2);
    expect(planned.value.revision.supersedesBriefId).toBe(previous.id);
    expect(nextBriefVersion(1)).toEqual({ ok: true, value: 2 });
  });

  it('same or older version is invalid for a material revision', () => {
    const previous = mustApproved();
    const sameVersion = planMaterialRevisionFromApproved({
      previous,
      now: LATER,
      nextInput: validDraftInput({
        id: 'brief_2',
        version: 1,
        strategicAngle: 'Revised angle',
        createdAt: LATER,
      }),
    });
    expect(sameVersion.ok).toBe(false);
  });

  it('cannot mutate an APPROVED brief in place when material fields change', () => {
    const previous = mustApproved();
    const mutated: StrategicBrief = { ...previous, strategicAngle: 'Silent edit' };
    const result = assertApprovedNotMutatedInPlace(previous, mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('MATERIAL_REVISION_REQUIRED');
  });

  it('non-material content change does not create a strategic revision', () => {
    const previous = mustApproved();
    const planned = planMaterialRevisionFromApproved({
      previous,
      now: LATER,
      nextInput: validDraftInput({ id: 'brief_2', createdAt: LATER, updatedAt: LATER }),
    });
    expect(planned.ok).toBe(false);
  });
});

describe('SPEC-003 Phase 1 — override contract', () => {
  it('requires auditable override fields including non-empty reason', () => {
    const brief = mustApproved();
    const valid: StrategicBriefOverrideRecord = {
      overrideId: 'ov_1',
      briefId: brief.id,
      briefVersion: brief.version,
      organizationId: brief.organizationId,
      clientId: brief.clientId,
      actorId: 'mgr_ana',
      reason: 'Manager chooses a tighter angle',
      previousState: toMaterialIdentity(brief),
      newState: toMaterialIdentity({ ...brief, strategicAngle: 'Tighter angle' }),
      materialFieldsChanged: ['strategicAngle'],
      timestamp: LATER,
    };
    expect(validateOverrideRecord(valid).ok).toBe(true);
    expect(validateOverrideRecord({ ...valid, reason: '' }).ok).toBe(false);
  });

  it('override cannot approve CONTESTED or UNROUTED', () => {
    const previous = mustDraft();
    const next = { ...mustApproved(), thesisId: previous.thesisId };
    const contested = assertOverridePreservesInvariants({
      previous,
      next,
      routing: { routingState: 'CONTESTED', governedThesisId: 'th_1' },
    });
    expect(contested.ok).toBe(false);
    const unrouted = assertOverridePreservesInvariants({
      previous,
      next,
      routing: { routingState: 'UNROUTED' },
    });
    expect(unrouted.ok).toBe(false);
  });

  it('override cannot change tenant envelope', () => {
    const previous = mustDraft();
    const next: StrategicBrief = { ...previous, clientId: 'other_client' };
    const result = assertOverridePreservesInvariants({
      previous,
      next,
      routing: CLEAR,
    });
    expect(result.ok).toBe(false);
  });
});

describe('SPEC-003 Phase 1 — evidence, history, determinism', () => {
  it('preserves supportingEvidenceIds without raw AI payload fields', () => {
    const brief = mustDraft({ supportingEvidenceIds: ['ev_1', 'ev_2'] });
    expect(brief.supportingEvidenceIds).toEqual(['ev_1', 'ev_2']);
    expect(brief).not.toHaveProperty('rawAiOutput');
    expect(brief.decision).not.toHaveProperty('prompt');
    expect(brief.decision).not.toHaveProperty('llmOutput');
  });

  it('history record preserves governed snapshot without generating ids from a clock', () => {
    const brief = mustApproved();
    const history = createBriefHistoryRecord({
      brief,
      actorId: 'mgr_ana',
      source: 'HUMAN',
      changeType: 'APPROVED',
      changedAt: LATER,
    });
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    expect(history.value.briefId).toBe(brief.id);
    expect(history.value.version).toBe(1);
    expect(history.value.materialFingerprint).toBe(briefMaterialFingerprint(brief));
  });

  it('same material inputs yield the same fingerprint and authorization', () => {
    const a = mustApproved(mustDraft());
    const b = mustApproved(mustDraft());
    expect(isSameMaterialIdentity(a, b)).toBe(true);
    expect(canAuthorizeStrategicDownstream(a)).toBe(canAuthorizeStrategicDownstream(b));
    expect(briefMaterialFingerprint(a)).toBe(briefMaterialFingerprint(b));
  });
});
