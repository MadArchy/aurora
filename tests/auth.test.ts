import { describe, expect, it } from 'vitest';

describe('auth session restoration', () => {
  it('restores role from account, not tampered session metadata', async () => {
    const accounts = [
      {
        uid: 'user_client_juan_01',
        email: 'juan.vasquez@lexfirm.com',
        passwordSalt: 'salt',
        passwordHash: 'hash',
        role: 'CLIENT' as const,
        clientId: 'client_juan_001',
        status: 'ACTIVE' as const,
      },
    ];

    localStorage.setItem('postura_accounts_v4', JSON.stringify(accounts));
    localStorage.setItem(
      'postura_session_v4',
      JSON.stringify({ uid: 'user_client_juan_01', displayName: 'Admin Hacker', role: 'ADMIN' })
    );

    const { authService } = await import('../src/services/auth');
    await authService.ready;
    const user = authService.getCurrentUser();
    expect(user?.role).toBe('CLIENT');
    expect(user?.uid).toBe('user_client_juan_01');
  });
});
