import { describe, expect, it } from 'vitest';

describe('local demo workspace open', () => {
  it('opens a client already in memory when Firebase is off and no directory load is running', async () => {
    const { authService } = await import('../src/services/auth');
    const { dbService } = await import('../src/services/db');

    expect(dbService.getAdminDirectoryPhase()).not.toBe('READY');
    authService.setCurrentUserForTesting({
      uid: 'user_admin_01',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
      clientId: null,
      email: 'manager@postura.internal',
      displayName: 'Manager',
    } as never);

    const opened = await authService.openAdminClientWorkspace('client_juan_001');

    expect(opened).toEqual({ ok: true, clientId: 'client_juan_001' });
  });
});
