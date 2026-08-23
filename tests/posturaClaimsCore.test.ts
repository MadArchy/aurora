import { describe, expect, it } from 'vitest';
import {
  buildPosturaClaimsOrThrow,
  ClaimsProvisionError,
  parsePosturaClaims,
} from '../src/domain/posturaClaimsCore';

describe('posturaClaimsCore (SPEC-009 Phase 4 / A9)', () => {
  it('ADMIN valid claims PASS', () => {
    expect(parsePosturaClaims({ role: 'ADMIN', organizationId: 'org_1' })).toEqual({
      role: 'ADMIN',
      organizationId: 'org_1',
      clientId: null,
    });
    expect(buildPosturaClaimsOrThrow({ role: 'ADMIN', organizationId: 'org_1' })).toEqual({
      role: 'ADMIN',
      organizationId: 'org_1',
      clientId: null,
    });
  });

  it('CLIENT valid claims PASS', () => {
    expect(
      parsePosturaClaims({ role: 'CLIENT', organizationId: 'org_1', clientId: 'client_1' })
    ).toEqual({
      role: 'CLIENT',
      organizationId: 'org_1',
      clientId: 'client_1',
    });
  });

  it('missing organizationId DENY/throw', () => {
    expect(parsePosturaClaims({ role: 'ADMIN' })).toBeNull();
    expect(parsePosturaClaims({ role: 'CLIENT', clientId: 'c1' })).toBeNull();
    expect(() => buildPosturaClaimsOrThrow({ role: 'ADMIN' })).toThrow(ClaimsProvisionError);
    expect(() => buildPosturaClaimsOrThrow({ role: 'ADMIN', organizationId: '  ' })).toThrow(
      /organizationId/
    );
  });

  it('CLIENT missing clientId DENY/throw', () => {
    expect(parsePosturaClaims({ role: 'CLIENT', organizationId: 'org_1' })).toBeNull();
    expect(() =>
      buildPosturaClaimsOrThrow({ role: 'CLIENT', organizationId: 'org_1' })
    ).toThrow(/clientId/);
  });

  it('invalid role DENY/throw', () => {
    expect(parsePosturaClaims({ role: 'SUPERUSER', organizationId: 'org_1' })).toBeNull();
    expect(() =>
      buildPosturaClaimsOrThrow({ role: 'MANAGER', organizationId: 'org_1' })
    ).toThrow(ClaimsProvisionError);
  });

  it('ADMIN cannot silently inherit demo tenant', () => {
    expect(parsePosturaClaims({ role: 'ADMIN', clientId: 'client_1' })).toBeNull();
    expect(() => buildPosturaClaimsOrThrow({ role: 'ADMIN', clientId: 'x' })).toThrow(
      /organizationId/
    );
  });

  it('CLIENT cannot silently inherit demo tenant', () => {
    expect(parsePosturaClaims({ role: 'CLIENT', clientId: 'client_1' })).toBeNull();
    expect(() =>
      buildPosturaClaimsOrThrow({ role: 'CLIENT', clientId: 'client_1' })
    ).toThrow(/organizationId/);
  });

  it('ADMIN strips clientId authority (no escalation)', () => {
    expect(
      buildPosturaClaimsOrThrow({
        role: 'ADMIN',
        organizationId: 'org_1',
        clientId: 'should_be_ignored',
      })
    ).toEqual({ role: 'ADMIN', organizationId: 'org_1', clientId: null });
  });
});
