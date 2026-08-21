import { describe, expect, it } from 'vitest';
import {
  canAccessClientResource,
  filterByClientId,
  resolveTrustedRole,
} from '../src/domain/clientIsolationCore';

describe('clientIsolationCore', () => {
  it('filtra filas por clientId estricto', () => {
    const rows = [
      { id: 'a', clientId: 'client_juan_001' },
      { id: 'b', clientId: 'client_other' },
      { id: 'c', clientId: 'client_juan_001' },
    ];
    expect(filterByClientId(rows, 'client_juan_001').map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('deniega acceso cruzado a CLIENT', () => {
    const juan = { role: 'CLIENT' as const, clientId: 'client_juan_001' };
    expect(canAccessClientResource(juan, 'client_juan_001')).toBe(true);
    expect(canAccessClientResource(juan, 'client_other')).toBe(false);
    expect(canAccessClientResource({ role: 'ADMIN' }, 'client_other')).toBe(true);
  });

  it('ignora rol adulterado en sesión si difiere de la cuenta', () => {
    expect(resolveTrustedRole('CLIENT', 'ADMIN')).toBe('CLIENT');
    expect(resolveTrustedRole('ADMIN', 'ADMIN')).toBe('ADMIN');
  });
});
