/**
 * SPEC-010 T-010-502 — adversarial cache suite (A11, A14, A15, A19 · T-010-05…08).
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  buildTrustedTenantScope,
  tenantScopeKey,
  type TrustedTenantScope,
} from '../src/ui/query/tenantScope';
import type { User } from '../src/types';
import {
  code,
  read,
  REACT_UI_FILES,
  rel,
  ROOT,
  UI_FILES,
} from './lib/reactMigrationPhase5Surface';

function user(overrides: Partial<User>): User {
  return {
    uid: 'u1',
    organizationId: 'org_a',
    email: 'a@test',
    displayName: 'A',
    role: 'ADMIN',
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

describe('T-010-502 — query client is non-authoritative', () => {
  it('UNSCOPED AUTHORITATIVE CACHE = 0 — staleTime 0 and retry 0', () => {
    const source = read(join(ROOT, 'src/ui/providers/QueryProvider.tsx'));
    expect(source).toContain('NONAUTHORITATIVE_CACHE');
    expect(source).toMatch(/staleTime:\s*0/);
    expect(source).toMatch(/retry:\s*0/);
  });

  it('no optimistic mutation hooks in React UI', () => {
    const offenders = UI_FILES.filter((file) => /onMutate\s*:/.test(code(file))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('no setQueryData authority injection in React UI', () => {
    const offenders = REACT_UI_FILES.filter((file) => /\bsetQueryData\s*\(/.test(code(file))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('T-010-502 — tenant-safe query keys', () => {
  it('tenantQueryKey requires TrustedTenantScope', () => {
    const source = read(join(ROOT, 'src/ui/query/queryKeys.ts'));
    expect(source).toMatch(/export function tenantQueryKey\(\s*scope: TrustedTenantScope/);
  });

  it('CROSS-TENANT CACHE BLEED = 0 — org/client tuple differs across tenants', () => {
    const scopeA = buildTrustedTenantScope(user({ organizationId: 'org_a', clientId: null }));
    const scopeB = buildTrustedTenantScope(user({ organizationId: 'org_b', clientId: null }));
    expect(tenantScopeKey(scopeA)).not.toEqual(tenantScopeKey(scopeB));
  });

  it('CROSS-TENANT CACHE BLEED = 0 — same entity id different orgs produce different scope keys', () => {
    const scopeA = buildTrustedTenantScope(
      user({ organizationId: 'org_a', role: 'CLIENT', clientId: 'client_1' })
    );
    const scopeB = buildTrustedTenantScope(
      user({ organizationId: 'org_b', role: 'CLIENT', clientId: 'client_1' })
    );
    expect(tenantScopeKey(scopeA)).not.toEqual(tenantScopeKey(scopeB));
  });

  it('session client switch produces distinct cache scope keys', () => {
    const admin = buildTrustedTenantScope(user({ role: 'ADMIN', organizationId: 'org_a' }));
    const narrowed = { organizationId: 'org_a', clientId: 'client_1' } as TrustedTenantScope;
    expect(tenantScopeKey(admin)).not.toEqual(tenantScopeKey(narrowed));
  });

  it('no bare entity-only query keys in React UI', () => {
    const offenders: string[] = [];
    for (const file of REACT_UI_FILES) {
      const source = code(file);
      const matches = source.match(/queryKey:\s*\[[^\]]*\]/g) ?? [];
      for (const match of matches) {
        if (!match.includes("['disabled']")) offenders.push(`${rel(file)} → ${match}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
