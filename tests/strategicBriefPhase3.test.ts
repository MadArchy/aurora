import { describe, expect, it } from 'vitest';
import { StrategicBriefError } from '../src/application/strategicBrief';
import type { CreateStrategicBriefInput } from '../src/application/strategicBrief';
import { composeStrategicBrief } from '../src/composition/strategicBrief/composeStrategicBrief';
import {
  BRIEF_CURRENT_STORE_SCHEMA,
  BRIEF_HISTORY_STORE_SCHEMA,
  createLocalStrategicBriefStore,
  LocalStrategicBriefHistoryAdapter,
  LocalStrategicBriefRepository,
  LocalStrategicContextReader,
  STRATEGIC_BRIEF_CURRENT_STORE_KEY,
  STRATEGIC_BRIEF_HISTORY_STORE_KEY,
} from '../src/infrastructure/strategicBrief';
import type { EvidenceVaultItem, Signal } from '../src/types';

const NOW = '2026-08-24T18:00:00.000Z';
const LATER = '2026-08-24T19:00:00.000Z';

const TRUSTED = {
  actorId: 'mgr_ana',
  actorRole: 'ADMIN' as const,
  organizationId: 'org_test',
  clientId: 'client_test',
  now: NOW,
};

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig_1',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'NIST CSF 2.0',
    sourceType: 'NEWS_API',
    sourceName: 'NIST',
    contentSnippet: 'Framework update',
    fingerprint: 'fp_1',
    detectedAt: NOW,
    status: 'NEW',
    aiStatus: 'NOT_REQUIRED',
    managerDecision: 'UNREVIEWED',
    thesisId: 'th_1',
    routingDecision: {
      source: 'AUTO',
      routingState: 'CLEAR',
      algorithmVersion: 'routing-v1',
      routedAt: NOW,
    },
    scoringVersion: 'scoring-v1',
    relevanceScore: 82,
    priorityBand: 'HIGH',
    scoredAt: NOW,
    recommendedDisposition: 'SAVE',
    recommendedOutputFormat: 'ARTICLE',
    whyNow: { score: 15, band: 'NOW', reason: 'NIST update' },
    scoreRationale: 'governed score snapshot',
    ...overrides,
  };
}

function evidence(id = 'ev_1'): Pick<EvidenceVaultItem, 'id' | 'organizationId' | 'clientId'> {
  return { id, organizationId: 'org_test', clientId: 'client_test' };
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

function buildPhase3(opts?: {
  signals?: Record<string, Signal>;
  evidence?: Record<string, Pick<EvidenceVaultItem, 'id' | 'organizationId' | 'clientId'>>;
}) {
  const store = createLocalStrategicBriefStore();
  store.resetForTest();
  const signals = opts?.signals ?? { sig_1: makeSignal() };
  const vault = opts?.evidence ?? { ev_1: evidence() };
  const source = {
    getSignalById: (id: string) => signals[id],
    getEvidenceById: (id: string) => vault[id],
  };
  const useCases = composeStrategicBrief({ store, signals: source });
  return { store, signals, source, ...useCases };
}

function expectPersistenceError(fn: () => unknown): void {
  try {
    fn();
    expect.fail('expected persistence failure');
  } catch (err) {
    expect(err).toBeInstanceOf(StrategicBriefError);
    expect((err as StrategicBriefError).code).toBe('PERSISTENCE_ERROR');
    expect((err as Error).message).not.toMatch(/localStorage|QuotaExceeded|Firestore|indexedDB/i);
  }
}

describe('SPEC-003 Phase 3 — create / approve / reject persistence', () => {
  it('persists a governed CLEAR DRAFT with tenant/thesis/signal identity round-trip', () => {
    const h = buildPhase3();
    const result = h.create(createInput());
    expect(result.created).toBe(true);
    const loaded = h.store.getById('brief_1', TRUSTED);
    expect(loaded?.status).toBe('DRAFT');
    expect(loaded?.organizationId).toBe('org_test');
    expect(loaded?.clientId).toBe('client_test');
    expect(loaded?.thesisId).toBe('th_1');
    expect(loaded?.signalIds).toEqual(['sig_1']);
    expect(loaded?.schemaVersion).toBe('brief-v1');
    expect(loaded?.version).toBe(1);
    expect(loaded?.createdBy).toBe('mgr_ana');
    expect(loaded?.createdAt).toBe(NOW);
    expect(h.store.listHistory()).toHaveLength(1);
    expect(h.store.listHistory()[0].changeType).toBe('CREATED');
  });

  it('persists DRAFT → APPROVED exactly once and retries without duplicate history', () => {
    const h = buildPhase3();
    h.create(createInput());
    const first = h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
    expect(first.alreadyApproved).toBe(false);
    expect(h.store.getById('brief_1', TRUSTED)?.status).toBe('APPROVED');
    expect(h.store.getById('brief_1', TRUSTED)?.approvedBy).toBe('mgr_ana');
    expect(h.store.getById('brief_1', TRUSTED)?.approvedAt).toBe(LATER);
    const approvals = h.store.listHistory().filter((e) => e.changeType === 'APPROVED');
    expect(approvals).toHaveLength(1);

    const again = h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
    expect(again.alreadyApproved).toBe(true);
    expect(h.store.listHistory().filter((e) => e.changeType === 'APPROVED')).toHaveLength(1);
  });

  it('persists DRAFT → REJECTED exactly once and retries without duplicate transition', () => {
    const h = buildPhase3();
    h.create(createInput());
    const first = h.reject({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      rejectionReason: 'Angle too broad',
    });
    expect(first.alreadyRejected).toBe(false);
    expect(h.store.getById('brief_1', TRUSTED)?.status).toBe('REJECTED');
    expect(h.store.getById('brief_1', TRUSTED)?.rejectionReason).toBe('Angle too broad');
    expect(h.store.listHistory().filter((e) => e.changeType === 'REJECTED')).toHaveLength(1);

    const again = h.reject({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      rejectionReason: 'Angle too broad',
    });
    expect(again.alreadyRejected).toBe(true);
    expect(h.store.listHistory().filter((e) => e.changeType === 'REJECTED')).toHaveLength(1);
  });
});

describe('SPEC-003 Phase 3 — revision / override / non-material', () => {
  it('APPROVED v1 material revision keeps SUPERSEDED authority and DRAFT v2', () => {
    const h = buildPhase3();
    h.create(createInput());
    h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
    const revised = h.revise({
      trusted: { ...TRUSTED, now: '2026-08-24T20:00:00.000Z' },
      briefId: 'brief_1',
      fields: { strategicAngle: 'Revised board angle' },
    });
    expect(revised.revised).toBe(true);
    const prior = h.store.getById('brief_1', TRUSTED);
    expect(prior?.status).toBe('SUPERSEDED');
    expect(prior?.version).toBe(1);
    expect(prior?.strategicAngle).toBe('Board-ready NIST translation');
    expect(revised.brief.status).toBe('DRAFT');
    expect(revised.brief.version).toBe(2);
    const next = h.store.getById(revised.brief.id, TRUSTED);
    expect(next?.status).toBe('DRAFT');
    expect(next?.supersedesBriefId).toBe('brief_1');
    expect(h.store.listHistory().some((e) => e.changeType === 'SUPERSEDED')).toBe(true);
    expect(h.store.listHistory().some((e) => e.changeType === 'REVISED')).toBe(true);
  });

  it('persists governed override audit + material history and is retry-safe', () => {
    const h = buildPhase3();
    h.create(createInput());
    const first = h.override({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      reason: 'Tighten the angle for the board',
      fields: { strategicAngle: 'Tighter board angle' },
    });
    expect(first.writeUnitCommitted).toBe(true);
    expect(h.store.listOverrides()).toHaveLength(1);
    expect(h.store.listOverrides()[0].actorId).toBe('mgr_ana');
    expect(h.store.listOverrides()[0].reason).toBe('Tighten the angle for the board');
    expect(h.store.listHistory().filter((e) => e.changeType === 'OVERRIDDEN')).toHaveLength(1);

    h.store.commitWriteUnit({
      briefs: [first.brief],
      history: h.store.listHistory().filter((e) => e.changeType === 'OVERRIDDEN'),
      overrideAudit: first.audit,
    });
    expect(h.store.listOverrides()).toHaveLength(1);
    expect(h.store.listHistory().filter((e) => e.changeType === 'OVERRIDDEN')).toHaveLength(1);
  });

  it('non-material revise does not append strategic history', () => {
    const h = buildPhase3();
    h.create(createInput());
    h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
    const before = h.store.listHistory().length;
    const revised = h.revise({
      trusted: { ...TRUSTED, now: LATER },
      briefId: 'brief_1',
      fields: {},
    });
    expect(revised.revised).toBe(false);
    expect(h.store.listHistory()).toHaveLength(before);
    expect(h.store.getById('brief_1', TRUSTED)?.version).toBe(1);
    expect(h.store.getById('brief_1', TRUSTED)?.status).toBe('APPROVED');
  });
});

describe('SPEC-003 Phase 3 — tenant isolation', () => {
  it('foreign tenant read returns no Brief and foreign write is rejected', () => {
    const h = buildPhase3();
    h.create(createInput());
    expect(
      h.store.getById('brief_1', { organizationId: 'org_other', clientId: 'client_other' })
    ).toBeUndefined();
    expect(
      h.store.findCurrentByScope({
        organizationId: 'org_other',
        clientId: 'client_other',
        thesisId: 'th_1',
        signalIds: ['sig_1'],
      })
    ).toBeUndefined();

    const owned = h.store.getById('brief_1', TRUSTED);
    expect(owned).toBeDefined();
    const beforeBriefs = h.store.storedBriefCount();
    const beforeHistory = h.store.listHistory().length;
    const beforeOverrides = h.store.listOverrides().length;
    expect(() =>
      h.store.commitWriteUnit({
        briefs: [
          {
            ...owned!,
            organizationId: 'org_other',
            clientId: 'client_other',
          },
        ],
        history: [],
      })
    ).toThrow(StrategicBriefError);
    expect(h.store.storedBriefCount()).toBe(beforeBriefs);
    expect(h.store.listHistory()).toHaveLength(beforeHistory);
    expect(h.store.listOverrides()).toHaveLength(beforeOverrides);
  });

  it('rejects mixed-tenant write units with no partial local update', () => {
    const h = buildPhase3();
    const created = h.create(createInput());
    const before = h.store.getById('brief_1', TRUSTED);
    const history = h.store.listHistory()[0];
    expect(() =>
      h.store.commitWriteUnit({
        briefs: [created.brief],
        history: [{ ...history, organizationId: 'org_other', clientId: 'client_other' }],
      })
    ).toThrow(StrategicBriefError);
    expect(h.store.getById('brief_1', TRUSTED)).toEqual(before);
    expect(h.store.listHistory()).toHaveLength(1);
    expect(h.store.listOverrides()).toHaveLength(0);
  });
});

describe('SPEC-003 Phase 3 — StrategicContextReader adapter', () => {
  it('CLEAR signal returns governed thesis and routing projection', () => {
    const h = buildPhase3();
    const reader = new LocalStrategicContextReader(h.source);
    const projected = reader.getSignalContext('sig_1');
    expect(projected?.routingState).toBe('CLEAR');
    expect(projected?.governedThesisId).toBe('th_1');
    expect(projected?.routingAlgorithmVersion).toBe('routing-v1');
    expect(projected?.scoringVersion).toBe('scoring-v1');
    expect(projected?.totalScore).toBe(82);
    expect(projected?.priorityBand).toBe('HIGH');
    expect(projected?.recommendedDisposition).toBe('SAVE');
    expect(projected?.recommendedOutputFormat).toBe('ARTICLE');
    expect(projected?.whyNow).toEqual({ reason: 'NIST update', score: 15 });
  });

  it('CONTESTED returns CONTESTED and does not manufacture a thesis', () => {
    const signal = makeSignal({
      routingDecision: {
        source: 'AUTO',
        routingState: 'CONTESTED',
        algorithmVersion: 'routing-v1',
        contested: true,
      },
      thesisId: 'stale_th',
    });
    const h = buildPhase3({ signals: { sig_1: signal } });
    const reader = new LocalStrategicContextReader(h.source);
    const projected = reader.getSignalContext('sig_1');
    expect(projected?.routingState).toBe('CONTESTED');
    expect(projected?.governedThesisId).toBeUndefined();
  });

  it('UNROUTED returns UNROUTED with no legacy thesis fallback', () => {
    const unrouted = makeSignal({
      routingDecision: { source: 'AUTO', routingState: 'UNROUTED', algorithmVersion: 'routing-v1' },
      thesisId: 'stale_th',
    });
    const missing = makeSignal({
      routingDecision: { source: 'AUTO' },
      thesisId: 'legacy_th',
    });
    const h = buildPhase3({ signals: { sig_1: unrouted, sig_legacy: missing } });
    const reader = new LocalStrategicContextReader(h.source);
    expect(reader.getSignalContext('sig_1')?.routingState).toBe('UNROUTED');
    expect(reader.getSignalContext('sig_1')?.governedThesisId).toBeUndefined();
    expect(reader.getSignalContext('sig_legacy')?.routingState).toBe('UNROUTED');
    expect(reader.getSignalContext('sig_legacy')?.governedThesisId).toBeUndefined();
  });

  it('returns canonical SPEC-002 score projection without rescoring', () => {
    const h = buildPhase3();
    const reader = new LocalStrategicContextReader(h.source);
    const projected = reader.getSignalContext('sig_1');
    expect(projected?.scoringVersion).toBe('scoring-v1');
    expect(projected?.totalScore).toBe(82);
    expect(projected?.scoreRationale).toBe('governed score snapshot');
  });

  it('getEvidenceTenant validates ownership only', () => {
    const h = buildPhase3();
    const reader = new LocalStrategicContextReader(h.source);
    expect(reader.getEvidenceTenant('ev_1')).toEqual({
      evidenceId: 'ev_1',
      organizationId: 'org_test',
      clientId: 'client_test',
    });
    expect(reader.getEvidenceTenant('missing')).toBeUndefined();
  });
});

describe('SPEC-003 Phase 3 — serialization / malformed / retry / append-only', () => {
  it('round-trips every material StrategicBrief field', () => {
    const h = buildPhase3();
    h.create(
      createInput({
        aiAdvisoryRefs: [{ operation: 'SIGNAL_THESIS_EVAL', aiRunId: 'run_1', suggestedAngle: 'advisory only' }],
      })
    );
    h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
    const original = h.store.getById('brief_1', TRUSTED);
    expect(original).toBeDefined();
    const again = h.store.getById('brief_1', TRUSTED);
    expect(again).toEqual(original);
    expect(again?.decision.authorizedAction).toBe('CREATE_CONTENT');
    expect(again?.decision.upstreamRoutingRef.routingState).toBe('CLEAR');
    expect(again?.decision.upstreamScoreRef.scoringVersion).toBe('scoring-v1');
    expect(again?.decision.signalContextRefs[0].signalId).toBe('sig_1');
    expect(again?.decision.aiAdvisoryRefs?.[0].operation).toBe('SIGNAL_THESIS_EVAL');
    expect(again?.supportingEvidenceIds).toEqual(['ev_1']);
    expect(again?.approvedBy).toBe('mgr_ana');
    expect(again?.version).toBe(1);
    expect(again?.schemaVersion).toBe('brief-v1');
  });

  it('malformed persisted authority fails closed and does not reconstruct APPROVED', () => {
    const h = buildPhase3();
    h.create(createInput());
    const envelope = JSON.parse(localStorage.getItem(STRATEGIC_BRIEF_CURRENT_STORE_KEY) || '{}') as {
      schemaVersion: string;
      briefs: Array<Record<string, unknown>>;
    };
    envelope.briefs[0] = { ...envelope.briefs[0], status: 'APPROVED', approvedBy: null, schemaVersion: undefined };
    localStorage.setItem(STRATEGIC_BRIEF_CURRENT_STORE_KEY, JSON.stringify(envelope));
    const fresh = createLocalStrategicBriefStore();
    expectPersistenceError(() => fresh.getById('brief_1', TRUSTED));
  });

  it('unversioned current store is not silently normalized', () => {
    localStorage.setItem(STRATEGIC_BRIEF_CURRENT_STORE_KEY, JSON.stringify([{ id: 'brief_1', status: 'APPROVED' }]));
    const fresh = createLocalStrategicBriefStore();
    expectPersistenceError(() => fresh.getById('brief_1', TRUSTED));
  });

  it('retries an identical successful write unit without duplicating history or audit', () => {
    const h = buildPhase3();
    const created = h.create(createInput());
    const unit = {
      briefs: [created.brief],
      history: h.store.listHistory(),
    };
    h.store.commitWriteUnit(unit);
    h.store.commitWriteUnit(unit);
    expect(h.store.getById('brief_1', TRUSTED)).toEqual(created.brief);
    expect(h.store.listHistory()).toHaveLength(1);
  });

  it('history adapter production API is append-only', () => {
    const adapter = new LocalStrategicBriefHistoryAdapter(createLocalStrategicBriefStore());
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(adapter)).sort()).toEqual([
      'append',
      'appendOverride',
      'constructor',
    ]);
  });

  it('current projection is the operational authority and history remains separate', () => {
    const h = buildPhase3();
    h.create(createInput());
    const currentRaw = JSON.parse(localStorage.getItem(STRATEGIC_BRIEF_CURRENT_STORE_KEY) || '{}') as {
      schemaVersion: string;
      briefs: Array<Record<string, unknown>>;
    };
    const historyRaw = JSON.parse(localStorage.getItem(STRATEGIC_BRIEF_HISTORY_STORE_KEY) || '{}') as {
      schemaVersion: string;
      entries: unknown[];
    };
    expect(currentRaw.schemaVersion).toBe(BRIEF_CURRENT_STORE_SCHEMA);
    expect(historyRaw.schemaVersion).toBe(BRIEF_HISTORY_STORE_SCHEMA);
    expect(currentRaw.briefs[0].history).toBeUndefined();
    expect(Array.isArray(historyRaw.entries)).toBe(true);
    expect(historyRaw.entries).toHaveLength(1);
    const repo = new LocalStrategicBriefRepository(h.store);
    expect(repo.findCurrentByScope({
      organizationId: 'org_test',
      clientId: 'client_test',
      thesisId: 'th_1',
      signalIds: ['sig_1'],
    })?.id).toBe('brief_1');
  });
});
