/**
 * SPEC-010 T-010-501 — adversarial authority suite (A16, A17, A18 · T-010-09…11).
 */
import { describe, expect, it } from 'vitest';
import {
  requireAdminActor,
  requireTenantScope,
  type TenantGateDeps,
} from '../src/controllers/trustedTenant';
import {
  buildTrustedTenantScope,
  narrowToClient,
  UntrustedTenantScopeError,
  type TrustedTenantScope,
} from '../src/ui/query/tenantScope';
import type { Client, User, UserRole } from '../src/types';
import { code, COMMAND_SEAM, read, REACT_UI_FILES, rel, ROOT } from './lib/reactMigrationPhase5Surface';
import { join } from 'node:path';

const ORG_A = 'org_a';
const ORG_B = 'org_b';

function user(overrides: Partial<User> & { role: UserRole }): User {
  return {
    uid: 'user_1',
    organizationId: ORG_A,
    email: 'a@example.com',
    displayName: 'A',
    status: 'ACTIVE',
    clientId: null,
    mustCompleteOnboarding: false,
    aiKeyManagementAllowed: false,
    locale: 'es',
    timezone: 'UTC',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as User;
}

function client(id: string, organizationId: string): Client {
  return {
    id,
    organizationId,
    primaryManagerId: 'user_1',
    firstName: 'C',
    lastName: 'L',
    displayName: 'C L',
    primaryEmail: 'c@example.com',
    onboardingStatus: 'COMPLETED',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user_1',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'user_1',
    activeThesesCount: 0,
    completedTasksCount: 0,
  } as Client;
}

function deps(current: User | null, clients: Client[] = []): TenantGateDeps {
  return {
    getCurrentUser: () => current,
    getClientById: (id) => clients.find((c) => c.id === id),
  };
}

const CLIENT_A1 = client('client_a1', ORG_A);
const CLIENT_B1 = client('client_b1', ORG_B);

describe('T-010-501 — tenant gate adversarial matrix', () => {
  it('TENANT AUTHORITY BYPASS = 0 — CLIENT cannot propose another tenant', () => {
    const grant = requireTenantScope(
      'client_b1',
      deps(user({ role: 'CLIENT', clientId: 'client_a1', organizationId: ORG_A }), [CLIENT_A1, CLIENT_B1])
    );
    expect(grant.ok).toBe(false);
  });

  it('TENANT AUTHORITY BYPASS = 0 — ADMIN cannot reach outside organization', () => {
    const grant = requireTenantScope(
      'client_b1',
      deps(user({ role: 'ADMIN', clientId: null, organizationId: ORG_A }), [CLIENT_A1, CLIENT_B1])
    );
    expect(grant.ok).toBe(false);
  });

  it('CROSS-TENANT SUCCESS = 0 — unknown client is refused', () => {
    const grant = requireTenantScope('missing', deps(user({ role: 'ADMIN' }), [CLIENT_A1]));
    expect(grant.ok).toBe(false);
  });

  it('ACTOR AUTHORITY BYPASS = 0 — tenant-less caller refused', () => {
    const grant = requireTenantScope('client_a1', deps(null, [CLIENT_A1]));
    expect(grant.ok).toBe(false);
  });
});

describe('T-010-501 — admin actor gate', () => {
  it('ROLE AUTHORITY BYPASS = 0 — CLIENT actor cannot run admin-only utility', () => {
    const result = requireAdminActor(deps(user({ role: 'CLIENT', clientId: 'client_a1' })));
    expect(result.ok).toBe(false);
  });

  it('ROLE AUTHORITY BYPASS = 0 — sessionless caller refused', () => {
    expect(requireAdminActor(deps(null)).ok).toBe(false);
  });
});

describe('T-010-501 — trusted tenant scope construction', () => {
  it('rejects forged organization on trusted user build', () => {
    expect(() => buildTrustedTenantScope(user({ role: 'ADMIN', organizationId: '  ' }))).toThrow(
      UntrustedTenantScopeError
    );
  });

  it('rejects CLIENT session without clientId', () => {
    expect(() =>
      buildTrustedTenantScope(user({ role: 'CLIENT', clientId: null, organizationId: ORG_A }))
    ).toThrow(UntrustedTenantScopeError);
  });

  it('CROSS-TENANT SUCCESS = 0 — client scope cannot narrow to alien client', () => {
    const scope = buildTrustedTenantScope(
      user({ role: 'CLIENT', clientId: 'client_a1', organizationId: ORG_A })
    );
    expect(() => narrowToClient(scope, 'client_b1')).toThrow(UntrustedTenantScopeError);
  });
});

describe('T-010-501 — React layer cannot manufacture identity literals', () => {
  it('no React UI file assigns admin/manager authority literally', () => {
    const forbidden = [
      /\brole\s*[:=]\s*['"]ADMIN['"]/,
      /\bactorType\s*[:=]\s*['"]HUMAN['"]/,
      /\bisManager\s*[:=]\s*true/,
      /\bisAdmin\s*[:=]\s*true\b/,
    ];
    const offenders = REACT_UI_FILES.filter((file) =>
      forbidden.some((pattern) => pattern.test(code(file)))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('tenant scope brand prevents UI-side forgery', () => {
    const source = read(join(ROOT, 'src/ui/query/tenantScope.ts'));
    expect(source).toContain('declare const trustedTenantBrand: unique symbol');
    expect(source).toMatch(/export function buildTrustedTenantScope\(user: User\)/);
  });

  it('command seam documents caller tenant/actor authority = 0', () => {
    const seam = read(join(ROOT, COMMAND_SEAM));
    expect(seam).toContain('AUTHORITY: NONE');
    expect(seam).not.toMatch(/actorRole\s*:/);
  });
});

describe('T-010-501 — forged scope objects do not satisfy narrowToClient', () => {
  it('plain object scope is not a trusted scope at runtime', () => {
    const forged = { organizationId: ORG_A, clientId: 'client_a1' } as TrustedTenantScope;
    expect(() => narrowToClient(forged, 'client_b1')).toThrow(UntrustedTenantScopeError);
  });
});
