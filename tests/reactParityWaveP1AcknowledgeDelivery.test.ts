/**
 * SPEC-010 · T603 React Parity Wave P1 — #19 Acknowledge Delivery.
 *
 * Presentation parity only: React briefing ack reaches the frozen Application
 * command through the seam, with best-effort manager notification compatibility.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const consumerCalls: { packageId: string; clientAckNote?: string; requestedClientId: string | null }[] =
  [];
const notifyCalls: {
  clientId: string;
  type: string;
  title: string;
  body: string;
  href: string;
}[] = [];

let consumerResult: { ok: true; packageId: string; clientId: string } | { ok: false; compat: string } =
  { ok: true, packageId: 'pkg_p1', clientId: 'client_a' };
let consumerThrows: Error | null = null;
let notifyThrows = false;

vi.mock('../src/services/auth', () => ({
  authService: { getCurrentUser: () => null },
}));

vi.mock('../src/services/audit', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  acknowledgeDelivery: (intent: {
    requestedClientId: string | null | undefined;
    packageId: string;
    clientAckNote?: string;
  }) => {
    if (consumerThrows) throw consumerThrows;
    consumerCalls.push({
      packageId: intent.packageId,
      clientAckNote: intent.clientAckNote,
      requestedClientId: intent.requestedClientId ?? null,
    });
    return consumerResult;
  },
  reviewClientArticle: vi.fn(),
  saveContentDraft: vi.fn(),
  transitionClientTask: vi.fn(),
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

const deliveryFixtures = {
  sent: {
    id: 'pkg_p1',
    clientId: 'client_a',
    organizationId: 'org_a',
    title: 'Briefing P1',
    periodLabel: 'Sep 2026',
    strategicNote: 'Nota estratégica',
    items: [{ id: 'item_1', kind: 'ADVICE', title: 'Consejo', rationale: 'Porque' }],
    status: 'SENT',
    sentAt: '2026-09-01T12:00:00.000Z',
  },
  acknowledged: {
    id: 'pkg_p1',
    clientId: 'client_a',
    organizationId: 'org_a',
    title: 'Briefing P1',
    periodLabel: 'Sep 2026',
    strategicNote: null,
    items: [],
    status: 'ACKNOWLEDGED',
    sentAt: '2026-09-01T12:00:00.000Z',
    acknowledgedAt: '2026-09-02T10:00:00.000Z',
    clientAckNote: 'Gracias',
  },
};

vi.mock('../src/services/db', () => ({
  dbService: {
    getSentDeliveriesByClient: vi.fn((clientId: string) => {
      if (clientId !== 'client_a') return [];
      return [deliveryFixtures.sent];
    }),
    getDeliveryById: vi.fn((id: string) => {
      if (id === 'pkg_p1') return { ...deliveryFixtures.sent, clientId: 'client_a' };
      return undefined;
    }),
    getClientById: vi.fn((id: string) =>
      id === 'client_a'
        ? { id: 'client_a', organizationId: 'org_a', displayName: 'Cliente A' }
        : undefined
    ),
  },
}));

import { renderDeliveryBriefingCard } from '../src/components/ClientPortal';
import { buildTrustedTenantScope } from '../src/ui/query/tenantScope';
import { readClientLatestBriefing, readBriefingAckNotificationContext } from '../src/ui/data/compatibilityReads';
import type { User } from '../src/types';

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
  consumerResult = { ok: true, packageId: 'pkg_p1', clientId: 'client_a' };
});

describe('P1 §21 — React client portal briefing presentation', () => {
  const portal = () => read('src/ui/modules/pages/ReactClientPortalPage.tsx');

  it('home tab renders latest briefing section with legacy strings', () => {
    const source = portal();
    expect(source).toMatch(/BriefingPanel/);
    expect(source).toMatch(/Último briefing/);
    expect(source).toMatch(/Tu Brand Manager aún no te ha enviado un briefing/);
    expect(source).toMatch(/Marcar como leído/);
    expect(source).toMatch(/Nota para tu Brand Manager \(opcional\)/);
    expect(source).toMatch(/Briefing marcado como visto/);
    expect(source).toMatch(/No se pudo marcar el briefing/);
  });

  it('SENT renders ack button and optional note input', () => {
    const source = portal();
    expect(source).toMatch(/data\.status === 'SENT'/);
    expect(source).toMatch(/data-testid="react-portal-briefing-ack"/);
    expect(source).toMatch(/data-testid="react-portal-briefing-note"/);
  });

  it('ACKNOWLEDGED hides button and shows read badge', () => {
    const source = portal();
    expect(source).toMatch(/data\.status === 'ACKNOWLEDGED'/);
    expect(source).toMatch(/data-testid="react-portal-briefing-read"/);
    expect(source).toMatch(/Leído/);
    const sentBlock = source.slice(source.indexOf("data.status === 'SENT'"));
    expect(sentBlock).toMatch(/react-portal-briefing-ack/);
    expect(source.indexOf("isAcknowledged ?")).toBeGreaterThan(-1);
  });

  it('empty briefing renders safe empty state', () => {
    expect(portal()).toMatch(/data-testid="react-portal-briefing-empty"/);
  });

  it('mutation pending disables accidental duplicate click', () => {
    expect(portal()).toMatch(/disabled=\{acknowledge\.isPending\}/);
  });

  it('note is trimmed in the component before the seam, matching legacy handler', () => {
    expect(portal()).toMatch(/note\.trim\(\)/);
  });
});

describe('P1 §4 — readClientLatestBriefing compatibility seam', () => {
  it('returns latest sent delivery only for trusted client scope', () => {
    const scope = buildTrustedTenantScope(CLIENT_USER);
    const briefing = readClientLatestBriefing(scope);
    expect(briefing).toMatchObject({
      id: 'pkg_p1',
      title: 'Briefing P1',
      status: 'SENT',
      strategicNote: 'Nota estratégica',
    });
    expect(briefing?.items).toHaveLength(1);
  });

  it('returns null without client scope — cross-client read structurally impossible', () => {
    const adminScope = buildTrustedTenantScope({
      ...CLIENT_USER,
      role: 'ADMIN',
      clientId: undefined,
    } as User);
    expect(readClientLatestBriefing(adminScope)).toBeNull();
  });

  it('uses getSentDeliveriesByClient first row — limit 1 legacy parity', () => {
    const source = read('src/ui/data/compatibilityReads.ts');
    expect(source).toMatch(/getSentDeliveriesByClient\(clientId\)\[0\]/);
  });
});

describe('P1 §6–§12 — deliveryAckCommands seam behaviour', () => {
  it('click path invokes canonical consumer exactly once with packageId and note', async () => {
    const { deliveryAckCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    expect(
      deliveryAckCommands.acknowledge(scope, 'pkg_p1', '  hola  ')
    ).toEqual({ ok: true });

    expect(consumerCalls).toHaveLength(1);
    expect(consumerCalls[0]).toEqual({
      packageId: 'pkg_p1',
      clientAckNote: 'hola',
      requestedClientId: 'client_a',
    });
  });

  it('successful ack returns exact success presentation contract via hook refresh invalidation', async () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useAcknowledgeDelivery/);
    expect(hooks).toMatch(/invalidateQueries/);
    expect(hooks).toMatch(/client-latest-briefing/);
  });

  it('consumer failure returns exact legacy failure text and sends no notification', async () => {
    consumerResult = { ok: false, compat: 'DELIVERY_NOT_FOUND' };
    const { deliveryAckCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    expect(deliveryAckCommands.acknowledge(scope, 'missing')).toEqual({
      ok: false,
      message: 'No se pudo marcar el briefing',
    });
    expect(notifyCalls).toHaveLength(0);
  });

  it('consumer throw returns failure text without notification', async () => {
    consumerThrows = new Error('DELIVERY_INVALID_TRANSITION:ACKNOWLEDGED->ACKNOWLEDGED');
    const { deliveryAckCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    expect(deliveryAckCommands.acknowledge(scope, 'pkg_p1')).toEqual({
      ok: false,
      message: 'DELIVERY_INVALID_TRANSITION:ACKNOWLEDGED->ACKNOWLEDGED',
    });
    expect(notifyCalls).toHaveLength(0);
  });

  it('portfolio scope without client fails closed', async () => {
    const { deliveryAckCommands } = await loadSeam();
    const adminScope = buildTrustedTenantScope({
      ...CLIENT_USER,
      role: 'ADMIN',
      clientId: undefined,
    } as User);

    expect(deliveryAckCommands.acknowledge(adminScope, 'pkg_p1')).toEqual({
      ok: false,
      message: 'Cliente no resuelto',
    });
    expect(consumerCalls).toHaveLength(0);
  });
});

describe('P1 §22 — authority guards', () => {
  it('React portal never imports dbService for delivery read or write', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).not.toMatch(/\bdbService\b/);
    expect(portal).not.toMatch(/\backnowledgeDelivery\s*\(/);
    expect(portal).toMatch(/useAcknowledgeDelivery/);
    expect(portal).toMatch(/useClientLatestBriefing/);
  });

  it('command seam delegates through consumer alias — no acknowledgeDelivery( in React UI', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    expect(seam).toMatch(/acknowledgeDeliveryConsumer/);
    expect(seam).not.toMatch(/\backnowledgeDelivery\s*\(/);
    expect(seam).not.toMatch(/\bdbService\b/);
  });

  it('only compatibilityReads imports dbService among P1 delivery read paths', () => {
    const notification = read('src/ui/presentation/briefingAckNotification.ts');
    expect(notification).not.toMatch(/\bdbService\b/);
    expect(read('src/ui/data/compatibilityReads.ts')).toMatch(/readClientLatestBriefing/);
  });

  it('AcknowledgeDelivery Application file remains frozen — zero edits in P1', () => {
    const app = read('src/application/executionDelivery/AcknowledgeDelivery.ts');
    expect(app).toMatch(/requireClientRole/);
    expect(app).not.toMatch(/notifyManager/);
  });
});

describe('P1 §23 — manager notification compatibility', () => {
  it('successful ack sends exactly one BRIEFING notification with legacy fields', async () => {
    const { deliveryAckCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    deliveryAckCommands.acknowledge(scope, 'pkg_p1', 'nota cliente');

    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0]).toEqual({
      clientId: 'client_a',
      type: 'BRIEFING',
      title: 'Briefing visto por el cliente',
      href: 'ws-deliver',
      body: '«Briefing P1» — Cliente A: nota cliente',
    });
  });

  it('notification without note uses legacy body wording', async () => {
    const { deliveryAckCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    deliveryAckCommands.acknowledge(scope, 'pkg_p1');

    expect(notifyCalls[0]?.body).toBe('«Briefing P1» marcado como leído por Cliente A.');
  });

  it('notification failure after successful ack preserves command success', async () => {
    notifyThrows = true;
    const { deliveryAckCommands } = await loadSeam();
    const scope = buildTrustedTenantScope(CLIENT_USER);

    expect(deliveryAckCommands.acknowledge(scope, 'pkg_p1')).toEqual({ ok: true });
    expect(consumerCalls).toHaveLength(1);
  });

  it('readBriefingAckNotificationContext denies cross-client package access', () => {
    const scope = buildTrustedTenantScope(CLIENT_USER);
    const ctx = readBriefingAckNotificationContext(scope, 'pkg_p1');
    expect(ctx).toEqual({
      clientId: 'client_a',
      packageTitle: 'Briefing P1',
      clientDisplayName: 'Cliente A',
    });
  });
});

describe('P1 §24 — legacy #19 presentation retained for global rollback', () => {
  it('legacy ClientPortal still renders acknowledgement for SENT packages', () => {
    const sent = renderDeliveryBriefingCard(
      {
        id: 'pkg_legacy',
        organizationId: 'org_ed',
        clientId: 'client_ed',
        title: 'Legacy briefing',
        items: [{ id: 'i1', kind: 'ADVICE', title: 'Item' }],
        status: 'SENT',
        createdAt: '2026-01-01',
        createdBy: 'admin',
        sentAt: '2026-01-02',
      },
      { showAckControls: true }
    );
    expect(sent).toMatch(/btn-acknowledge-delivery/);
    expect(sent).toMatch(/Marcar como leído/);
  });

  it('postura_ui_mode legacy rollback toggle remains unchanged', () => {
    const toggle = read('src/ui/strangler/toggle.ts');
    expect(toggle).toMatch(/postura_ui_mode/);
    const handlers = read('src/ui/legacy/handlers/deliveryHandlers.ts');
    expect(handlers).toMatch(/btn-acknowledge-delivery/);
    expect(handlers).toMatch(/acknowledgeDeliveryCmd/);
  });

  it('legacy ClientPortal home still includes briefing acknowledgement section', () => {
    const portal = read('src/components/ClientPortal.ts');
    expect(portal).toMatch(/Último briefing/);
    expect(portal).toMatch(/renderReceivedBriefings\(clientId, 1\)/);
    expect(portal).toMatch(/btn-acknowledge-delivery/);
  });
});
