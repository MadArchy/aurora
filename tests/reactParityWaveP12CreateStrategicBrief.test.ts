/**
 * SPEC-010 · T603 React Parity Wave P12 — CR-2 createBriefFromCurationEntry.
 *
 * Presentation parity only. #14 decide, #15 propose, Brief approval, #17 assembly,
 * #18 send, #22 score remain untouched.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const briefCreateCalls: {
  curationEntryId: string;
  destination: string;
  briefId?: string;
}[] = [];
const proposeCalls: unknown[] = [];
const decideCalls: unknown[] = [];
const approveCalls: unknown[] = [];
const scoreCalls: unknown[] = [];
const auditCalls: { event: string }[] = [];

let briefCreateImpl:
  | ((intent: { curationEntryId: string; destination: string }) => {
      brief: { id: string };
      created: boolean;
    })
  | null = null;

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => ({
      id: 'user_admin_01',
      role: 'ADMIN',
      organizationId: 'org_a',
    }),
  },
}));

vi.mock('../src/services/audit', () => ({
  auditService: {
    log: (_user: unknown, event: string) => {
      auditCalls.push({ event });
    },
  },
}));

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  proposeAngle: (intent: unknown) => {
    proposeCalls.push(intent);
    return Promise.resolve({ ok: true, usedLiveModel: true, angle: 'Angle' });
  },
  decideCuration: (intent: unknown) => {
    decideCalls.push(intent);
    return { entry: { id: 'cur_1', clientId: 'client_a' } };
  },
  addCurationToDelivery: vi.fn(),
  removeCuration: vi.fn(),
  reopenCuration: vi.fn(),
  assignClientTask: vi.fn(),
  cancelClientTask: vi.fn(),
  sendDeliveryPackage: vi.fn(),
  acknowledgeDelivery: vi.fn(),
  reviewClientArticle: vi.fn(),
  saveContentDraft: vi.fn(),
  transitionClientTask: vi.fn(),
  createContentDraft: vi.fn(),
  addSignalToCuration: vi.fn(),
}));

vi.mock('../src/services/strategicBriefConsumer', () => ({
  createBriefFromCurationEntry: (intent: {
    curationEntryId: string;
    destination: string;
    briefId?: string;
  }) => {
    briefCreateCalls.push(intent);
    if (briefCreateImpl) return briefCreateImpl(intent);
    return { brief: { id: 'brief_p12_1' }, created: true };
  },
  approveStrategicBrief: (intent: unknown) => {
    approveCalls.push(intent);
    return { id: 'brief_approved' };
  },
}));

vi.mock('../src/composition/strategicSignalRouting/composeStrategicSignalRouting', () => ({
  createStrategicSignalRoutingUseCases: () => ({
    scoreAndRouteSignal: (input: unknown) => {
      scoreCalls.push(input);
      return { scoreResult: { totalScore: 55 } };
    },
  }),
}));

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

beforeEach(() => {
  briefCreateCalls.length = 0;
  proposeCalls.length = 0;
  decideCalls.length = 0;
  approveCalls.length = 0;
  scoreCalls.length = 0;
  auditCalls.length = 0;
  briefCreateImpl = null;
});

describe('P12 §1–§3 — CR-2 public input and destination authority', () => {
  it('frozen consumer public input keys are curationEntryId, destination, optional briefId, now', () => {
    const consumer = read('src/services/strategicBriefConsumer.ts');
    const block = consumer.match(/export function createBriefFromCurationEntry[\s\S]*?^}/m);
    expect(block?.[0]).toMatch(/curationEntryId/);
    expect(block?.[0]).toMatch(/destination/);
    expect(block?.[0]).toMatch(/briefId\?:/);
    expect(block?.[0]).toMatch(/now\?:/);
    expect(block?.[0]).not.toMatch(/requestedClientId/);
    expect(block?.[0]).not.toMatch(/thesisId/);
  });

  it('legacy caller passes curationEntryId and data-destination from entry row', () => {
    const legacy = read('src/ui/legacy/handlers/curationHandlers.ts');
    expect(legacy).toMatch(/createBriefFromCurationEntry\(\{\s*curationEntryId:\s*curationId,\s*destination\s*\}/);
    expect(legacy).toMatch(/data-destination/);
  });

  it('destination mapping allows Brief-producing destinations only', () => {
    const mapping = read('src/domain/briefConsumerCore.ts');
    expect(mapping).toMatch(/TASK_VIDEO/);
    expect(mapping).toMatch(/TASK_ARTICLE/);
    expect(mapping).toMatch(/OPPORTUNITY/);
    expect(mapping).toMatch(/REFERENCE_READING/);
    expect(mapping).toMatch(/default:\s*return undefined/);
  });
});

describe('P12 §16–§17 — command seam and hook', () => {
  it('createFromCuration invokes CR-2 exactly once with factual destination from read row', async () => {
    const { briefCommands } = await import('../src/ui/commands/commandSeam');
    const result = briefCommands.createFromCuration({
      curationEntryId: 'cur_p12_1',
      destination: 'TASK_ARTICLE',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toBe('Strategic Brief DRAFT created (brief_p12_1).');
      expect(result.briefId).toBe('brief_p12_1');
    }
    expect(briefCreateCalls).toHaveLength(1);
    expect(briefCreateCalls[0]).toEqual({
      curationEntryId: 'cur_p12_1',
      destination: 'TASK_ARTICLE',
    });
    expect(JSON.stringify(briefCreateCalls[0])).not.toMatch(/thesisId|requestedClientId|trusted/);
    expect(auditCalls).toHaveLength(0);
    expect(proposeCalls).toHaveLength(0);
    expect(decideCalls).toHaveLength(0);
    expect(approveCalls).toHaveLength(0);
    expect(scoreCalls).toHaveLength(0);
  });

  it('consumer rejection surfaces exact legacy warning message', async () => {
    briefCreateImpl = () => {
      throw new Error('This curation destination does not require a Strategic Brief.');
    };
    const { briefCommands } = await import('../src/ui/commands/commandSeam');
    const result = briefCommands.createFromCuration({
      curationEntryId: 'cur_evidence',
      destination: 'EVIDENCE',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('This curation destination does not require a Strategic Brief.');
      expect(result.kind).toBe('warning');
    }
  });

  it('generic failure uses Could not create Strategic Brief fallback', async () => {
    briefCreateImpl = () => {
      throw 'not-an-error';
    };
    const { briefCommands } = await import('../src/ui/commands/commandSeam');
    const result = briefCommands.createFromCuration({
      curationEntryId: 'cur_p12_1',
      destination: 'TASK_ARTICLE',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('Could not create Strategic Brief.');
  });

  it('idempotent repeat still uses exact legacy success toast string', async () => {
    briefCreateImpl = () => ({ brief: { id: 'brief_existing' }, created: false });
    const { briefCommands } = await import('../src/ui/commands/commandSeam');
    const result = briefCommands.createFromCuration({
      curationEntryId: 'cur_p12_1',
      destination: 'OPPORTUNITY',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toBe('Strategic Brief DRAFT created (brief_existing).');
  });

  it('hooks invalidate compatibility and canonical queries after successful create', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useCreateBriefFromCuration/);
    const idx = hooks.indexOf('export function useCreateBriefFromCuration');
    const block = hooks.slice(idx, idx + 1100);
    expect(block).toMatch(/tenantInvalidationKey/);
    expect(block).toMatch(/canonical/);
    expect(block).not.toMatch(/\bdbService\b/);
  });

  it('command seam delegates to presentation composite without dbService', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    expect(seam).toMatch(/runBriefCreateFromCurationPresentation/);
    expect(seam).toMatch(/createFromCuration/);
    expect(seam).not.toMatch(/\bdbService\b/);
    expect(seam).not.toMatch(/createBriefFromCurationEntry/);
  });
});

describe('P12 §14–§15 — deliver read seam and UI predicate', () => {
  it('readWorkspaceDeliver exposes factual readyEntries destination and strategicBriefId', () => {
    const reads = code('src/ui/data/compatibilityReads.ts');
    expect(reads).toMatch(/readyEntries/);
    expect(reads).toMatch(/destination/);
    expect(reads).toMatch(/strategicBriefId/);
    expect(reads).not.toMatch(/canCreateBrief/);
  });

  it('DeliverPanel shows create-brief control only when Brief-eligible and no strategicBriefId', () => {
    const panel = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).toMatch(/useCreateBriefFromCuration/);
    expect(panel).toMatch(/react-ws-create-brief-/);
    expect(panel).toMatch(/curationDestinationToAuthorizedAction/);
    expect(panel).toMatch(/!entry\.strategicBriefId/);
    expect(panel).toMatch(/Create Strategic Brief DRAFT/);
    expect(panel).toMatch(/actions=\{\['montar el briefing'\]\}/);
    expect(panel).not.toMatch(/actions=\{[^}]*crear el Strategic Brief/);
    expect(panel).not.toMatch(/\bdbService\b/);
    expect(panel).not.toMatch(/\bcreateBriefFromCurationEntry\s*\(/);
    expect(panel).not.toMatch(/addRecommendation|scoreAndRouteSignal/);
  });

  it('React passes factual destination from read row into create hook (no caller destination picker)', () => {
    const panel = code('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).toMatch(/briefDestination = entry\.destination as CurationDestination/);
    expect(panel).toMatch(/onCreateBrief\(entry\.id,\s*briefDestination!/);
  });
});

describe('P12 §21–§27 — non-regression boundaries', () => {
  it('presentation composite mirrors legacy create-brief handler without #14/#15/#17/#22', () => {
    const composite = read('src/services/briefCreateFromCurationPresentation.ts');
    expect(composite).toMatch(/createBriefFromCurationEntry/);
    expect(composite).toMatch(/Strategic Brief DRAFT created/);
    expect(composite).toMatch(/Could not create Strategic Brief/);
    expect(composite).not.toMatch(/decideCuration|proposeAngle|addCurationToDelivery/);
    expect(composite).not.toMatch(/auditService/);
    expect(composite).not.toMatch(/\bdbService\b/);
    expect(composite).not.toMatch(/scoreAndRouteSignal|addRecommendation/);
  });

  it('legacy create-brief handler rollback retained', () => {
    const legacy = read('src/ui/legacy/handlers/curationHandlers.ts');
    expect(legacy).toMatch(/btn-create-strategic-brief/);
    expect(legacy).toMatch(/createBriefFromCurationEntry/);
  });

  it('#14 decide and #15 propose composites unchanged for brief create calls', () => {
    const decideComposite = read('src/services/curationDecidePresentation.ts');
    const proposeComposite = read('src/services/curationProposeAnglePresentation.ts');
    expect(decideComposite).not.toMatch(/\bcreateBriefFromCurationEntry\b/);
    expect(proposeComposite).not.toMatch(/\bcreateBriefFromCurationEntry\b/);
  });

  it('React deliver panel does not call #14 decide, #15 propose, approval, #17, #18, or #22', () => {
    const panel = code('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).not.toMatch(/\bdecideCuration\s*\(/);
    expect(panel).not.toMatch(/\bproposeAngle\s*\(/);
    expect(panel).not.toMatch(/\bcreateBriefFromCurationEntry\s*\(/);
    expect(panel).not.toMatch(/ensureDraftDelivery|addCurationToDelivery/);
    expect(panel).not.toMatch(/sendDeliveryPackage\s*\(/);
    expect(panel).not.toMatch(/scoreAndRouteSignal|addRecommendation/);
  });
});
