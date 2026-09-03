/**
 * CR-1 Workstream 1 — Client Lifecycle Application tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

class LocalStorageMock {
  private store = new Map<string, string>();
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

vi.hoisted(() => {
  // Must exist before auth/audit module constructors run.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = new (class {
    private store = new Map<string, string>();
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.store.set(key, value);
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
  })();
});

import {
  ClientLifecycleError,
  createAcceptClientInvitation,
  createCreateClientWithInvite,
  type ClientCreateFields,
  type ClientIdentityActivationPort,
  type ClientShellPort,
  type InvitationPort,
  type PendingAccountPort,
  type TrustedClientLifecycleAdminContext,
} from '../src/application/clientLifecycle';
import type { Client, Invitation, User } from '../src/types';
import {
  createClientWithInvite,
  resetClientLifecycleConsumerForTest,
} from '../src/services/clientLifecycleConsumer';
import { composeClientLifecycle } from '../src/composition/clientLifecycle/composeClientLifecycle';
import { authService } from '../src/services/auth';
import { dbService } from '../src/services/db';

function adminTrusted(
  overrides: Partial<TrustedClientLifecycleAdminContext> = {}
): TrustedClientLifecycleAdminContext {
  return {
    actorId: 'admin_01',
    actorRole: 'ADMIN',
    organizationId: 'org_trust',
    now: '2026-08-28T12:00:00.000Z',
    ...overrides,
  };
}

function memoryPorts() {
  const clients = new Map<string, Client>();
  const invitations = new Map<string, Invitation>();
  let clientSeq = 0;
  let invSeq = 0;
  const pending: Array<{ email: string; clientId: string; organizationId: string }> = [];
  let failPending = false;
  let failInvite = false;

  const clientPort: ClientShellPort = {
    getById(id) {
      return clients.get(id);
    },
    create(fields: ClientCreateFields) {
      clientSeq += 1;
      const id = `client_mem_${clientSeq}`;
      const c: Client = {
        ...fields,
        id,
        createdAt: '2026-08-28T12:00:00.000Z',
        updatedAt: '2026-08-28T12:00:00.000Z',
        activeThesesCount: 0,
        completedTasksCount: 0,
      };
      clients.set(id, c);
      return c;
    },
    update(id, updates) {
      const existing = clients.get(id);
      if (!existing) return null;
      const next = { ...existing, ...updates, updatedAt: '2026-08-28T12:01:00.000Z' };
      clients.set(id, next);
      return next;
    },
  };

  const invitationPort: InvitationPort = {
    getByToken(token) {
      return [...invitations.values()].find((i) => i.token === token);
    },
    getById(id) {
      return invitations.get(id);
    },
    create(clientId, email) {
      if (failInvite) throw new Error('invite boom');
      invSeq += 1;
      const id = `inv_mem_${invSeq}`;
      const inv: Invitation = {
        id,
        organizationId: clients.get(clientId)!.organizationId,
        clientId,
        email,
        token: `tok_mem_${invSeq}`,
        status: 'PENDING',
        expiresAt: '2099-01-01T00:00:00.000Z',
        createdAt: '2026-08-28T12:00:00.000Z',
      };
      invitations.set(id, inv);
      return inv;
    },
    markAccepted(id) {
      const inv = invitations.get(id);
      if (inv) invitations.set(id, { ...inv, status: 'ACCEPTED' });
    },
    markRevoked(id) {
      const inv = invitations.get(id);
      if (inv) invitations.set(id, { ...inv, status: 'REVOKED' });
    },
  };

  const pendingPort: PendingAccountPort = {
    createPending(params) {
      if (failPending) throw new Error('pending boom');
      pending.push(params);
    },
  };

  const identity: ClientIdentityActivationPort = {
    async activateFromInvitation({ invitation, password, displayName }) {
      if (!password || !displayName) return { ok: false, message: 'missing credentials' };
      return { ok: true, userId: `user_from_${invitation.id}` };
    },
  };

  return {
    clients: clientPort,
    invitations: invitationPort,
    pendingAccounts: pendingPort,
    identity,
    store: { clients, invitations, pending },
    setFailInvite: (v: boolean) => {
      failInvite = v;
    },
    setFailPending: (v: boolean) => {
      failPending = v;
    },
  };
}

function adminUser(organizationId = 'org_from_session'): User {
  return {
    uid: 'u_admin',
    email: 'admin@x.com',
    displayName: 'Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    organizationId,
    clientId: null,
    mustCompleteOnboarding: false,
    aiKeyManagementAllowed: false,
    locale: 'es',
    timezone: 'UTC',
  };
}

describe('CR-1 Client Lifecycle Application — CreateClientWithInvite', () => {
  it('creates client + invitation + pending account from trusted admin context', () => {
    const ports = memoryPorts();
    const create = createCreateClientWithInvite(ports);
    const result = create({
      trusted: adminTrusted(),
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      profession: 'Abogada',
    });
    expect(result.client.organizationId).toBe('org_trust');
    expect(result.client.status).toBe('INVITED');
    expect(result.client.onboardingStatus).toBe('NOT_STARTED');
    expect(result.client.profileCompleteness).toBe(15);
    expect(result.client.primaryManagerId).toBe('admin_01');
    expect(result.client.createdBy).toBe('admin_01');
    expect(result.invitation.status).toBe('PENDING');
    expect(result.invitation.email).toBe('ana@example.com');
    expect(ports.store.pending).toHaveLength(1);
    expect(ports.store.pending[0].organizationId).toBe('org_trust');
  });

  it('ATTACK: caller-supplied organizationId mismatch is denied', () => {
    const create = createCreateClientWithInvite(memoryPorts());
    try {
      create({
        trusted: adminTrusted(),
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        claimedOrganizationId: 'org_evil',
      });
      expect.unreachable('should deny');
    } catch (err) {
      expect(err).toBeInstanceOf(ClientLifecycleError);
      expect((err as ClientLifecycleError).code).toBe('TENANT_CONTEXT_INVALID');
    }
  });

  it('ATTACK: CLIENT role trusted context is denied', () => {
    const create = createCreateClientWithInvite(memoryPorts());
    expect(() =>
      create({
        trusted: adminTrusted({ actorRole: 'CLIENT' }),
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
      })
    ).toThrow(/ADMIN/);
  });

  it('compensates by archiving client when invitation fails mid-flight', () => {
    const ports = memoryPorts();
    ports.setFailInvite(true);
    const create = createCreateClientWithInvite(ports);
    expect(() =>
      create({
        trusted: adminTrusted(),
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
      })
    ).toThrow(ClientLifecycleError);
    const archived = [...ports.store.clients.values()];
    expect(archived).toHaveLength(1);
    expect(archived[0].status).toBe('ARCHIVED');
  });

  it('compensates by archiving client + revoking invitation when pending account fails', () => {
    const ports = memoryPorts();
    ports.setFailPending(true);
    const create = createCreateClientWithInvite(ports);
    expect(() =>
      create({
        trusted: adminTrusted(),
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
      })
    ).toThrow(/rolled back/);
    const client = [...ports.store.clients.values()][0];
    const invite = [...ports.store.invitations.values()][0];
    expect(client.status).toBe('ARCHIVED');
    expect(invite.status).toBe('REVOKED');
  });
});

describe('CR-1 Client Lifecycle Application — AcceptClientInvitation', () => {
  function seedPendingInvite(ports: ReturnType<typeof memoryPorts>) {
    const create = createCreateClientWithInvite(ports);
    return create({
      trusted: adminTrusted(),
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
    });
  }

  it('activates client and marks invitation accepted', async () => {
    const ports = memoryPorts();
    const seeded = seedPendingInvite(ports);
    const accept = createAcceptClientInvitation(ports);
    const result = await accept({
      token: seeded.invitation.token,
      password: 'secret-pass',
      displayName: 'Ana Pérez',
    });
    expect(result.client.status).toBe('ACTIVE');
    expect(result.client.onboardingStatus).toBe('IN_PROGRESS');
    expect(result.client.userId).toBe(`user_from_${seeded.invitation.id}`);
    expect(result.invitation.status).toBe('ACCEPTED');
  });

  it('ATTACK: missing invitation token denied', async () => {
    const accept = createAcceptClientInvitation(memoryPorts());
    await expect(
      accept({ token: 'nope', password: 'x', displayName: 'Y' })
    ).rejects.toMatchObject({ code: 'INVITATION_NOT_FOUND' });
  });

  it('ATTACK: already-accepted invitation denied', async () => {
    const ports = memoryPorts();
    const seeded = seedPendingInvite(ports);
    const accept = createAcceptClientInvitation(ports);
    await accept({
      token: seeded.invitation.token,
      password: 'secret-pass',
      displayName: 'Ana Pérez',
    });
    await expect(
      accept({
        token: seeded.invitation.token,
        password: 'secret-pass',
        displayName: 'Ana Pérez',
      })
    ).rejects.toMatchObject({ code: 'INVITATION_NOT_PENDING' });
  });

  it('ATTACK: expired invitation denied (existing expiresAt semantics)', async () => {
    const ports = memoryPorts();
    const seeded = seedPendingInvite(ports);
    ports.store.invitations.set(seeded.invitation.id, {
      ...seeded.invitation,
      expiresAt: '2020-01-01T00:00:00.000Z',
    });
    const accept = createAcceptClientInvitation({
      ...ports,
      now: () => Date.parse('2026-08-28T12:00:00.000Z'),
    });
    await expect(
      accept({
        token: seeded.invitation.token,
        password: 'secret-pass',
        displayName: 'Ana Pérez',
      })
    ).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' });
  });

  it('ATTACK: invitation/client org mismatch denied', async () => {
    const ports = memoryPorts();
    const seeded = seedPendingInvite(ports);
    const client = ports.store.clients.get(seeded.client.id)!;
    ports.store.clients.set(client.id, { ...client, organizationId: 'org_other' });
    const accept = createAcceptClientInvitation(ports);
    await expect(
      accept({
        token: seeded.invitation.token,
        password: 'secret-pass',
        displayName: 'Ana Pérez',
      })
    ).rejects.toMatchObject({ code: 'CLIENT_TENANT_MISMATCH' });
  });
});

describe('CR-1 Client Lifecycle consumer — security gate integration', () => {
  beforeEach(() => {
    resetClientLifecycleConsumerForTest();
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', new LocalStorageMock());
  });

  it('denies create when session is missing', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    expect(() =>
      createClientWithInvite({
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
      })
    ).toThrow(ClientLifecycleError);
  });

  it('denies create when role is CLIENT', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      ...adminUser(),
      uid: 'u_client',
      role: 'CLIENT',
      clientId: 'client_own',
    });
    expect(() =>
      createClientWithInvite({
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
      })
    ).toThrow(ClientLifecycleError);
  });

  it('legitimate ADMIN create uses session organization only', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(adminUser());
    const result = createClientWithInvite({
      firstName: 'Luis',
      lastName: 'Gómez',
      email: `luis_${Date.now()}@example.com`,
      profession: 'Consultor',
      company: 'Acme',
      targetMarket: 'B2B',
      claimedOrganizationId: 'org_from_session',
    });
    expect(result.client.organizationId).toBe('org_from_session');
    expect(result.client.status).toBe('INVITED');
    expect(result.invitation.status).toBe('PENDING');
    expect(dbService.getClientById(result.client.id)?.organizationId).toBe('org_from_session');
  });

  it('ATTACK: claimedOrganizationId spoof denied at consumer', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(adminUser());
    expect(() =>
      createClientWithInvite({
        firstName: 'X',
        lastName: 'Y',
        email: 'spoof@example.com',
        claimedOrganizationId: 'org_attacker',
      })
    ).toThrow(/organizationId|trusted/i);
  });
});

describe('CR-1 Client Lifecycle architecture / adoption', () => {
  it('compose wires both canonical commands', () => {
    const composed = composeClientLifecycle();
    expect(typeof composed.createClientWithInvite).toBe('function');
    expect(typeof composed.acceptClientInvitation).toBe('function');
  });

  it('main.ts adopts canonical consumer for #34 and #1 (no direct db writes)', () => {
    const source = readLegacyControllerSurface();
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/createClientWithInvite\s*\(/);
    expect(code).toMatch(/acceptClientInvitation\s*\(/);
    expect(code).not.toMatch(/dbService\.createClient\s*\(/);
    expect(code).not.toMatch(/dbService\.createInvitation\s*\(/);
    expect(code).not.toMatch(/dbService\.markInvitationAccepted\s*\(/);
    expect(code).not.toMatch(/createPendingAccount\s*\(/);
  });

  it('command seam exposes clientLifecycleCommands without dbService mutations', () => {
    const source = readFileSync(resolve('src/ui/commands/commandSeam.ts'), 'utf8');
    expect(source).toMatch(/clientLifecycleCommands/);
    expect(source).toMatch(/createClientWithInvite/);
    expect(source).toMatch(/acceptClientInvitation/);
    expect(source).not.toMatch(/dbService\./);
  });

  it('React layer still has zero createClient / markInvitationAccepted calls', () => {
    const files = [
      'src/ui/modules/pages/ReactManagerCockpitPage.tsx',
      'src/ui/modules/pages/modals/ReactModals.tsx',
      'src/ui/commands/commandSeam.ts',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).not.toMatch(/\bcreateClient\s*\(/);
      expect(source).not.toMatch(/\bmarkInvitationAccepted\s*\(/);
    }
  });
});
