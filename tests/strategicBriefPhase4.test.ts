import { describe, expect, it } from 'vitest';
import {
  curationDestinationToDownstreamAction,
  strategicDenialMessage,
} from '../src/domain/briefConsumerCore';
import { validateDeliveryForSend } from '../src/domain/deliveryCore';
import { createAuthorizeStrategicDownstream } from '../src/application/strategicBrief';
import { composeStrategicBrief } from '../src/composition/strategicBrief/composeStrategicBrief';
import { LocalStrategicBriefRepository, createLocalStrategicBriefStore } from '../src/infrastructure/strategicBrief';
import type { DeliveryPackage, Signal } from '../src/types';

const NOW = '2026-08-24T22:00:00.000Z';

const TRUSTED = {
  actorId: 'mgr_ana',
  actorRole: 'ADMIN' as const,
  organizationId: 'org_test',
  clientId: 'client_test',
  now: NOW,
};

function clearSignal(overrides: Partial<Signal> = {}): Signal {
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
    routingDecision: {
      source: 'AUTO',
      routingState: 'CLEAR',
      selectedThesisId: 'th_1',
      algorithmVersion: 'routing-v1',
      routedAt: NOW,
    },
    scoringVersion: 'scoring-v1',
    relevanceScore: 82,
    priorityBand: 'HIGH',
    recommendedDisposition: 'SAVE',
    recommendedOutputFormat: 'ARTICLE',
    whyNow: { score: 15, band: 'NOW', reason: 'NIST update' },
    scoreRationale: 'governed',
    ...overrides,
  };
}

function buildHarness() {
  const store = createLocalStrategicBriefStore();
  store.resetForTest();
  const signals = { getSignalById: () => clearSignal(), getEvidenceById: () => undefined };
  const uc = composeStrategicBrief({ store, signals });
  const authorize = createAuthorizeStrategicDownstream({ briefs: new LocalStrategicBriefRepository(store) });
  return { store, uc, authorize };
}

function draftPackage(items: DeliveryPackage['items']): DeliveryPackage {
  return {
    id: 'pkg_1',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'Briefing',
    strategicNote: '',
    periodLabel: 'Aug 2026',
    items,
    status: 'DRAFT',
    createdAt: NOW,
    createdBy: 'mgr',
  };
}

describe('SPEC-003 Phase 4 — consumer migration gates', () => {
  it('maps curation destinations to downstream authorization actions', () => {
    expect(curationDestinationToDownstreamAction('TASK_ARTICLE')).toBe('CREATE_CONTENT');
    expect(curationDestinationToDownstreamAction('OPPORTUNITY')).toBe('CREATE_OPPORTUNITY');
    expect(curationDestinationToDownstreamAction('EVIDENCE')).toBeUndefined();
  });

  it('blocks missing briefId at authorization boundary', () => {
    const h = buildHarness();
    const denied = h.authorize({
      trusted: TRUSTED,
      briefId: 'missing_brief',
      requestedAction: 'CREATE_CONTENT',
    });
    expect(denied.authorized).toBe(false);
    expect(denied.denialCode).toBe('BRIEF_NOT_FOUND');
  });

  it('blocks DRAFT Brief for content authorization', () => {
    const h = buildHarness();
    h.uc.create({
      trusted: TRUSTED,
      briefId: 'brief_draft',
      signalIds: ['sig_1'],
      primaryAudience: 'GC',
      geography: 'CO',
      territory: 'AI',
      framework: 'NIST',
      strategicAngle: 'Angle',
      supportingEvidenceIds: [],
      riskFlags: [],
      recommendedChannel: 'LINKEDIN',
      recommendedFormat: 'ARTICLE',
      CTA: 'CTA',
      authorizedAction: 'CREATE_CONTENT',
      decisionRationale: 'Test brief.',
    });
    const denied = h.authorize({
      trusted: TRUSTED,
      briefId: 'brief_draft',
      requestedAction: 'CREATE_CONTENT',
    });
    expect(denied.authorized).toBe(false);
  });

  it('authorizes APPROVED CREATE_CONTENT Brief only for matching action', () => {
    const h = buildHarness();
    h.uc.create({
      trusted: TRUSTED,
      briefId: 'brief_ok',
      signalIds: ['sig_1'],
      primaryAudience: 'GC',
      geography: 'CO',
      territory: 'AI',
      framework: 'NIST',
      strategicAngle: 'Angle',
      supportingEvidenceIds: [],
      riskFlags: [],
      recommendedChannel: 'LINKEDIN',
      recommendedFormat: 'ARTICLE',
      CTA: 'CTA',
      authorizedAction: 'CREATE_CONTENT',
      decisionRationale: 'Test brief.',
    });
    h.uc.approve({ trusted: { ...TRUSTED, now: NOW }, briefId: 'brief_ok' });

    const ok = h.authorize({
      trusted: TRUSTED,
      briefId: 'brief_ok',
      requestedAction: 'CREATE_CONTENT',
    });
    expect(ok.authorized).toBe(true);
    expect(ok.version).toBe(1);

    const wrong = h.authorize({
      trusted: TRUSTED,
      briefId: 'brief_ok',
      requestedAction: 'CREATE_TASK',
    });
    expect(wrong.authorized).toBe(false);
  });

  it('delivery send fails closed when strategic item lacks Brief authorization', () => {
    const pkg = draftPackage([
      {
        id: 'ditem_1',
        kind: 'TASK',
        refId: 'cur_1',
        title: 'Article task',
        rationale: 'Because',
      },
    ]);
    const result = validateDeliveryForSend(
      pkg,
      () => 'TASK_ARTICLE',
      { id: 'th_1' } as import('../src/types').PositioningThesis,
      () => ({
        ok: false,
        message: strategicDenialMessage('BRIEF_NOT_FOUND'),
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('BRIEF_DENIED');
  });
});
