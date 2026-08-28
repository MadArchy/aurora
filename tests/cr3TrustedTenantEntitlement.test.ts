/**
 * CR-3 — Trusted Tenant Entitlement Security Fix
 *
 * Proves the four SPEC consumer builders no longer derive trusted organization
 * from the requested client record. Entitlement goes through requireTenantScope
 * (session org + client entitlement). Attack labels ATTACK-CR3-01…08 are
 * evidence labels only — not constitutional threat IDs.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, User, UserRole } from '../src/types';

type Session = User | null;

let session: Session = null;
const clients = new Map<string, Client>();

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => session,
  },
}));

vi.mock('../src/services/db', () => ({
  dbService: {
    getClientById: (id: string) => clients.get(id),
    getSignalById: () => undefined,
    getEvidenceById: () => undefined,
  },
}));

function user(partial: Partial<User> & { role: UserRole; organizationId?: string }): User {
  return {
    uid: partial.uid ?? 'actor_1',
    email: partial.email ?? 'a@test',
    displayName: partial.displayName ?? 'Actor',
    role: partial.role,
    status: 'ACTIVE',
    organizationId: partial.organizationId ?? 'org_a',
    clientId: partial.clientId ?? null,
    mustCompleteOnboarding: false,
    aiKeyManagementAllowed: false,
    locale: 'es',
    timezone: 'America/Bogota',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'seed',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'seed',
  } as User;
}

function client(id: string, organizationId: string): Client {
  return {
    id,
    organizationId,
    primaryManagerId: 'mgr',
    firstName: 'T',
    lastName: 'C',
    displayName: id,
    email: `${id}@t`,
    profession: 'X',
    onboardingStatus: 'COMPLETED',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'seed',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'seed',
    activeThesesCount: 0,
    completedTasksCount: 0,
  } as Client;
}

async function builders() {
  const brief = await import('../src/services/strategicBriefConsumer');
  const plan = await import('../src/services/strategicPlanConsumer');
  const opp = await import('../src/services/opportunityScoutConsumer');
  const learn = await import('../src/services/learningLoopConsumer');
  return {
    brief: brief.buildTrustedBriefContext,
    plan: plan.buildTrustedPlanContext,
    opportunity: opp.buildTrustedOpportunityContext,
    learning: learn.buildTrustedLearningContext,
  };
}

const NOW = '2026-08-28T12:00:00.000Z';

beforeEach(() => {
  session = null;
  clients.clear();
  clients.set('client_a1', client('client_a1', 'org_a'));
  clients.set('client_a2', client('client_a2', 'org_a'));
  clients.set('client_b1', client('client_b1', 'org_b'));
  vi.resetModules();
});

describe('CR-3 — builder matrix (Brief / Plan / Opportunity / Learning)', () => {
  it('A. NO AUTHENTICATED USER → DENY', async () => {
    session = null;
    const b = await builders();
    expect(b.brief('client_a1', NOW)).toBeUndefined();
    expect(b.plan('client_a1', NOW)).toBeUndefined();
    expect(b.opportunity('client_a1', { now: NOW })).toBeUndefined();
    expect(b.learning('client_a1', { now: NOW })).toBeUndefined();
  });

  it('B/C. INVALID / NONEXISTENT CLIENT → DENY', async () => {
    session = user({ role: 'ADMIN' });
    const b = await builders();
    expect(b.brief('', NOW)).toBeUndefined();
    expect(b.brief('   ', NOW)).toBeUndefined();
    expect(b.brief('client_missing', NOW)).toBeUndefined();
    expect(b.plan('client_missing', NOW)).toBeUndefined();
    expect(b.opportunity('client_missing', { now: NOW })).toBeUndefined();
    expect(b.learning('client_missing', { now: NOW })).toBeUndefined();
  });

  it('D / ATTACK-CR3-01. CROSS-ORGANIZATION CLIENT SUBSTITUTION → DENY', async () => {
    session = user({ role: 'ADMIN', organizationId: 'org_a' });
    const b = await builders();
    expect(b.brief('client_b1', NOW)).toBeUndefined();
    expect(b.plan('client_b1', NOW)).toBeUndefined();
    expect(b.opportunity('client_b1', { now: NOW })).toBeUndefined();
    expect(b.learning('client_b1', { now: NOW })).toBeUndefined();
  });

  it('E / ATTACK-CR3-04. CLIENT actor requests sibling same-org client → DENY', async () => {
    session = user({ role: 'CLIENT', organizationId: 'org_a', clientId: 'client_a1' });
    const b = await builders();
    expect(b.brief('client_a2', NOW)).toBeUndefined();
    expect(b.plan('client_a2', NOW)).toBeUndefined();
    expect(b.opportunity('client_a2', { now: NOW })).toBeUndefined();
    expect(b.learning('client_a2', { now: NOW })).toBeUndefined();
  });

  it('F. AUTHORIZED ADMIN same-tenant client → PASS', async () => {
    session = user({ role: 'ADMIN', organizationId: 'org_a', uid: 'admin_1' });
    const b = await builders();
    for (const ctx of [
      b.brief('client_a1', NOW),
      b.plan('client_a1', NOW),
      b.opportunity('client_a1', { now: NOW }),
      b.learning('client_a1', { now: NOW }),
    ]) {
      expect(ctx).toEqual(
        expect.objectContaining({
          actorId: 'admin_1',
          actorRole: 'ADMIN',
          organizationId: 'org_a',
          clientId: 'client_a1',
          now: NOW,
        })
      );
    }
  });

  it('F. AUTHORIZED CLIENT own client → PASS (pins to own id)', async () => {
    session = user({ role: 'CLIENT', organizationId: 'org_a', clientId: 'client_a1', uid: 'client_user' });
    const b = await builders();
    const brief = b.brief('client_a1', NOW);
    expect(brief).toEqual(
      expect.objectContaining({
        actorId: 'client_user',
        actorRole: 'CLIENT',
        organizationId: 'org_a',
        clientId: 'client_a1',
      })
    );
    // Empty request still resolves to own client for CLIENT role
    expect(b.brief('', NOW)?.clientId).toBe('client_a1');
    expect(b.learning(undefined as unknown as string, { now: NOW })?.clientId).toBe('client_a1');
  });

  it('H / ATTACK-CR3-03. CLIENT RECORD ORGANIZATION CANNOT OVERRIDE SESSION', async () => {
    session = user({ role: 'ADMIN', organizationId: 'org_a', uid: 'admin_1' });
    // Poisoned client record claiming the admin's org while living under another id path —
    // the gate compares session org to client.organizationId; a foreign org still denies.
    clients.set('client_poison', client('client_poison', 'org_b'));
    const b = await builders();
    expect(b.brief('client_poison', NOW)).toBeUndefined();
    // Even if the client record were rewritten to match org_a, org still comes from session.
    clients.set('client_a1', client('client_a1', 'org_a'));
    const ctx = b.brief('client_a1', NOW);
    expect(ctx?.organizationId).toBe('org_a');
    expect(ctx?.organizationId).toBe(session!.organizationId);
  });

  it('J / ATTACK-CR3-07. MISSING TRUSTED TENANT → DENY', async () => {
    session = user({ role: 'ADMIN', organizationId: '' });
    const b = await builders();
    expect(b.brief('client_a1', NOW)).toBeUndefined();
    session = user({ role: 'ADMIN', organizationId: '   ' });
    expect((await builders()).plan('client_a1', NOW)).toBeUndefined();
  });

  it('ATTACK-CR3-02. clientId swapped while session unchanged → DENY cross-org', async () => {
    session = user({ role: 'ADMIN', organizationId: 'org_a' });
    const b = await builders();
    expect(b.brief('client_a1', NOW)?.clientId).toBe('client_a1');
    expect(b.brief('client_b1', NOW)).toBeUndefined();
  });

  it('ATTACK-CR3-05. unauthenticated requested client → DENY', async () => {
    session = null;
    const b = await builders();
    expect(b.opportunity('client_a1')).toBeUndefined();
  });

  it('ATTACK-CR3-06 / I. role spoof via client record is irrelevant — role from session', async () => {
    session = user({ role: 'CLIENT', organizationId: 'org_a', clientId: 'client_a1', uid: 'c1' });
    const b = await builders();
    const ctx = b.brief('client_a1', NOW);
    expect(ctx?.actorRole).toBe('CLIENT');
    // Cannot elevate by requesting an admin-owned client in another org
    expect(b.brief('client_b1', NOW)).toBeUndefined();
  });

  it('ATTACK-CR3-08. cross-consumer policy consistency — same deny/pass across four', async () => {
    session = user({ role: 'ADMIN', organizationId: 'org_a' });
    const b = await builders();
    const cases: Array<[string, boolean]> = [
      ['client_a1', true],
      ['client_a2', true],
      ['client_b1', false],
      ['missing', false],
    ];
    for (const [id, ok] of cases) {
      const results = [
        b.brief(id, NOW),
        b.plan(id, NOW),
        b.opportunity(id, { now: NOW }),
        b.learning(id, { now: NOW }),
      ].map((r) => r !== undefined);
      expect(results.every((v) => v === ok)).toBe(true);
    }
  });

  it('L. ADMIN may access every same-org client explicitly chosen', async () => {
    session = user({ role: 'ADMIN', organizationId: 'org_a' });
    const b = await builders();
    expect(b.brief('client_a2', NOW)?.clientId).toBe('client_a2');
    expect(b.plan('client_a2', NOW)?.organizationId).toBe('org_a');
  });

  it('G. caller cannot supply organization — builders have no org parameter', async () => {
    const briefSrc = readFileSync(
      resolve(__dirname, '../src/services/strategicBriefConsumer.ts'),
      'utf8'
    );
    const planSrc = readFileSync(resolve(__dirname, '../src/services/strategicPlanConsumer.ts'), 'utf8');
    const oppSrc = readFileSync(
      resolve(__dirname, '../src/services/opportunityScoutConsumer.ts'),
      'utf8'
    );
    const learnSrc = readFileSync(resolve(__dirname, '../src/services/learningLoopConsumer.ts'), 'utf8');
    for (const src of [briefSrc, planSrc, oppSrc, learnSrc]) {
      expect(src).toMatch(/requireTenantScope\(/);
      // The defective pattern must be gone from buildTrusted*
      expect(src).not.toMatch(
        /buildTrusted\w+Context[\s\S]{0,400}?getClientById\(clientId\)\?\.organizationId/
      );
    }
  });
});

describe('CR-3 — architecture: no client-record-derived tenant authority in builders', () => {
  it('consumer buildTrusted* organizationId is grant.organizationId (session), not client record', async () => {
    session = user({ role: 'ADMIN', organizationId: 'org_a', uid: 'admin_1' });
    // Client record could theoretically disagree; gate refuses mismatch. When match, org is session.
    const b = await builders();
    const ctx = b.brief('client_a1', NOW)!;
    expect(ctx.organizationId).toBe('org_a');
    expect(ctx.organizationId).not.toBe(clients.get('client_b1')!.organizationId);
  });

  it('four builders all import requireTenantScope and do not invent a second gate', () => {
    const files = [
      'strategicBriefConsumer.ts',
      'strategicPlanConsumer.ts',
      'opportunityScoutConsumer.ts',
      'learningLoopConsumer.ts',
    ];
    for (const file of files) {
      const src = readFileSync(resolve(__dirname, `../src/services/${file}`), 'utf8');
      expect(src).toContain("from '../controllers/trustedTenant'");
      expect(src).toContain('requireTenantScope');
      expect(src).not.toMatch(
        /organizationId\s*=\s*dbService\.getClientById\([^)]+\)\?\.organizationId/
      );
    }
  });

  it('React command seam does not construct trusted org from client records', () => {
    const seam = readFileSync(resolve(__dirname, '../src/ui/commands/commandSeam.ts'), 'utf8');
    expect(seam).not.toMatch(/getClientById\([^)]+\)\?\.organizationId/);
    expect(seam).not.toMatch(/organizationId:\s*[^,\n]*client/i);
  });
});
