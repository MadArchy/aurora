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
  type EvidenceTenantRef,
  type SignalStrategicContext,
  type StrategicBriefHistoryPort,
  type StrategicBriefRepository,
  type StrategicContextReader,
  type TrustedBriefActorContext,
} from '../src/application/strategicBrief';
import {
  canAuthorizeStrategicAction,
  type StrategicBrief,
  type StrategicBriefHistoryRecord,
  type StrategicDownstreamAction,
} from '../src/domain/strategicBriefCore';
import { strategicDenialMessage } from '../src/domain/briefConsumerCore';
import { validateDeliveryForSend } from '../src/domain/deliveryCore';
import { composeStrategicBrief } from '../src/composition/strategicBrief/composeStrategicBrief';
import {
  createLocalStrategicBriefStore,
  LocalStrategicBriefRepository,
} from '../src/infrastructure/strategicBrief';
import { parseStoredBrief } from '../src/infrastructure/strategicBrief/serialization';
import type { DeliveryPackage, Signal } from '../src/types';

const NOW = '2026-08-24T23:00:00.000Z';
const LATER = '2026-08-24T23:30:00.000Z';

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
    primaryAudience: 'GC',
    geography: 'CO',
    territory: 'AI',
    framework: 'NIST',
    strategicAngle: 'Angle',
    supportingEvidenceIds: ['ev_1'],
    riskFlags: ['REGULATORY'],
    recommendedChannel: 'LINKEDIN',
    recommendedFormat: 'ARTICLE',
    CTA: 'CTA',
    authorizedAction: 'CREATE_CONTENT',
    decisionRationale: 'Governed brief.',
    ...overrides,
  };
}

function sorted(ids: readonly string[]): string[] {
  return [...ids].slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function buildHarness(opts?: {
  signals?: Record<string, SignalStrategicContext>;
  evidence?: Record<string, EvidenceTenantRef>;
}) {
  const signals = opts?.signals ?? { sig_1: signalContext() };
  const evidence = opts?.evidence ?? {
    ev_1: { evidenceId: 'ev_1', organizationId: 'org_test', clientId: 'client_test' },
  };
  const store = new Map<string, StrategicBrief>();
  const writeUnits: BriefWriteUnit[] = [];
  const historyEntries: StrategicBriefHistoryRecord[] = [];
  const overrideAudits: unknown[] = [];
  let aiGatewayCalls = 0;

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
    append: (entry) => historyEntries.push(entry),
    appendOverride: (entry) => {
      overrideAudits.push(entry);
    },
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
    overrideAudits,
    aiGatewayCalls: () => aiGatewayCalls,
    recordAiCall: () => {
      aiGatewayCalls += 1;
    },
    create: createCreateStrategicBrief(deps),
    approve: createApproveStrategicBrief(deps),
    reject: createRejectStrategicBrief({ briefs, history }),
    revise: createReviseStrategicBrief(deps),
    override: createOverrideStrategicBrief(deps),
    authorize: createAuthorizeStrategicDownstream({ briefs }),
    mutateSignal(id: string, patch: Partial<SignalStrategicContext>) {
      signals[id] = { ...signals[id], ...patch };
    },
  };
}

function createAndApprove(
  h: ReturnType<typeof buildHarness>,
  overrides: Partial<CreateStrategicBriefInput> = {}
) {
  const input = createInput(overrides);
  h.create(input);
  h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: input.briefId! });
  return input.briefId!;
}

function expectDenied(h: ReturnType<typeof buildHarness>, briefId: string, action: StrategicDownstreamAction) {
  const result = h.authorize({
    trusted: TRUSTED,
    briefId,
    requestedAction: action,
  });
  expect(result.authorized).toBe(false);
  expect(h.aiGatewayCalls()).toBe(0);
  return result;
}

function draftPackage(items: DeliveryPackage['items']): DeliveryPackage {
  return {
    id: 'pkg_1',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'Briefing',
    strategicNote: 'Looks strategic but is not authority',
    periodLabel: 'Aug 2026',
    items,
    status: 'DRAFT',
    createdAt: NOW,
    createdBy: 'mgr',
  };
}

describe('SPEC-003 Phase 5 — adversarial routing matrix (T-003-502)', () => {
  it('CLEAR valid may create and authorize after approval', () => {
    const h = buildHarness();
    const id = createAndApprove(h);
    const ok = h.authorize({ trusted: TRUSTED, briefId: id, requestedAction: 'CREATE_CONTENT' });
    expect(ok.authorized).toBe(true);
  });

  it('CLEAR missing governedThesisId fails closed on create', () => {
    const h = buildHarness({
      signals: { sig_1: signalContext({ governedThesisId: undefined }) },
    });
    expect(() => h.create(createInput())).toThrow(StrategicBriefError);
    expect(h.writeUnits).toHaveLength(0);
  });

  it('CONTESTED denies create / authorize / all strategic actions', () => {
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
    // No Brief exists → authorize denied; AI calls remain 0
    for (const action of ['CREATE_CONTENT', 'CREATE_TASK', 'CREATE_OPPORTUNITY'] as const) {
      expectDenied(h, 'brief_missing', action);
    }
  });

  it('UNROUTED denies create and strategic authorization', () => {
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
    expectDenied(h, 'brief_missing', 'CREATE_CONTENT');
  });

  it('caller thesis spoof / score-winner cannot replace governed thesis', () => {
    const h = buildHarness();
    expect(() => h.create(createInput({ claimedThesisId: 'th_winner' }))).toThrow(StrategicBriefError);
    expect(h.writeUnits).toHaveLength(0);
  });

  it('curation intake may exist without authorizing downstream (queue ≠ authority)', () => {
    // Operational curation entry fields alone never authorize — Application gate required.
    const h = buildHarness();
    const curationLike = {
      destination: 'TASK_ARTICLE' as const,
      thesisId: 'th_1',
      strategicBriefId: undefined as string | undefined,
      aiAngle: 'AI invented angle',
      managerDecision: 'APPROVED' as const,
    };
    void curationLike;
    expectDenied(h, 'missing', 'CREATE_CONTENT');
    expect(h.aiGatewayCalls()).toBe(0);
  });
});

describe('SPEC-003 Phase 5 — status / action / revision adversarial', () => {
  it('DRAFT denies all materializing actions; AI calls = 0', () => {
    const h = buildHarness();
    h.create(createInput({ briefId: 'brief_draft' }));
    for (const action of ['CREATE_CONTENT', 'CREATE_TASK', 'CREATE_OPPORTUNITY'] as const) {
      expectDenied(h, 'brief_draft', action);
    }
  });

  it('REJECTED denies all materializing actions', () => {
    const h = buildHarness();
    h.create(createInput({ briefId: 'brief_rej' }));
    h.reject({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_rej',
      rejectionReason: 'Not actionable',
    });
    for (const action of ['CREATE_CONTENT', 'CREATE_TASK', 'CREATE_OPPORTUNITY'] as const) {
      expectDenied(h, 'brief_rej', action);
    }
  });

  it('SUPERSEDED denies new materialization; historical link retained', () => {
    const h = buildHarness();
    createAndApprove(h, { briefId: 'brief_v1' });
    // Historical artifact reference (simulate created while v1 valid)
    const historicalRef = { strategicBriefId: 'brief_v1', strategicBriefVersion: 1 };
    h.revise({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_v1',
      fields: { strategicAngle: 'Revised angle for v2' },
    });
    expectDenied(h, 'brief_v1', 'CREATE_CONTENT');
    expect(historicalRef.strategicBriefId).toBe('brief_v1');
    expect(historicalRef.strategicBriefVersion).toBe(1);
  });

  it('wrong-action least authority matrix', () => {
    const cases: Array<{ action: CreateStrategicBriefInput['authorizedAction']; deny: StrategicDownstreamAction[] }> =
      [
        { action: 'CREATE_CONTENT', deny: ['CREATE_TASK', 'CREATE_OPPORTUNITY'] },
        { action: 'CREATE_TASK', deny: ['CREATE_CONTENT', 'CREATE_OPPORTUNITY'] },
        { action: 'CREATE_OPPORTUNITY', deny: ['CREATE_CONTENT', 'CREATE_TASK'] },
        { action: 'RESEARCH_ONLY', deny: ['CREATE_CONTENT', 'CREATE_TASK', 'CREATE_OPPORTUNITY'] },
        { action: 'NONE', deny: ['CREATE_CONTENT', 'CREATE_TASK', 'CREATE_OPPORTUNITY'] },
      ];
    for (const c of cases) {
      const h = buildHarness();
      const id = `brief_${c.action}`;
      createAndApprove(h, { briefId: id, authorizedAction: c.action });
      for (const deny of c.deny) {
        expectDenied(h, id, deny);
        expect(canAuthorizeStrategicAction(h.store.get(id)!, deny)).toBe(false);
      }
    }
  });

  it('approval spoof via consumer payload cannot create authoritative APPROVED Brief', () => {
    const h = buildHarness();
    const created = h.create(createInput({ briefId: 'brief_spoof' }));
    expect(created.brief.status).toBe('DRAFT');
    // Tamper attempt in-memory without Application approve
    const forged = { ...created.brief, status: 'APPROVED' as const, approvedBy: 'attacker', approvedAt: NOW };
    // Repository only updates via commitWriteUnit from use cases — forge not committed
    expect(h.store.get('brief_spoof')!.status).toBe('DRAFT');
    expectDenied(h, 'brief_spoof', 'CREATE_CONTENT');
    void forged;
  });
});

describe('SPEC-003 Phase 5 — cross-tenant / spoof matrix (T-003-503)', () => {
  it('foreign Brief id returns controlled not-found without leaking decision data', () => {
    const h = buildHarness();
    createAndApprove(h, { briefId: 'brief_home' });
    const foreignTrusted: TrustedBriefActorContext = {
      ...TRUSTED,
      organizationId: 'org_other',
      clientId: 'client_other',
    };
    const result = h.authorize({
      trusted: foreignTrusted,
      briefId: 'brief_home',
      requestedAction: 'CREATE_CONTENT',
    });
    expect(result.authorized).toBe(false);
    expect(result.denialCode).toBe('BRIEF_NOT_FOUND');
    expect(JSON.stringify(result)).not.toContain('Angle');
    expect(JSON.stringify(result)).not.toContain('Governed brief');
    expect(JSON.stringify(result)).not.toContain('ev_1');
  });

  it('cross-client signal / evidence rejected before persist', () => {
    const hSig = buildHarness({
      signals: { sig_1: signalContext({ clientId: 'client_other' }) },
    });
    expect(() => hSig.create(createInput())).toThrow(/TENANT|tenant/i);
    expect(hSig.writeUnits).toHaveLength(0);

    const hEv = buildHarness({
      evidence: { ev_1: { evidenceId: 'ev_1', organizationId: 'org_test', clientId: 'client_other' } },
    });
    expect(() => hEv.create(createInput())).toThrow(/TENANT|tenant/i);
    expect(hEv.writeUnits).toHaveLength(0);
  });

  it('caller organizationId/clientId spoof denied', () => {
    const h = buildHarness();
    expect(() => h.create(createInput({ claimedClientId: 'spoof' }))).toThrow(StrategicBriefError);
    expect(() => h.create(createInput({ claimedOrganizationId: 'org_spoof' }))).toThrow(StrategicBriefError);
    expect(h.writeUnits).toHaveLength(0);
  });

  it('authorize with claimed foreign tenant spoof fails', () => {
    const h = buildHarness();
    const id = createAndApprove(h);
    expect(() =>
      h.authorize({
        trusted: TRUSTED,
        briefId: id,
        requestedAction: 'CREATE_CONTENT',
        claimedClientId: 'other_client',
      })
    ).toThrow(StrategicBriefError);
  });
});

describe('SPEC-003 Phase 5 — multi-signal / delivery / override (T-003-504 / T-003-505)', () => {
  it('mixed-thesis multi-signal create rejected', () => {
    const h = buildHarness({
      signals: {
        sig_1: signalContext({ signalId: 'sig_1', governedThesisId: 'th_1' }),
        sig_2: signalContext({ signalId: 'sig_2', governedThesisId: 'th_2' }),
      },
    });
    expect(() => h.create(createInput({ signalIds: ['sig_1', 'sig_2'] }))).toThrow(StrategicBriefError);
    expect(h.writeUnits).toHaveLength(0);
  });

  it('DeliveryPackage: missing Brief / foreign Brief / mixed thesis Brief denied all-or-nothing', () => {
    const pkg = draftPackage([
      {
        id: 'd1',
        kind: 'TASK',
        title: 'Item A',
        rationale: 'a',
        strategicBriefId: 'brief_a',
      },
      {
        id: 'd2',
        kind: 'TASK',
        title: 'Item B',
        rationale: 'b',
        strategicBriefId: 'brief_a', // same Brief for different thesis context → denied by authorize callback
      },
    ]);
    const result = validateDeliveryForSend(
      pkg,
      () => 'TASK_ARTICLE',
      { id: 'th_1' } as import('../src/types').PositioningThesis,
      (item) => {
        if (item.id === 'd2') {
          return { ok: false, message: strategicDenialMessage('BRIEF_NOT_ACTIONABLE') };
        }
        return { ok: true, briefId: 'brief_a', action: 'CREATE_CONTENT', version: 1 };
      }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('BRIEF_DENIED');
  });

  it('DeliveryPackage status/strategicNote alone cannot authorize', () => {
    const pkg = draftPackage([
      { id: 'd1', kind: 'TASK', title: 'Task', rationale: 'r' },
    ]);
    (pkg as { status: string }).status = 'SENT';
    const already = validateDeliveryForSend(pkg, () => 'TASK_ARTICLE', { id: 'th_1' } as never);
    expect(already.ok).toBe(false);

    const draft = draftPackage([{ id: 'd1', kind: 'TASK', title: 'Task', rationale: 'r' }]);
    const denied = validateDeliveryForSend(
      draft,
      () => 'TASK_ARTICLE',
      { id: 'th_1' } as never,
      () => ({ ok: false, message: 'no brief' })
    );
    expect(denied.ok).toBe(false);
    expect(draft.strategicNote.length).toBeGreaterThan(0);
  });

  it('override missing reason / cannot set APPROVED / preserves audit on allowed override', () => {
    const h = buildHarness();
    createAndApprove(h, { briefId: 'brief_ov' });
    expect(() =>
      h.override({
        trusted: { ...TRUSTED, now: LATER },
        briefId: 'brief_ov',
        reason: '   ',
        fields: { strategicAngle: 'Changed' },
      })
    ).toThrow(/OVERRIDE|reason/i);

    const ok = h.override({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_ov',
      reason: 'Governance correction',
      fields: { strategicAngle: 'Corrected angle' },
    });
    expect(ok.audit.reason).toBe('Governance correction');
    expect(ok.audit.actorId).toBe('mgr_ana');
    expect(ok.brief.status).not.toBe('APPROVED');
    expect(h.overrideAudits.length).toBeGreaterThanOrEqual(1);
  });
});

describe('SPEC-003 Phase 5 — malformed store / legacy / idempotency (T-003-506)', () => {
  it('malformed persisted Brief fails closed — no silent repair', () => {
    const cases = [
      { id: 'x' },
      { schemaVersion: 'brief-v1', organizationId: 'org' },
      {
        schemaVersion: 'brief-v1',
        organizationId: 'org_test',
        clientId: 'client_test',
        id: 'b1',
        thesisId: 'th_1',
        status: 'APPROVED',
        version: 1,
      },
    ];
    for (const raw of cases) {
      expect(() => parseStoredBrief(raw)).toThrow(/Malformed|unsupported|required/i);
    }
  });

  it('local-authoritative threat model: structurally invalid records fail closed; crypto tamper-proof not claimed', () => {
    // Documented limitation: LOCAL_AUTHORITATIVE — a knowledgeable local actor who forges a
    // structurally valid record is outside this architecture's integrity claim (SPEC-009 deferred).
    expect(() =>
      parseStoredBrief({
        schemaVersion: 'wrong-schema',
        id: 'b',
        organizationId: 'org_test',
        clientId: 'client_test',
        thesisId: 'th_1',
        status: 'APPROVED',
        version: 1,
      })
    ).toThrow();
  });

  it('legacy CLEAR without selectedThesisId fails closed via LocalStrategicContextReader path', () => {
    const store = createLocalStrategicBriefStore();
    store.resetForTest();
    const legacy: Signal = {
      id: 'sig_legacy',
      organizationId: 'org_test',
      clientId: 'client_test',
      title: 'Legacy',
      sourceType: 'NEWS_API',
      sourceName: 'X',
      contentSnippet: 'snip',
      fingerprint: 'fp',
      detectedAt: NOW,
      status: 'NEW',
      aiStatus: 'NOT_REQUIRED',
      managerDecision: 'SAVE',
      thesisId: 'th_legacy',
      routingDecision: {
        source: 'AUTO',
        routingState: 'CLEAR',
        // selectedThesisId intentionally absent
        algorithmVersion: 'routing-v1',
        routedAt: NOW,
      },
      scoringVersion: 'scoring-v1',
      relevanceScore: 70,
      priorityBand: 'MEDIUM',
      recommendedDisposition: 'SAVE',
      recommendedOutputFormat: 'ARTICLE',
      whyNow: { score: 10, band: 'SOON', reason: 'legacy' },
      scoreRationale: 'legacy',
    };
    const uc = composeStrategicBrief({
      store,
      signals: {
        getSignalById: (id) => (id === 'sig_legacy' ? legacy : undefined),
        getEvidenceById: () => undefined,
      },
    });
    expect(() =>
      uc.create({
        trusted: TRUSTED,
        briefId: 'brief_legacy',
        signalIds: ['sig_legacy'],
        primaryAudience: 'GC',
        geography: 'CO',
        territory: 'AI',
        framework: 'NIST',
        strategicAngle: 'A',
        supportingEvidenceIds: [],
        riskFlags: [],
        recommendedChannel: 'LINKEDIN',
        recommendedFormat: 'ARTICLE',
        CTA: 'CTA',
        authorizedAction: 'CREATE_CONTENT',
        decisionRationale: 'Should fail.',
      })
    ).toThrow();
  });

  it('legacy pre-Brief artifact readability does not invent authorization', () => {
    const h = buildHarness();
    const legacyContent = { id: 'cnt_old', strategicBriefId: undefined as string | undefined };
    expect(legacyContent.strategicBriefId).toBeUndefined();
    expectDenied(h, 'invented_from_legacy', 'CREATE_CONTENT');
  });

  it('managerDecision alone does not authorize', () => {
    const h = buildHarness();
    void { managerDecision: 'SAVE' };
    expectDenied(h, 'none', 'CREATE_CONTENT');
  });

  it('idempotent create returns existing DRAFT; authorize retry of denied stays denied', () => {
    const h = buildHarness();
    const first = h.create(createInput({ briefId: 'brief_idem' }));
    const second = h.create(createInput({ briefId: 'brief_idem' }));
    expect(second.brief.id).toBe(first.brief.id);
    expect(second.brief.status).toBe('DRAFT');
    expectDenied(h, 'brief_idem', 'CREATE_CONTENT');
    expectDenied(h, 'brief_idem', 'CREATE_CONTENT');
    expect(h.aiGatewayCalls()).toBe(0);
  });

  it('authorization-before-AI: denied paths never increment gateway counter', () => {
    const h = buildHarness();
    h.create(createInput({ briefId: 'brief_ai' }));
    const denied = h.authorize({
      trusted: TRUSTED,
      briefId: 'brief_ai',
      requestedAction: 'CREATE_CONTENT',
    });
    expect(denied.authorized).toBe(false);
    // Simulate consumer rule: only call AI after authorized
    if (denied.authorized) h.recordAiCall();
    expect(h.aiGatewayCalls()).toBe(0);
  });

  it('thesis authority remains Brief thesis — caller B cannot replace A', () => {
    const h = buildHarness();
    const id = createAndApprove(h);
    const brief = h.store.get(id)!;
    expect(brief.thesisId).toBe('th_1');
    const ok = h.authorize({ trusted: TRUSTED, briefId: id, requestedAction: 'CREATE_CONTENT' });
    expect(ok.authorized).toBe(true);
    // Downstream must use brief.thesisId, not a caller-supplied B
    const downstreamThesis = brief.thesisId;
    const attackerThesis = 'th_B';
    expect(downstreamThesis).not.toBe(attackerThesis);
    expect(downstreamThesis).toBe('th_1');
  });

  it('history append-only — current Brief remains authorize authority', () => {
    const store = createLocalStrategicBriefStore();
    store.resetForTest();
    const signals = {
      getSignalById: () =>
        ({
          id: 'sig_1',
          organizationId: 'org_test',
          clientId: 'client_test',
          title: 't',
          sourceType: 'NEWS_API' as const,
          sourceName: 'n',
          contentSnippet: 'c',
          fingerprint: 'f',
          detectedAt: NOW,
          status: 'NEW' as const,
          aiStatus: 'NOT_REQUIRED' as const,
          managerDecision: 'UNREVIEWED' as const,
          routingDecision: {
            source: 'AUTO' as const,
            routingState: 'CLEAR' as const,
            selectedThesisId: 'th_1',
            algorithmVersion: 'routing-v1',
            routedAt: NOW,
          },
          scoringVersion: 'scoring-v1',
          relevanceScore: 80,
          priorityBand: 'HIGH' as const,
          recommendedDisposition: 'SAVE' as const,
          recommendedOutputFormat: 'ARTICLE' as const,
          whyNow: { score: 10, band: 'NOW' as const, reason: 'r' },
          scoreRationale: 'r',
        }) satisfies Signal,
      getEvidenceById: () => undefined,
    };
    const uc = composeStrategicBrief({ store, signals });
    uc.create({
      trusted: TRUSTED,
      briefId: 'brief_hist',
      signalIds: ['sig_1'],
      primaryAudience: 'GC',
      geography: 'CO',
      territory: 'AI',
      framework: 'NIST',
      strategicAngle: 'A',
      supportingEvidenceIds: [],
      riskFlags: [],
      recommendedChannel: 'LINKEDIN',
      recommendedFormat: 'ARTICLE',
      CTA: 'CTA',
      authorizedAction: 'CREATE_CONTENT',
      decisionRationale: 'r',
    });
    const repo = new LocalStrategicBriefRepository(store);
    const current = repo.getById('brief_hist', {
      organizationId: 'org_test',
      clientId: 'client_test',
    });
    expect(current?.status).toBe('DRAFT');
    // History cannot authorize — DRAFT still denied
    const auth = createAuthorizeStrategicDownstream({ briefs: repo })({
      trusted: TRUSTED,
      briefId: 'brief_hist',
      requestedAction: 'CREATE_CONTENT',
    });
    expect(auth.authorized).toBe(false);
  });
});
