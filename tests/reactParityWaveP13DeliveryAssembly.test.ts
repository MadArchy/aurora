/**
 * SPEC-010 · T603 React Parity Wave P13 — Registry #17 Delivery Assembly.
 *
 * Presentation parity only. Frozen B4 consumers, #14/#15/CR-2/Brief approve/#18/#22 untouched.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ensureCalls: unknown[] = [];
const addCalls: unknown[] = [];
const metadataCalls: unknown[] = [];
const removeCalls: unknown[] = [];
const discardCalls: unknown[] = [];
const decideCalls: unknown[] = [];
const proposeCalls: unknown[] = [];
const briefCreateCalls: unknown[] = [];
const sendCalls: unknown[] = [];
const scoreCalls: unknown[] = [];

let ensureImpl: (() => { package: { id: string }; created: boolean }) | null = null;
let addImpl: (() => { ok: boolean; package?: { id: string } }) | null = null;
let metadataImpl: (() => { updated: boolean }) | null = null;
let removeImpl: (() => { removed: boolean }) | null = null;
let discardImpl: (() => { discarded: boolean }) | null = null;

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
  auditService: { log: vi.fn() },
}));

vi.mock('../src/services/strategicBriefConsumer', () => ({
  createBriefFromCurationEntry: (intent: unknown) => {
    briefCreateCalls.push(intent);
    return { brief: { id: 'brief_1' }, created: true };
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

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  ensureDraftDelivery: (intent: unknown) => {
    ensureCalls.push(intent);
    if (ensureImpl) return ensureImpl();
    return { package: { id: 'pkg_draft_1' }, created: true };
  },
  addCurationToDelivery: (intent: unknown) => {
    addCalls.push(intent);
    if (addImpl) return addImpl();
    return { ok: true, package: { id: 'pkg_draft_1' } };
  },
  updateDeliveryPackageMetadata: (intent: unknown) => {
    metadataCalls.push(intent);
    if (metadataImpl) return metadataImpl();
    return { updated: true };
  },
  removeDeliveryItemFromDelivery: (intent: unknown) => {
    removeCalls.push(intent);
    if (removeImpl) return removeImpl();
    return { removed: true };
  },
  discardDraftDelivery: (intent: unknown) => {
    discardCalls.push(intent);
    if (discardImpl) return discardImpl();
    return { discarded: true };
  },
  decideCuration: (intent: unknown) => {
    decideCalls.push(intent);
    return { entry: { id: 'cur_1', clientId: 'client_a' } };
  },
  proposeAngle: (intent: unknown) => {
    proposeCalls.push(intent);
    return Promise.resolve({ ok: true, usedLiveModel: true, angle: 'Angle' });
  },
  sendDeliveryPackage: (intent: unknown) => {
    sendCalls.push(intent);
    return Promise.resolve({
      packageId: 'pkg_draft_1',
      clientId: 'client_a',
      itemCount: 1,
      createdTasks: 0,
    });
  },
  removeCuration: vi.fn(),
  reopenCuration: vi.fn(),
  assignClientTask: vi.fn(),
  cancelClientTask: vi.fn(),
  acknowledgeDelivery: vi.fn(),
  reviewClientArticle: vi.fn(),
  saveContentDraft: vi.fn(),
  transitionClientTask: vi.fn(),
  createContentDraft: vi.fn(),
  addSignalToCuration: vi.fn(),
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
  ensureCalls.length = 0;
  addCalls.length = 0;
  metadataCalls.length = 0;
  removeCalls.length = 0;
  discardCalls.length = 0;
  decideCalls.length = 0;
  proposeCalls.length = 0;
  briefCreateCalls.length = 0;
  sendCalls.length = 0;
  scoreCalls.length = 0;
  ensureImpl = null;
  addImpl = null;
  metadataImpl = null;
  removeImpl = null;
  discardImpl = null;
});

describe('P13 §3 — frozen B4 public inputs', () => {
  it('EnsureDraftDelivery keys are requestedClientId and optional claims only', () => {
    const consumer = read('src/services/executionDeliveryConsumer.ts');
    const block = consumer.match(/export function ensureDraftDelivery[\s\S]*?^}/m);
    expect(block?.[0]).toMatch(/requestedClientId/);
    expect(block?.[0]).toMatch(/claimedOrganizationId\?:/);
    expect(block?.[0]).toMatch(/claimedClientId\?:/);
    expect(block?.[0]).not.toMatch(/packageId/);
  });

  it('AddCurationToDelivery keys are requestedClientId, curationEntryId, optional claims', () => {
    const consumer = read('src/services/executionDeliveryConsumer.ts');
    const block = consumer.match(/export function addCurationToDelivery[\s\S]*?^}/m);
    expect(block?.[0]).toMatch(/curationEntryId/);
    expect(block?.[0]).not.toMatch(/packageId/);
  });

  it('UpdateDeliveryPackageMetadata keys include packageId, title, strategicNote', () => {
    const consumer = read('src/services/executionDeliveryConsumer.ts');
    const block = consumer.match(/export function updateDeliveryPackageMetadata[\s\S]*?^}/m);
    expect(block?.[0]).toMatch(/packageId/);
    expect(block?.[0]).toMatch(/title/);
    expect(block?.[0]).toMatch(/strategicNote/);
  });

  it('RemoveDeliveryItemFromDelivery keys include packageId and itemId', () => {
    const consumer = read('src/services/executionDeliveryConsumer.ts');
    const block = consumer.match(/export function removeDeliveryItemFromDelivery[\s\S]*?^}/m);
    expect(block?.[0]).toMatch(/packageId/);
    expect(block?.[0]).toMatch(/itemId/);
  });

  it('DiscardDraftDelivery keys are requestedClientId, packageId, optional claims', () => {
    const consumer = read('src/services/executionDeliveryConsumer.ts');
    const block = consumer.match(/export function discardDraftDelivery[\s\S]*?^}/m);
    expect(block?.[0]).toMatch(/packageId/);
    expect(block?.[0]).not.toMatch(/itemId/);
  });
});

describe('P13 §15–§16 — presentation seam and hooks', () => {
  it('ensureDraftDelivery invokes frozen consumer exactly once with legacy toast', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.ensureDraftDelivery({
      requestedClientId: 'client_a',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toBe('Briefing creado. Añade los ítems curados.');
      expect(result.packageId).toBe('pkg_draft_1');
    }
    expect(ensureCalls).toHaveLength(1);
    expect(ensureCalls[0]).toEqual({ requestedClientId: 'client_a' });
    expect(addCalls).toHaveLength(0);
    expect(decideCalls).toHaveLength(0);
    expect(proposeCalls).toHaveLength(0);
    expect(briefCreateCalls).toHaveLength(0);
    expect(sendCalls).toHaveLength(0);
    expect(scoreCalls).toHaveLength(0);
  }, 15_000);

  it('ensure idempotency surfaces same success toast', async () => {
    ensureImpl = () => ({ package: { id: 'pkg_existing' }, created: false });
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.ensureDraftDelivery({
      requestedClientId: 'client_a',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(false);
      expect(result.message).toBe('Briefing creado. Añade los ítems curados.');
    }
  });

  it('addCurationToDelivery success mirrors legacy toast', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.addCurationToDelivery({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toBe('Añadido al briefing');
    expect(addCalls).toHaveLength(1);
    expect(addCalls[0]).toEqual({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_1',
    });
  });

  it('add duplicate/ineligible mirrors legacy info message', async () => {
    addImpl = () => ({ ok: false });
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.addCurationToDelivery({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_dup',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('Ese ítem ya está en un briefing.');
      expect(result.kind).toBe('info');
    }
  });

  it('updateDeliveryPackageMetadata success mirrors legacy toast', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.updateDeliveryPackageMetadata({
      requestedClientId: 'client_a',
      packageId: 'pkg_1',
      title: 'Título',
      strategicNote: 'Nota',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toBe('Nota estratégica guardada');
    expect(metadataCalls).toHaveLength(1);
  });

  it('update metadata silent no-op surfaces legacy warning', async () => {
    metadataImpl = () => ({ updated: false });
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.updateDeliveryPackageMetadata({
      requestedClientId: 'client_a',
      packageId: 'pkg_sent',
      title: 'T',
      strategicNote: 'N',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('No se pudo guardar la nota estratégica');
  });

  it('removeDeliveryItemFromDelivery always mirrors legacy success toast', async () => {
    removeImpl = () => ({ removed: false });
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.removeDeliveryItemFromDelivery({
      requestedClientId: 'client_a',
      packageId: 'pkg_1',
      itemId: 'ditem_1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toBe('Ítem retirado del briefing');
    expect(removeCalls).toHaveLength(1);
    expect(removeCalls[0]).toMatchObject({
      packageId: 'pkg_1',
      itemId: 'ditem_1',
    });
  });

  it('discardDraftDelivery success and denied mirror legacy', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const ok = executionDeliveryCommands.discardDraftDelivery({
      requestedClientId: 'client_a',
      packageId: 'pkg_1',
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.message).toBe('Borrador descartado');

    discardImpl = () => ({ discarded: false });
    const denied = executionDeliveryCommands.discardDraftDelivery({
      requestedClientId: 'client_a',
      packageId: 'pkg_sent',
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.message).toBe('No se pudo descartar el borrador');
  });

  it('command seam and hooks stay db-free; P13 composite has no Domain/Application', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    const composite = code('src/services/deliveryAssemblyPresentation.ts');
    const hooks = code('src/ui/hooks/useWave3Data.ts');
    expect(composite).not.toMatch(/\bdbService\b/);
    expect(composite).not.toMatch(/from\s+['"][^'"]*domain\//);
    const p13Hooks = hooks.slice(
      hooks.indexOf('function invalidateDeliverWorkspace'),
      hooks.indexOf('export function useApproveBrief')
    );
    expect(p13Hooks).not.toMatch(/\bdbService\b/);
    expect(p13Hooks).not.toMatch(/from\s+['"][^'"]*domain\//);
    const deliverPanel = code('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    const deliverBlock = deliverPanel.slice(
      deliverPanel.indexOf('function DeliverPanel'),
      deliverPanel.indexOf('function BriefsPanel')
    );
    expect(deliverBlock).not.toMatch(/\bdbService\b/);
    expect(deliverBlock).not.toMatch(/\bensureDraftDelivery\s*\(/);
    const assemblyBlock = seam.slice(
      seam.indexOf('runEnsureDraftDeliveryPresentation'),
      seam.indexOf('Registry #27 — AssignClientTask')
    );
    expect(assemblyBlock).not.toMatch(/\bdbService\b/);
    expect(seam).toMatch(/runEnsureDraftDeliveryPresentation/);
    expect(seam).toMatch(/runAddCurationToDeliveryPresentation/);
    expect(hooks).toMatch(/useEnsureDraftDelivery/);
    expect(hooks).toMatch(/useAddCurationToDelivery/);
    expect(hooks).toMatch(/useUpdateDeliveryPackageMetadata/);
    expect(hooks).toMatch(/useRemoveDeliveryItemFromDelivery/);
    expect(hooks).toMatch(/useDiscardDraftDelivery/);
    expect(hooks).toMatch(/tenantInvalidationKey\(scope, 'compatibility'\)/);
  });
});

describe('P13 §12–§14 — read extensions and attached fact', () => {
  it('readWorkspaceDeliver exposes item ids, strategicNote, deliveryPackageId', () => {
    const reads = read('src/ui/data/compatibilityReads.ts');
    expect(reads).toMatch(/WorkspaceDeliverItemRead/);
    expect(reads).toMatch(/strategicNote/);
    expect(reads).toMatch(/items: pkg\.items\.map/);
    expect(reads).toMatch(/deliveryPackageId: entry\.deliveryPackageId/);
    expect(reads).not.toMatch(/canRemove|canDiscard|canSend/);
  });

  it('DeliverPanel uses persisted item id for remove — not array index', () => {
    const panel = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).toMatch(/deliver\.draftPackage\.items\.map/);
    expect(panel).toMatch(/item\.id/);
    expect(panel).toMatch(/react-ws-remove-item-/);
    expect(panel).not.toMatch(/itemTitles\.map/);
  });

  it('ready row attach control uses deliveryPackageId factual attach fact', () => {
    const panel = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).toMatch(/!entry\.deliveryPackageId/);
    expect(panel).toMatch(/react-ws-add-to-briefing-/);
    expect(panel).not.toMatch(/title ===/);
  });
});

describe('P13 §17–§23 — DeliverPanel workshop and handoff removal', () => {
  it('DeliverPanel exposes full #17 union without deliver LegacyHandoff', () => {
    const panel = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).toMatch(/react-ws-ensure-draft/);
    expect(panel).toMatch(/react-ws-draft-metadata-form/);
    expect(panel).toMatch(/react-ws-discard-draft/);
    expect(panel).toMatch(/react-ws-deliver-preview-send/);
    expect(panel).not.toMatch(/react-ws-deliver-handoff/);
    expect(panel).not.toMatch(/montar el briefing/);
    expect(panel).not.toMatch(/\bensureDraftDelivery\s*\(/);
    expect(panel).not.toMatch(/\baddCurationToDelivery\s*\(/);
  });
});

describe('P13 §7 / §29–§33 — non-regression boundaries', () => {
  it('P10 decide composite still uses internal addCurationToDelivery unchanged', () => {
    const decide = read('src/services/curationDecidePresentation.ts');
    expect(decide).toMatch(/addCurationToDelivery/);
    expect(decide).toMatch(/queueCurationInBriefing|queued/);
  });

  it('presentation composite does not call #14/#15/CR-2/#18/#22', () => {
    const composite = read('src/services/deliveryAssemblyPresentation.ts');
    expect(composite).not.toMatch(/decideCuration|proposeAngle/);
    expect(composite).not.toMatch(/createBriefFromCurationEntry|approveStrategicBrief/);
    expect(composite).not.toMatch(/sendDeliveryPackage/);
    expect(composite).not.toMatch(/scoreAndRouteSignal|addRecommendation/);
    expect(composite).not.toMatch(/auditService/);
  });

  it('React DeliverPanel does not call raw consumers or #22', () => {
    const panel = code('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).not.toMatch(/\bdecideCuration\s*\(/);
    expect(panel).not.toMatch(/\bproposeAngle\s*\(/);
    expect(panel).not.toMatch(/\bcreateBriefFromCurationEntry\s*\(/);
    expect(panel).not.toMatch(/\bensureDraftDelivery\s*\(/);
    expect(panel).not.toMatch(/\bsendDeliveryPackage\s*\(/);
    expect(panel).not.toMatch(/scoreAndRouteSignal|addRecommendation/);
  });
});

describe('P13 §41 — handoff accounting', () => {
  it('Deliver direct legacy actions = 0 after P13', () => {
    const workspace = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    const deliverBlock = workspace.match(/function DeliverPanel[\s\S]*?^}/m)?.[0] ?? '';
    expect(deliverBlock).not.toMatch(/LegacyHandoff/);
    expect(deliverBlock).not.toMatch(/montar el briefing/);
  });
});
