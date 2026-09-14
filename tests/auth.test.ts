import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('registerFromInvite pending account activation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('activates INVITED pending account created by createPendingAccount', async () => {
    const { authService } = await import('../src/services/auth');
    await authService.ready;

    authService.createPendingAccount('invite@example.com', 'client_p15', 'org_aurora_01');
    const invite = {
      id: 'inv_p15',
      organizationId: 'org_aurora_01',
      clientId: 'client_p15',
      email: 'invite@example.com',
      token: 'tok_p15',
      status: 'PENDING' as const,
      expiresAt: '2099-01-01T00:00:00.000Z',
      createdAt: '2026-08-28T12:00:00.000Z',
    };

    const result = await authService.registerFromInvite(invite, 'Postura2026!', 'Invite User');
    expect(result.ok).toBe(true);
    expect(authService.getCurrentUser()?.displayName).toBe('Invite User');
    expect(authService.getCurrentUser()?.mustCompleteOnboarding).toBe(true);
  });

  it('rejects when an ACTIVE account already exists for the email', async () => {
    localStorage.setItem(
      'postura_accounts_v4',
      JSON.stringify([
        {
          uid: 'user_active',
          email: 'active@example.com',
          passwordSalt: 'salt',
          passwordHash: 'hash',
          role: 'CLIENT',
          organizationId: 'org_aurora_01',
          clientId: 'client_other',
          status: 'ACTIVE',
        },
      ])
    );

    const { authService } = await import('../src/services/auth');
    await authService.ready;

    const invite = {
      id: 'inv_active',
      organizationId: 'org_aurora_01',
      clientId: 'client_p15',
      email: 'active@example.com',
      token: 'tok_active',
      status: 'PENDING' as const,
      expiresAt: '2099-01-01T00:00:00.000Z',
      createdAt: '2026-08-28T12:00:00.000Z',
    };

    const result = await authService.registerFromInvite(invite, 'Postura2026!', 'Active User');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe('Ya existe una cuenta con ese correo.');
    }
  });
});

describe('auth session restoration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('restores role from account, not tampered session metadata', async () => {
    const accounts = [
      {
        uid: 'user_client_juan_01',
        email: 'juan.vasquez@lexfirm.com',
        passwordSalt: 'salt',
        passwordHash: 'hash',
        role: 'CLIENT' as const,
        organizationId: 'org_aurora_01',
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
