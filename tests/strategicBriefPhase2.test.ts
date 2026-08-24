import { describe, expect, it } from 'vitest';
import {
  createApproveStrategicBrief,
  createAuthorizeStrategicDownstream,
  createCreateStrategicBrief,
  createOverrideStrategicBrief,
  createRejectStrategicBrief,
  createReviseStrategicBrief,
  StrategicBriefError,
  type BriefWriteUnit,
  type CreateStrategicBriefInput,
  type SignalStrategicContext,
  type StrategicBriefHistoryPort,
  type StrategicBriefRepository,
  type StrategicContextReader,
  type TrustedBriefActorContext,
} from '../src/application/strategicBrief';
import type { EvidenceTenantRef } from '../src/application/strategicBrief';
import type { StrategicBrief, StrategicBriefHistoryRecord } from '../src/domain/strategicBriefCore';

const NOW = '2026-08-24T18:00:00.000Z';
const LATER = '2026-08-24T19:00:00.000Z';

const TRUSTED: TrustedBriefActorContext = {
  actorId: 'mgr_ana',
  actorRole: 'ADMIN',
  organizationId: 'org_test',
  clientId: 'client_test',
  now: NOW,
};

function signalContext(overrides: Partial<SignalStrategicContext> = {}): SignalStrategicContext {
  return {
    organizationId: 'org_test',
    clientId: 'client_test',
    signalId: 'sig_1',
    routingState: 'CLEAR',
    governedThesisId: 'th_1',
    routingAlgorithmVersion: 'routing-v1',
    routingSource: 'AUTO',
    routedAt: NOW,
    scoringVersion: 'scoring-v1',
    totalScore: 82,
    priorityBand: 'HIGH',
    scoredAt: NOW,
    recommendedDisposition: 'SAVE',
    recommendedOutputFormat: 'ARTICLE',
    whyNow: { reason: 'NIST update', score: 15 },
    scoreSnapshotId: 'sc_1',
    routingSnapshotId: 'rt_1',
    evidenceIds: ['ev_1'],
    ...overrides,
  };
}

function createInput(overrides: Partial<CreateStrategicBriefInput> = {}): CreateStrategicBriefInput {
  return {
    trusted: TRUSTED,
    briefId: 'brief_1',
    signalIds: ['sig_1'],
    primaryAudience: 'General Counsel',
    geography: 'CO',
    territory: 'AI Governance',
    framework: 'Preventive narrative',
    strategicAngle: 'Board-ready NIST translation',
    supportingEvidenceIds: ['ev_1'],
    riskFlags: ['REGULATORY'],
    recommendedChannel: 'LINKEDIN',
    recommendedFormat: 'ARTICLE',
    CTA: 'Request diagnostic',
    authorizedAction: 'CREATE_CONTENT',
    decisionRationale: 'CLEAR thesis with timely signal.',
    ...overrides,
  };
}

function sorted(ids: readonly string[]): string[] {
  return [...ids].slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function buildHarness(opts?: {
  signals?: Record<string, SignalStrategicContext>;
  evidence?: Record<string, EvidenceTenantRef>;
  commitError?: Error;
}) {
  const signals = opts?.signals ?? { sig_1: signalContext() };
  const evidence = opts?.evidence ?? {
    ev_1: { evidenceId: 'ev_1', organizationId: 'org_test', clientId: 'client_test' },
  };
  const store = new Map<string, StrategicBrief>();
  const writeUnits: BriefWriteUnit[] = [];
  const historyEntries: StrategicBriefHistoryRecord[] = [];

  const briefs: StrategicBriefRepository = {
    getById(briefId, tenant) {
      const found = store.get(briefId);
      if (!found) return undefined;
      if (found.organizationId !== tenant.organizationId || found.clientId !== tenant.clientId) {
        return undefined;
      }
      return { ...found, decision: { ...found.decision }, signalIds: [...found.signalIds] };
    },
    findCurrentByScope(scope) {
      for (const brief of store.values()) {
        if (brief.organizationId !== scope.organizationId) continue;
        if (brief.clientId !== scope.clientId) continue;
        if (brief.thesisId !== scope.thesisId) continue;
        if (brief.status === 'SUPERSEDED') continue;
        if (sorted(brief.signalIds).join('|') !== sorted(scope.signalIds).join('|')) continue;
        return { ...brief, decision: { ...brief.decision }, signalIds: [...brief.signalIds] };
      }
      return undefined;
    },
    commitWriteUnit(unit) {
      if (opts?.commitError) throw opts.commitError;
      writeUnits.push(unit);
      for (const brief of unit.briefs) {
        store.set(brief.id, {
          ...brief,
          decision: { ...brief.decision },
          signalIds: [...brief.signalIds],
        });
      }
    },
  };

  const history: StrategicBriefHistoryPort = {
    append: (entry) => {
      historyEntries.push(entry);
    },
    appendOverride: () => undefined,
  };

  const context: StrategicContextReader = {
    getSignalContext: (id) => (signals[id] ? { ...signals[id] } : undefined),
    getEvidenceTenant: (id) => (evidence[id] ? { ...evidence[id] } : undefined),
  };

  const deps = { briefs, history, context };
  return {
    store,
    writeUnits,
    historyEntries,
    create: createCreateStrategicBrief(deps),
    approve: createApproveStrategicBrief(deps),
    reject: createRejectStrategicBrief(deps),
    revise: createReviseStrategicBrief(deps),
    override: createOverrideStrategicBrief(deps),
    authorize: createAuthorizeStrategicDownstream(deps),
    mutateSignal(id: string, patch: Partial<SignalStrategicContext>) {
      signals[id] = { ...signals[id], ...patch };
    },
  };
}

describe('SPEC-003 Phase 2 — CreateStrategicBrief', () => {
  it('CLEAR same tenant/thesis creates DRAFT and write intent', () => {
    const h = buildHarness();
    const result = h.create(createInput());
    expect(result.created).toBe(true);
    expect(result.brief.status).toBe('DRAFT');
    expect(result.brief.thesisId).toBe('th_1');
    expect(result.brief.approvedBy).toBeNull();
    expect(result.brief.decision.upstreamScoreRef.scoringVersion).toBe('scoring-v1');
    expect(h.writeUnits).toHaveLength(1);
  });

  it('CONTESTED fails closed with zero writes', () => {
    const h = buildHarness({
      signals: { sig_1: signalContext({ routingState: 'CONTESTED', governedThesisId: 'th_1' }) },
    });
    try {
      h.create(createInput());
      expect.fail('expected contested');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('ROUTING_CONTEXT_CONTESTED');
    }
    expect(h.writeUnits).toHaveLength(0);
  });

  it('UNROUTED fails closed with zero writes', () => {
    const h = buildHarness({
      signals: { sig_1: signalContext({ routingState: 'UNROUTED', governedThesisId: undefined }) },
    });
    try {
      h.create(createInput());
      expect.fail('expected unrouted');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('ROUTING_CONTEXT_UNROUTED');
    }
    expect(h.writeUnits).toHaveLength(0);
  });

  it('mixed thesis fails and does not split', () => {
    const h = buildHarness({
      signals: {
        sig_1: signalContext({ signalId: 'sig_1', governedThesisId: 'th_1' }),
        sig_2: signalContext({ signalId: 'sig_2', governedThesisId: 'th_2' }),
      },
      evidence: { ev_1: { evidenceId: 'ev_1', organizationId: 'org_test', clientId: 'client_test' } },
    });
    try {
      h.create(createInput({ signalIds: ['sig_1', 'sig_2'] }));
      expect.fail('expected mixed thesis');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('THESIS_CONTEXT_MISMATCH');
    }
    expect(h.writeUnits).toHaveLength(0);
  });

  it('cross-client signal fails before save', () => {
    const h = buildHarness({
      signals: { sig_1: signalContext({ clientId: 'other_client' }) },
    });
    try {
      h.create(createInput());
      expect.fail('expected tenant fail');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('TENANT_CONTEXT_INVALID');
    }
    expect(h.writeUnits).toHaveLength(0);
  });

  it('cross-org signal fails before save', () => {
    const h = buildHarness({
      signals: { sig_1: signalContext({ organizationId: 'org_other' }) },
    });
    try {
      h.create(createInput());
      expect.fail('expected org fail');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('TENANT_CONTEXT_INVALID');
    }
    expect(h.writeUnits).toHaveLength(0);
  });

  it('cross-client evidence fails before save', () => {
    const h = buildHarness({
      evidence: { ev_1: { evidenceId: 'ev_1', organizationId: 'org_test', clientId: 'other' } },
    });
    try {
      h.create(createInput());
      expect.fail('expected evidence tenant fail');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('TENANT_CONTEXT_INVALID');
    }
    expect(h.writeUnits).toHaveLength(0);
  });

  it('caller tenant spoof cannot override trusted context', () => {
    const h = buildHarness();
    try {
      h.create(createInput({ claimedClientId: 'spoof_client' }));
      expect.fail('expected spoof fail');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('TENANT_CONTEXT_INVALID');
    }
    expect(h.writeUnits).toHaveLength(0);
  });

  it('caller thesis spoof cannot override governed thesis', () => {
    const h = buildHarness();
    try {
      h.create(createInput({ claimedThesisId: 'th_hidden' }));
      expect.fail('expected thesis spoof fail');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('THESIS_CONTEXT_MISMATCH');
    }
    expect(h.writeUnits).toHaveLength(0);
  });

  it('missing signal fails closed', () => {
    const h = buildHarness({ signals: {} });
    try {
      h.create(createInput());
      expect.fail('expected missing signal');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('SIGNAL_NOT_FOUND');
    }
    expect(h.writeUnits).toHaveLength(0);
  });

  it('idempotent create returns existing DRAFT without a second write', () => {
    const h = buildHarness();
    const first = h.create(createInput());
    const second = h.create(createInput({ briefId: 'brief_dup' }));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.brief.id).toBe('brief_1');
    expect(h.writeUnits).toHaveLength(1);
  });
});

describe('SPEC-003 Phase 2 — ApproveStrategicBrief', () => {
  it('approves valid DRAFT with trusted actor metadata', () => {
    const h = buildHarness();
    h.create(createInput());
    const approved = h.approve({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      approvedBy: 'spoof_user',
    });
    expect(approved.brief.status).toBe('APPROVED');
    expect(approved.brief.approvedBy).toBe('mgr_ana');
    expect(approved.brief.approvedAt).toBe(LATER);
    expect(approved.alreadyApproved).toBe(false);
  });

  it('idempotent approve of current APPROVED does not duplicate history', () => {
    const h = buildHarness();
    h.create(createInput());
    h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
    const historyAfterFirst = h.historyEntries.length;
    const again = h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
    expect(again.alreadyApproved).toBe(true);
    expect(again.writeUnitCommitted).toBe(false);
    expect(h.historyEntries.length).toBe(historyAfterFirst);
  });

  it('stale routing (CONTESTED after create) fails closed', () => {
    const h = buildHarness();
    h.create(createInput());
    h.mutateSignal('sig_1', { routingState: 'CONTESTED' });
    try {
      h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
      expect.fail('expected stale routing fail');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('ROUTING_CONTEXT_CONTESTED');
    }
  });

  it('stale thesis mismatch fails closed', () => {
    const h = buildHarness();
    h.create(createInput());
    h.mutateSignal('sig_1', { governedThesisId: 'th_other' });
    try {
      h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
      expect.fail('expected thesis mismatch');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('THESIS_CONTEXT_MISMATCH');
    }
  });

  it('unauthorized actor cannot approve', () => {
    const h = buildHarness();
    h.create(createInput());
    try {
      h.approve({
        trusted: { ...TRUSTED, actorRole: 'CLIENT', actorId: 'client_user', now: LATER },
        briefId: 'brief_1',
      });
      expect.fail('expected actor fail');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('ACTOR_NOT_AUTHORIZED');
    }
  });
});

describe('SPEC-003 Phase 2 — RejectStrategicBrief', () => {
  it('rejects DRAFT and denies downstream', () => {
    const h = buildHarness();
    h.create(createInput());
    const rejected = h.reject({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      rejectionReason: 'Off territory',
    });
    expect(rejected.brief.status).toBe('REJECTED');
    const auth = h.authorize({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      requestedAction: 'CREATE_CONTENT',
    });
    expect(auth.authorized).toBe(false);
  });

  it('idempotent reject does not write again', () => {
    const h = buildHarness();
    h.create(createInput());
    h.reject({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1', rejectionReason: 'No' });
    const writes = h.writeUnits.length;
    const again = h.reject({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      rejectionReason: 'No again',
    });
    expect(again.alreadyRejected).toBe(true);
    expect(h.writeUnits.length).toBe(writes);
  });
});

describe('SPEC-003 Phase 2 — ReviseStrategicBrief', () => {
  it('material change to APPROVED supersedes prior and increments version', () => {
    const h = buildHarness();
    h.create(createInput());
    h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
    const revised = h.revise({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      fields: { strategicAngle: 'Revised angle after new evidence' },
    });
    expect(revised.revised).toBe(true);
    expect(revised.superseded?.status).toBe('SUPERSEDED');
    expect(revised.brief.status).toBe('DRAFT');
    expect(revised.brief.version).toBe(2);
    expect(h.store.get('brief_1')?.status).toBe('SUPERSEDED');
  });

  it('non-material timestamp/advisory-equivalent revise does not create a new version', () => {
    const h = buildHarness();
    h.create(createInput());
    h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
    const writes = h.writeUnits.length;
    const revised = h.revise({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      fields: {},
    });
    expect(revised.revised).toBe(false);
    expect(revised.brief.version).toBe(1);
    expect(h.writeUnits.length).toBe(writes);
  });
});

describe('SPEC-003 Phase 2 — OverrideStrategicBrief', () => {
  it('records auditable override and keeps result unapproved', () => {
    const h = buildHarness();
    h.create(createInput());
    const result = h.override({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      reason: 'Tighten the angle for the board',
      fields: { strategicAngle: 'Tighter board angle' },
    });
    expect(result.audit.reason).toBe('Tighten the angle for the board');
    expect(result.audit.actorId).toBe('mgr_ana');
    expect(result.brief.status).toBe('DRAFT');
    expect(result.writeUnitCommitted).toBe(true);
  });

  it('missing reason fails', () => {
    const h = buildHarness();
    h.create(createInput());
    try {
      h.override({
        trusted: { ...TRUSTED, now: LATER },
        briefId: 'brief_1',
        reason: '  ',
        fields: { strategicAngle: 'x' },
      });
      expect.fail('expected reason fail');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('OVERRIDE_INVALID');
    }
  });

  it('cannot override tenant via claimed client', () => {
    const h = buildHarness();
    h.create(createInput());
    try {
      h.override({
        trusted: { ...TRUSTED, now: LATER },
        briefId: 'brief_1',
        reason: 'move tenant',
        claimedClientId: 'other',
        fields: { strategicAngle: 'x' },
      });
      expect.fail('expected tenant fail');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('TENANT_CONTEXT_INVALID');
    }
  });

  it('cannot override CONTESTED into approval path', () => {
    const h = buildHarness();
    h.create(createInput());
    h.mutateSignal('sig_1', { routingState: 'CONTESTED' });
    try {
      h.override({
        trusted: { ...TRUSTED, now: LATER },
        briefId: 'brief_1',
        reason: 'force it',
        fields: { strategicAngle: 'Forced' },
      });
      expect.fail('expected contested fail');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('ROUTING_CONTEXT_CONTESTED');
    }
  });
});

describe('SPEC-003 Phase 2 — AuthorizeStrategicDownstream', () => {
  it('APPROVED current authorizes matching action only', () => {
    const h = buildHarness();
    h.create(createInput());
    h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
    const ok = h.authorize({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      requestedAction: 'CREATE_CONTENT',
    });
    expect(ok.authorized).toBe(true);
    const wrong = h.authorize({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      requestedAction: 'CREATE_TASK',
    });
    expect(wrong.authorized).toBe(false);
  });

  it('DRAFT / REJECTED / SUPERSEDED / wrong tenant are denied', () => {
    const h = buildHarness();
    h.create(createInput());
    expect(
      h.authorize({
        trusted: { ...TRUSTED, now: LATER },
        briefId: 'brief_1',
        requestedAction: 'CREATE_CONTENT',
      }).authorized
    ).toBe(false);

    h.reject({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1', rejectionReason: 'No' });
    expect(
      h.authorize({
        trusted: { ...TRUSTED, now: LATER },
        briefId: 'brief_1',
        requestedAction: 'CREATE_CONTENT',
      }).authorized
    ).toBe(false);

    const h2 = buildHarness();
    h2.create(createInput());
    h2.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
    h2.revise({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      fields: { strategicAngle: 'New' },
    });
    expect(
      h2.authorize({
        trusted: { ...TRUSTED, now: LATER },
        briefId: 'brief_1',
        requestedAction: 'CREATE_CONTENT',
      }).authorized
    ).toBe(false);

    const cross = h2.authorize({
      trusted: { ...TRUSTED, clientId: 'other', now: LATER },
      briefId: 'brief_1',
      requestedAction: 'CREATE_CONTENT',
    });
    expect(cross.authorized).toBe(false);
  });
});

describe('SPEC-003 Phase 2 — port failures and missing brief', () => {
  it('maps repository failure to PERSISTENCE_ERROR without leaking infrastructure', () => {
    const h = buildHarness({ commitError: new Error('Firestore unavailable') });
    try {
      h.create(createInput());
      expect.fail('expected persistence fail');
    } catch (err) {
      expect(err).toBeInstanceOf(StrategicBriefError);
      expect((err as StrategicBriefError).code).toBe('PERSISTENCE_ERROR');
      expect((err as StrategicBriefError).message).not.toMatch(/Firestore|Firebase|localStorage/i);
    }
  });

  it('missing brief is BRIEF_NOT_FOUND', () => {
    const h = buildHarness();
    try {
      h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'missing' });
      expect.fail('expected not found');
    } catch (err) {
      expect((err as StrategicBriefError).code).toBe('BRIEF_NOT_FOUND');
    }
  });
});
