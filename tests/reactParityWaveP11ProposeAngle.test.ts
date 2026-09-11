/**
 * SPEC-010 · T603 React Parity Wave P11 — #15 ProposeAngle.
 *
 * Presentation parity only. Brief creation, #17 assembly, #22 score remain untouched.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const proposeCalls: {
  requestedClientId: string | null | undefined;
  curationEntryId: string;
}[] = [];
const decideCalls: unknown[] = [];
const addToDeliveryCalls: unknown[] = [];
const briefCreateCalls: unknown[] = [];
const removeCalls: unknown[] = [];
const reopenCalls: unknown[] = [];
const scoreCalls: unknown[] = [];
const auditCalls: { event: string }[] = [];

let proposeImpl:
  | ((intent: { curationEntryId: string }) => Promise<
      | { ok: true; usedLiveModel: boolean; angle: string }
      | { ok: false; compat: string }
    >)
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
  proposeAngle: (intent: {
    requestedClientId: string | null | undefined;
    curationEntryId: string;
  }) => {
    proposeCalls.push(intent);
    if (proposeImpl) return proposeImpl(intent);
    return Promise.resolve({ ok: true, usedLiveModel: true, angle: 'Angle from model' });
  },
  decideCuration: (intent: unknown) => {
    decideCalls.push(intent);
    return { entry: { id: 'cur_1', clientId: 'client_a' } };
  },
  addCurationToDelivery: (intent: unknown) => {
    addToDeliveryCalls.push(intent);
    return { ok: true };
  },
  removeCuration: (intent: unknown) => {
    removeCalls.push(intent);
    return { ok: true };
  },
  reopenCuration: (intent: unknown) => {
    reopenCalls.push(intent);
    return { ok: true };
  },
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
  createBriefFromCurationEntry: (intent: unknown) => {
    briefCreateCalls.push(intent);
    return { brief: { id: 'brief_1' } };
  },
  approveStrategicBrief: vi.fn(),
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
  proposeCalls.length = 0;
  decideCalls.length = 0;
  addToDeliveryCalls.length = 0;
  briefCreateCalls.length = 0;
  removeCalls.length = 0;
  reopenCalls.length = 0;
  scoreCalls.length = 0;
  auditCalls.length = 0;
  proposeImpl = null;
});

describe('P11 §2–§3 — #15 public input and boundaries', () => {
  it('consumer public input includes requestedClientId + curationEntryId only', () => {
    const consumer = read('src/services/executionDeliveryConsumer.ts');
    const block = consumer.match(/export async function proposeAngle[\s\S]*?^}/m);
    expect(block?.[0]).toMatch(/requestedClientId/);
    expect(block?.[0]).toMatch(/curationEntryId/);
    expect(block?.[0]).not.toMatch(/trusted:/);
    expect(block?.[0]).not.toMatch(/thesisId/);
  });

  it('frozen ProposeAngle Application input uses trusted context not caller thesis', () => {
    const app = read('src/application/executionDelivery/ProposeAngle.ts');
    expect(app).toMatch(/trusted: TrustedExecutionDeliveryContext/);
    expect(app).toMatch(/requireAdminRole/);
    expect(app).toMatch(/resolveThesisId/);
    expect(app).not.toMatch(/input\.thesisId/);
  });
});

describe('P11 §14–§15 — propose angle seam and hook', () => {
  it('ADMIN invokes ProposeAngle exactly once with scope-derived client id', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = await executionDeliveryCommands.proposeAngle({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_p11_1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toBe('Ángulo propuesto con modelo');
    expect(proposeCalls).toHaveLength(1);
    expect(proposeCalls[0]).toEqual({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_p11_1',
    });
    expect(JSON.stringify(proposeCalls[0])).not.toMatch(/trusted|actorRole|thesisId/);
    expect(auditCalls).toHaveLength(0);
    expect(briefCreateCalls).toHaveLength(0);
    expect(decideCalls).toHaveLength(0);
    expect(scoreCalls).toHaveLength(0);
  });

  it('local heuristic success uses exact legacy toast string', async () => {
    proposeImpl = async () => ({ ok: true, usedLiveModel: false, angle: 'Local angle' });
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = await executionDeliveryCommands.proposeAngle({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_p11_1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toBe('Ángulo propuesto con reglas locales');
  });

  it('THESIS_NOT_RESOLVED compat preserves exact legacy warning', async () => {
    proposeImpl = async () => ({ ok: false, compat: 'THESIS_NOT_RESOLVED' });
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = await executionDeliveryCommands.proposeAngle({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_p11_1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('warning');
      expect(result.message).toBe(
        'Routing must be resolved first — create a Strategic Brief or ensure CLEAR governed routing.'
      );
    }
  });

  it('CURATION_NOT_FOUND compat is silent without toast message', async () => {
    proposeImpl = async () => ({ ok: false, compat: 'CURATION_NOT_FOUND' });
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = await executionDeliveryCommands.proposeAngle({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_missing',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.silent).toBe(true);
  });

  it('consumer rejection surfaces warning message', async () => {
    proposeImpl = async () => {
      throw new Error('ACTOR_NOT_AUTHORIZED');
    };
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = await executionDeliveryCommands.proposeAngle({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_p11_1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('ACTOR_NOT_AUTHORIZED');
  });
});

describe('P11 §12–§13 — deliver read extension and UI predicate', () => {
  it('readWorkspaceDeliver exposes factual readyEntries without canProposeAngle', () => {
    const reads = code('src/ui/data/compatibilityReads.ts');
    expect(reads).toMatch(/readyEntries/);
    expect(reads).toMatch(/getReadyCurationByClient/);
    expect(reads).toMatch(/aiAngle/);
    expect(reads).not.toMatch(/canProposeAngle/);
  });

  it('DeliverPanel shows propose control only when aiAngle is absent on ready row', () => {
    const panel = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    const panelCode = code('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).toMatch(/useProposeAngle/);
    expect(panel).toMatch(/react-ws-ready-list/);
    expect(panel).toMatch(/react-ws-propose-angle-/);
    expect(panel).toMatch(/!entry\.aiAngle/);
    expect(panel).toMatch(/Pensando…/);
    expect(panel).toMatch(/Proponer ángulo/);
    expect(panel).not.toMatch(/react-ws-deliver-handoff/);
    expect(panel).not.toMatch(/montar el briefing/);
    expect(panel).not.toMatch(/actions=\{[^}]*proponer ángulo/);
    expect(panelCode).not.toMatch(/\bdbService\b/);
    expect(panelCode).not.toMatch(/\bproposeAngle\s*\(/);
    expect(panelCode).not.toMatch(/\bcreateBriefFromCurationEntry\s*\(/);
    expect(panelCode).not.toMatch(/addRecommendation|scoreAndRouteSignal/);
  });

  it('hooks invalidate compatibility queries after successful propose', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useProposeAngle/);
    const idx = hooks.indexOf('export function useProposeAngle');
    const block = hooks.slice(idx, idx + 900);
    expect(block).toMatch(/tenantInvalidationKey/);
    expect(block).not.toMatch(/\bdbService\b/);
  });

  it('command seam delegates to presentation composite without dbService or AI', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    expect(seam).toMatch(/runCurationProposeAnglePresentation/);
    expect(seam).not.toMatch(/\bdbService\b/);
    expect(seam).not.toMatch(/generateAngle|openai/);
  });

  it('presentation composite mirrors handleProposeAngleClick without #14/#17/#22', () => {
    const composite = read('src/services/curationProposeAnglePresentation.ts');
    expect(composite).toMatch(/proposeAngle/);
    expect(composite).toMatch(/THESIS_NOT_RESOLVED_MESSAGE/);
    expect(composite).toMatch(/Ángulo propuesto con modelo/);
    expect(composite).not.toMatch(/decideCuration|addCurationToDelivery/);
    expect(composite).not.toMatch(/createBriefFromCurationEntry/);
    expect(composite).not.toMatch(/auditService/);
    expect(composite).not.toMatch(/\bdbService\b/);
  });
});

describe('P11 §21–§25 — non-regression boundaries', () => {
  it('frozen ProposeAngle Application command remains unmodified shape', () => {
    const app = read('src/application/executionDelivery/ProposeAngle.ts');
    expect(app).toMatch(/THESIS_NOT_RESOLVED/);
    expect(app).toMatch(/resolveThesisId/);
    expect(app).not.toMatch(/SendDeliveryPackage|createBrief/);
  });

  it('legacy propose-angle handler rollback retained', () => {
    const legacy = read('src/ui/legacy/handlers/curationHandlers.ts');
    expect(legacy).toMatch(/handleProposeAngleClick/);
    expect(legacy).toMatch(/btn-suggest-angle/);
  });

  it('#14 decide presentation composite unchanged for propose calls', () => {
    const composite = read('src/services/curationDecidePresentation.ts');
    expect(composite).not.toMatch(/\bproposeAngle\b/);
  });

  it('React layer does not call #14 decide, Brief create consumer, #17, #18, or #22 from deliver panel', () => {
    const panel = code('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).not.toMatch(/\bdecideCuration\s*\(/);
    expect(panel).not.toMatch(/\bcreateBriefFromCurationEntry\s*\(/);
    expect(panel).not.toMatch(/ensureDraftDelivery|addCurationToDelivery/);
    expect(panel).not.toMatch(/sendDeliveryPackage\s*\(/);
    expect(panel).not.toMatch(/scoreAndRouteSignal|addRecommendation/);
  });
});
