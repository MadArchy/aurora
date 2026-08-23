import { describe, expect, it } from 'vitest';
import { parsePosturaClaims, buildPosturaClaimsOrThrow } from '../src/firebase/claims';

describe('parsePosturaClaims (firebase bridge)', () => {
  it('accepts valid ADMIN claims', () => {
    expect(parsePosturaClaims({ role: 'ADMIN', organizationId: 'org_1' })).toEqual({
      role: 'ADMIN',
      organizationId: 'org_1',
      clientId: null,
    });
  });

  it('requires organizationId and clientId for CLIENT', () => {
    expect(parsePosturaClaims({ role: 'CLIENT' })).toBeNull();
    expect(parsePosturaClaims({ role: 'CLIENT', clientId: 'client_1' })).toBeNull();
    expect(
      parsePosturaClaims({ role: 'CLIENT', organizationId: 'org_1', clientId: 'client_1' })
    ).toEqual({
      role: 'CLIENT',
      organizationId: 'org_1',
      clientId: 'client_1',
    });
  });

  it('rejects unknown roles and blank org', () => {
    expect(parsePosturaClaims({ role: 'SUPERUSER', organizationId: 'org_1' })).toBeNull();
    expect(parsePosturaClaims({ role: 'ADMIN', organizationId: '' })).toBeNull();
  });

  it('buildPosturaClaimsOrThrow matches setPosturaClaims contract', () => {
    expect(buildPosturaClaimsOrThrow({ role: 'ADMIN', organizationId: 'org_x' }).clientId).toBeNull();
  });
});
