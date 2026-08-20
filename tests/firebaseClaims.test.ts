import { describe, expect, it } from 'vitest';
import { parsePosturaClaims } from '../src/firebase/claims';

describe('parsePosturaClaims', () => {
  it('accepts valid ADMIN claims', () => {
    expect(parsePosturaClaims({ role: 'ADMIN', organizationId: 'org_1' })).toEqual({
      role: 'ADMIN',
      organizationId: 'org_1',
      clientId: null,
    });
  });

  it('requires clientId for CLIENT role', () => {
    expect(parsePosturaClaims({ role: 'CLIENT' })).toBeNull();
    expect(parsePosturaClaims({ role: 'CLIENT', clientId: 'client_1' })).toEqual({
      role: 'CLIENT',
      organizationId: 'org_aurora_01',
      clientId: 'client_1',
    });
  });

  it('rejects unknown roles', () => {
    expect(parsePosturaClaims({ role: 'SUPERUSER' })).toBeNull();
  });
});
