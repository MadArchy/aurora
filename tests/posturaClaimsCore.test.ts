import { describe, expect, it } from 'vitest';
import { parsePosturaClaims } from '../src/firebase/claims';

describe('parsePosturaClaims (client + functions parity)', () => {
  it('accepts ADMIN claims', () => {
    expect(parsePosturaClaims({ role: 'ADMIN', organizationId: 'org_1' })).toEqual({
      role: 'ADMIN',
      organizationId: 'org_1',
      clientId: null,
    });
  });

  it('requires clientId for CLIENT role', () => {
    expect(parsePosturaClaims({ role: 'CLIENT' })).toBeNull();
    expect(parsePosturaClaims({ role: 'CLIENT', clientId: 'c1' })).toEqual({
      role: 'CLIENT',
      organizationId: 'org_aurora_01',
      clientId: 'c1',
    });
  });

  it('rejects unknown roles', () => {
    expect(parsePosturaClaims({ role: 'MANAGER' })).toBeNull();
  });
});
