/**
 * SPEC-010 · T603 React Parity Wave P2 — #13 DecideThesisClientReview.
 *
 * Presentation parity only: combined client-thesis surface, frozen command via seam,
 * best-effort manager notification compatibility.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PositioningThesis } from '../src/types';
import { buildTrustedTenantScope } from '../src/ui/query/tenantScope';
import type { User } from '../src/types';
import {
  approveThesisByClient,
  rejectThesisByClient,
} from '../src/domain/thesisRevisionCore';
import { createDecideThesisClientReview } from '../src/application/thesisLifecycle/DecideThesisClientReview';
import type { ThesisRepository } from '../src/application/thesisLifecycle';

const consumerCalls: {
  requestedClientId: string | null | undefined;
  thesisId: string;
  decision: 'approve' | 'request_changes';
  feedback?: string;
}[] = [];
const notifyCalls: {
  clientId: string;
  type: string;
  title: string;
  body: string;
  href: string;
}[] = [];

let consumerResult: {
  thesis: PositioningThesis;
  decision: 'approve' | 'request_changes';
  appliedRevision: boolean;
  awaitsManagerActivation: boolean;
};
let consumerThrows: Error | null = null;
let notifyThrows = false;

vi.mock('../src/services/auth', () => ({
  authService: { getCurrentUser: () => null },
}));

vi.mock('../src/services/audit', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../src/services/thesisLifecycleConsumer', () => ({
  decideThesisClientReview: (intent: {
    requestedClientId: string | null | undefined;
    thesisId: string;
    decision: 'approve' | 'request_changes';
    feedback?: string;
  }) => {
    if (consumerThrows) throw consumerThrows;
    consumerCalls.push(intent);
    return consumerResult;
  },
  saveThesis: vi.fn(),
  activateThesis: vi.fn(),
}));

vi.mock('../src/services/notifications', () => ({
  notifyManager: (
    clientId: string,
    input: { type: string; title: string; body: string; href: string }
  ) => {
    if (notifyThrows) throw new Error('notify failed');
    notifyCalls.push({ clientId, ...input });
    return true;
  },
}));

const thesisFixtures: Record<string, PositioningThesis> = {
  pending_review: {
    id: 'thesis_pending',
    organizationId: 'org_a',
    clientId: 'client_a',
    title: 'Tesis pendiente',
    expertIdentity: 'Identidad',
    targetAudience: 'Audiencia',
    domain: 'Dominio',
    objective: 'Objetivo',
    proofPoints: ['Prueba A'],
    differentiator: 'Diferenciador',
    voiceAndTone: 'Tono',
    complianceRules: 'Reglas',
    status: 'UNDER_REVIEW',
    clientApprovalStatus: 'PENDING',
    priority: 50,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user_admin',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'user_admin',
  },
  active_revision: {
    id: 'thesis_revision',
    organizationId: 'org_a',
    clientId: 'client_a',
    title: 'Tesis activa',
    expertIdentity: 'Identidad activa',
    targetAudience: 'Audiencia',
    domain: 'Dominio',
    objective: 'Objetivo',
    proofPoints: ['Prueba B'],
    differentiator: 'Diferenciador',
    voiceAndTone: 'Tono',
    complianceRules: 'Reglas',
    status: 'ACTIVE',
    clientApprovalStatus: 'PENDING',
    pendingRevision: {
      proposed: {
        title: 'Tesis revisada',
        expertIdentity: 'Identidad revisada',
      },
      requestedAt: '2026-02-01T00:00:00.000Z',
      requestedBy: 'user_admin',
    },
    priority: 50,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user_admin',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'user_admin',
  },
  approved_waiting: {
    id: 'thesis_approved',
    organizationId: 'org_a',
    clientId: 'client_a',
    title: 'Tesis aprobada',
    expertIdentity: 'Identidad',
    targetAudience: 'Audiencia',
    domain: 'Dominio',
    objective: 'Objetivo',
    proofPoints: [],
    differentiator: 'Diferenciador',
    voiceAndTone: 'Tono',
    complianceRules: 'Reglas',
    status: 'UNDER_REVIEW',
    clientApprovalStatus: 'APPROVED',
    priority: 50,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user_admin',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'user_admin',
  },
};

vi.mock('../src/services/db', () => ({
  dbService: {
    getThesesByClient: vi.fn((clientId: string) => {
      if (clientId !== 'client_a') return [];
      return Object.values(thesisFixtures);
    }),
    getEvidenceVaultByClient: vi.fn(() => []),
    getClientById: vi.fn((id: string) =>
      id === 'client_a'
        ? { id: 'client_a', organizationId: 'org_a', displayName: 'Cliente A' }
        : undefined
    ),
  },
}));

import { readThesisDetail } from '../src/ui/data/compatibilityReads';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const CLIENT_USER: User = {
  uid: 'user_client',
  email: 'client@test',
  displayName: 'Client',
  role: 'CLIENT',
  organizationId: 'org_a',
  clientId: 'client_a',
} as User;

async function loadSeam() {
  const mod = await import('../src/ui/commands/commandSeam');
  consumerCalls.length = 0;
  notifyCalls.length = 0;
  return mod;
}

beforeEach(() => {
  consumerCalls.length = 0;
  notifyCalls.length = 0;
  consumerThrows = null;
  notifyThrows = false;
  consumerResult = {
    thesis: thesisFixtures.pending_review,
    decision: 'approve',
    appliedRevision: false,
    awaitsManagerActivation: true,
  };
});

describe('P2 §2 — client-thesis routing ownership', () => {
  it('maps client-thesis to portal thesis tab, not wave2 dossier', () => {
    const shell = read('src/ui/modules/AppShell/ReactAppShell.tsx');
    expect(shell).toMatch(/'client-thesis': 'thesis'/);
    expect(shell).not.toMatch(/'client-thesis': 'dossier'/);
  });

  it('shellTabs classifies client-thesis as portal tab only', () => {
    const tabs = read('src/ui/legacy/shellTabs.ts');
    expect(tabs).toMatch(/REACT_PORTAL_TABS[\s\S]*'client-thesis'/);
    expect(tabs).not.toMatch(/REACT_WAVE2_TABS[\s\S]*'client-thesis'/);
  });

  it('ThesisReviewPanel and dossier compose on the same portal tab', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/tab === 'thesis' \? <ThesisReviewPanel/);
    expect(portal).toMatch(/<ReactMasterDossierPanel/);
  });
});

describe('P2 §5–§9 — readThesisDetail compatibility projection', () => {
  it('uses thesisForClientReview for client-visible title and proof points', () => {
    const scope = buildTrustedTenantScope(CLIENT_USER);
    const detail = readThesisDetail(scope, 'thesis_revision');
    expect(detail.resolved).toBe(true);
    expect(detail.title).toBe('Tesis revisada');
    expect(detail.proofPoints).toEqual(['Prueba B']);
    expect(detail.hasPendingRevision).toBe(true);
  });

  it('projects legacy needsAction without requiring ACTIVE on pendingRevision branch', () => {
    const scope = buildTrustedTenantScope(CLIENT_USER);
    expect(readThesisDetail(scope, 'thesis_pending').needsAction).toBe(true);
    expect(readThesisDetail(scope, 'thesis_revision').needsAction).toBe(true);
    expect(readThesisDetail(scope, 'thesis_approved').needsAction).toBe(false);
  });

  it('computes needsAction in compatibility read layer only', () => {
    const reads = read('src/ui/data/compatibilityReads.ts');
    expect(reads).toMatch(/legacyThesisNeedsAction/);
    expect(reads).toMatch(/thesisForClientReview/);
    const portal = code('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).not.toMatch(/legacyThesisNeedsAction/);
    expect(portal).not.toMatch(/pendingRevision &&[\s\S]*clientApprovalStatus === 'PENDING'/);
    expect(portal).toMatch(/resolved\.needsAction/);
  });
});

describe('P2 §10–§12 — thesis review presentation', () => {
  it('renders native approve and request-changes controls with legacy label', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/Aprobar tesis/);
    expect(portal).toMatch(/Pedir cambios/);
    expect(portal).toMatch(
      /Si pides cambios, indica qué debe ajustar el manager/
    );
    expect(portal).toMatch(/data-testid="react-portal-thesis-approve"/);
    expect(portal).toMatch(/data-testid="react-portal-thesis-request-changes"/);
    expect(portal).toMatch(/useDecideThesisClientReview/);
  });

  it('evidence handoff remains reachable without thesis review handoff', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/actions=\{\['añadir evidencia al vault'\]\}/);
    expect(portal).not.toMatch(/actions=\{[^}]*aprobar la tesis/);
  });

  it('approve invokes canonical consumer exactly once with public input only', async () => {
    const { thesisLifecycleCommands } = await loadSeam();
    const result = thesisLifecycleCommands.decideClientReview({
      requestedClientId: 'client_a',
      thesisId: 'thesis_pending',
      decision: 'approve',
    });
    expect(result.ok).toBe(true);
    expect(consumerCalls).toHaveLength(1);
    expect(consumerCalls[0]).toEqual({
      requestedClientId: 'client_a',
      thesisId: 'thesis_pending',
      decision: 'approve',
    });
  });

  it('request_changes passes optional feedback without React trim', async () => {
    const { thesisLifecycleCommands } = await loadSeam();
    thesisLifecycleCommands.decideClientReview({
      requestedClientId: 'client_a',
      thesisId: 'thesis_pending',
      decision: 'request_changes',
      feedback: '  ajustar audiencia  ',
    });
    expect(consumerCalls[0]?.feedback).toBe('  ajustar audiencia  ');
  });
});

describe('P2 §13–§20 — command seam notifications and failure', () => {
  it('approve with awaitsManagerActivation sends one THESIS notification', async () => {
    const { thesisLifecycleCommands } = await loadSeam();
    thesisLifecycleCommands.decideClientReview({
      requestedClientId: 'client_a',
      thesisId: 'thesis_pending',
      decision: 'approve',
    });
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0]).toEqual({
      clientId: 'client_a',
      type: 'THESIS',
      title: 'Tesis aprobada por el cliente',
      href: 'ws-positioning',
      body: '«Tesis pendiente» — puedes activarla en Identidad.',
    });
  });

  it('approve revision without awaitsManagerActivation sends zero notifications', async () => {
    consumerResult = {
      thesis: { ...thesisFixtures.active_revision, title: 'Tesis activa' },
      decision: 'approve',
      appliedRevision: true,
      awaitsManagerActivation: false,
    };
    const { thesisLifecycleCommands } = await loadSeam();
    thesisLifecycleCommands.decideClientReview({
      requestedClientId: 'client_a',
      thesisId: 'thesis_revision',
      decision: 'approve',
    });
    expect(notifyCalls).toHaveLength(0);
  });

  it('request_changes sends one notification with feedback slice(0, 120)', async () => {
    consumerResult = {
      thesis: thesisFixtures.pending_review,
      decision: 'request_changes',
      appliedRevision: false,
      awaitsManagerActivation: false,
    };
    const { thesisLifecycleCommands } = await loadSeam();
    const longFeedback = 'x'.repeat(140);
    thesisLifecycleCommands.decideClientReview({
      requestedClientId: 'client_a',
      thesisId: 'thesis_pending',
      decision: 'request_changes',
      feedback: longFeedback,
    });
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0]?.body).toBe(`«Tesis pendiente»: ${'x'.repeat(120)}`);
  });

  it('request_changes without feedback uses legacy default body', async () => {
    consumerResult = {
      thesis: thesisFixtures.pending_review,
      decision: 'request_changes',
      appliedRevision: false,
      awaitsManagerActivation: false,
    };
    const { thesisLifecycleCommands } = await loadSeam();
    thesisLifecycleCommands.decideClientReview({
      requestedClientId: 'client_a',
      thesisId: 'thesis_pending',
      decision: 'request_changes',
    });
    expect(notifyCalls[0]?.body).toBe('El cliente pidió ajustes en «Tesis pendiente».');
  });

  it('notification failure after command success preserves ok result', async () => {
    notifyThrows = true;
    const { thesisLifecycleCommands } = await loadSeam();
    expect(
      thesisLifecycleCommands.decideClientReview({
        requestedClientId: 'client_a',
        thesisId: 'thesis_pending',
        decision: 'approve',
      }).ok
    ).toBe(true);
    expect(consumerCalls).toHaveLength(1);
  });

  it('consumer failure sends no notification and uses approve fallback text', async () => {
    consumerThrows = new Error('Tesis no encontrada.');
    const { thesisLifecycleCommands } = await loadSeam();
    expect(
      thesisLifecycleCommands.decideClientReview({
        requestedClientId: 'client_a',
        thesisId: 'missing',
        decision: 'approve',
      })
    ).toEqual({ ok: false, message: 'Tesis no encontrada.' });
    expect(notifyCalls).toHaveLength(0);
  });

  it('request_changes failure uses legacy fallback text', async () => {
    consumerThrows = new Error('Invalid transition');
    const { thesisLifecycleCommands } = await loadSeam();
    expect(
      thesisLifecycleCommands.decideClientReview({
        requestedClientId: 'client_a',
        thesisId: 'thesis_pending',
        decision: 'request_changes',
      })
    ).toEqual({ ok: false, message: 'Invalid transition' });
  });
});

describe('P2 §22–§35 — authority guards', () => {
  it('React portal never imports dbService or decideThesisClientReview directly', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).not.toMatch(/\bdbService\b/);
    expect(portal).not.toMatch(/\bdecideThesisClientReview\s*\(/);
    expect(portal).not.toMatch(/\bactivateThesis\s*\(/);
    expect(portal).toMatch(/useDecideThesisClientReview/);
  });

  it('command seam delegates through consumer alias only', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    expect(seam).toMatch(/decideThesisClientReview\s*\(/);
    expect(seam).toMatch(/notifyManagerThesisClientApproved/);
    expect(seam).not.toMatch(/\bdbService\b/);
  });

  it('DecideThesisClientReview Application file remains frozen', () => {
    const app = read('src/application/thesisLifecycle/DecideThesisClientReview.ts');
    expect(app).toMatch(/requireClientRole/);
    expect(app).not.toMatch(/notifyManager/);
  });

  it('legacy ClientPortal thesis controls remain for rollback', () => {
    const legacy = read('src/components/ClientPortal.ts');
    expect(legacy).toMatch(/btn-approve-thesis/);
    expect(legacy).toMatch(/btn-request-thesis-changes/);
  });

  it('mutation invalidates compatibility thesis queries after success', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useDecideThesisClientReview/);
    expect(hooks).toMatch(/invalidateQueries/);
  });
});

function memoryTheses() {
  const store = new Map<string, PositioningThesis>();
  const repo: ThesisRepository = {
    getById(clientId, thesisId) {
      const t = store.get(thesisId);
      return t && t.clientId === clientId ? t : undefined;
    },
    listByClient(clientId) {
      return [...store.values()].filter((t) => t.clientId === clientId);
    },
    save(thesis) {
      store.set(thesis.id, { ...thesis });
    },
  };
  return { repo, store };
}

describe('P2 §29–§33 — frozen thesis lifecycle semantics', () => {
  it('UNDER_REVIEW + PENDING approve remains UNDER_REVIEW and awaits activation', () => {
    const { repo } = memoryTheses();
    const thesis: PositioningThesis = {
      ...thesisFixtures.pending_review,
      id: 'thesis_flow',
    };
    repo.save(thesis);
    const decide = createDecideThesisClientReview({ theses: repo });
    const result = decide({
      trusted: {
        actorId: 'user_client',
        actorRole: 'CLIENT',
        organizationId: 'org_a',
        clientId: 'client_a',
        now: '2026-09-01T00:00:00.000Z',
      },
      thesisId: 'thesis_flow',
      decision: 'approve',
    });
    expect(result.thesis.clientApprovalStatus).toBe('APPROVED');
    expect(result.thesis.status).toBe('UNDER_REVIEW');
    expect(result.awaitsManagerActivation).toBe(true);
  });

  it('ACTIVE pendingRevision approve applies revision and stays ACTIVE', () => {
    const thesis: PositioningThesis = {
      ...thesisFixtures.active_revision,
      id: 'thesis_active',
    };
    const approved = approveThesisByClient(thesis, 'user_client');
    expect(approved.thesis.status).toBe('ACTIVE');
    expect(approved.appliedRevision).toBe(true);
    expect(approved.awaitsManagerActivation).toBe(false);
  });

  it('request_changes trim remains Domain-owned', () => {
    const thesis: PositioningThesis = { ...thesisFixtures.pending_review, id: 'thesis_draft' };
    const updated = rejectThesisByClient(thesis, '  feedback  ');
    expect(updated.clientFeedback).toBe('feedback');
  });
});
