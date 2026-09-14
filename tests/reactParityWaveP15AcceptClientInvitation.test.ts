/**
 * SPEC-010 · T603 React Parity Wave P15 — Registry #1 AcceptClientInvitation.
 *
 * Presentation parity only. Frozen Application/Domain; #34/#10 unchanged.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const acceptCalls: { token: string; password: string; displayName: string }[] = [];

let acceptImpl: ((intent: (typeof acceptCalls)[number]) => Promise<{ ok: boolean; message?: string }>) | null =
  null;

vi.mock('../src/services/clientLifecycleConsumer', () => ({
  acceptClientInvitation: (intent: (typeof acceptCalls)[number]) => {
    acceptCalls.push(intent);
    if (acceptImpl) return acceptImpl(intent);
    return Promise.resolve({ ok: true });
  },
}));

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function code(rel: string): string {
  return read(rel).replace(/\s+/g, ' ');
}

describe('P15 §1–§11 — #1 registry and public input', () => {
  beforeEach(() => {
    acceptCalls.length = 0;
    acceptImpl = null;
  });

  it('command seam exposes acceptInvitation delegating to consumer', async () => {
    const { clientLifecycleCommands } = await import('../src/ui/commands/commandSeam');
    const result = await clientLifecycleCommands.acceptInvitation({
      token: 'tok_fixture',
      password: 'secret-pass',
      displayName: 'Ana Pérez',
    });
    expect(result.ok).toBe(true);
    expect(acceptCalls).toHaveLength(1);
    expect(acceptCalls[0]).toEqual({
      token: 'tok_fixture',
      password: 'secret-pass',
      displayName: 'Ana Pérez',
    });
  });

  it('seam surfaces canonical ClientLifecycleError messages', async () => {
    acceptImpl = async () => {
      const { ClientLifecycleError } = await import('../src/application/clientLifecycle');
      throw new ClientLifecycleError('INVITATION_NOT_FOUND', 'Token de invitación inválido.');
    };
    const { clientLifecycleCommands } = await import('../src/ui/commands/commandSeam');
    const result = await clientLifecycleCommands.acceptInvitation({
      token: 'bad',
      password: 'x',
      displayName: 'Y',
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Token de invitación inválido');
  });

  it('ReactLogin invite form exposes token/password/displayName only', () => {
    const login = read('src/ui/modules/Login/ReactLogin.tsx');
    expect(login).toMatch(/react-login-invite-token/);
    expect(login).toMatch(/inviteToken\.trim\(\)/);
    expect(login).toMatch(/popstate/);
    expect(login).toMatch(/react-login-invite-name/);
    expect(login).toMatch(/react-login-invite-password/);
    expect(login).not.toMatch(/organizationId/);
    expect(login).not.toMatch(/clientId/);
    expect(login).not.toMatch(/claimedOrganizationId/);
    expect(login).not.toMatch(/actorRole/);
    expect(login).not.toMatch(/claimedRole/);
    expect(login).not.toMatch(/\bdbService\b/);
  });

  it('?invite= detection is presentation-only URL read', () => {
    const login = read('src/ui/modules/Login/ReactLogin.tsx');
    expect(login).toMatch(/URLSearchParams/);
    expect(login).toMatch(/get\('invite'\)/);
    expect(login).not.toMatch(/getInvitationByToken/);
  });

  it('email login branch preserved when no invite query', () => {
    const login = read('src/ui/modules/Login/ReactLogin.tsx');
    expect(login).toMatch(/react-login-email-card/);
    expect(login).toMatch(/sessionCommands\.login/);
    expect(login).toMatch(/showInviteFlow/);
  });
});

describe('P15 §16–§23 — hook, seam, session, boundaries', () => {
  it('hook delegates to clientLifecycleCommands without dbService', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useAcceptClientInvitation/);
    const idx = hooks.indexOf('export function useAcceptClientInvitation');
    const block = hooks.slice(idx, idx + 450);
    expect(block).toMatch(/clientLifecycleCommands\.acceptInvitation/);
    expect(block).not.toMatch(/\bdbService\b/);
    expect(block).not.toMatch(/tenantScope/);
  });

  it('ReactLogin uses hook not consumer directly', () => {
    const login = read('src/ui/modules/Login/ReactLogin.tsx');
    expect(login).toMatch(/useAcceptClientInvitation/);
    expect(login).not.toMatch(/acceptClientInvitation/);
    expect(login).not.toMatch(/sessionCommands\.login.*accept/);
  });

  it('no second login after invite accept', () => {
    const login = read('src/ui/modules/Login/ReactLogin.tsx');
    const start = login.indexOf('function InviteAcceptCard');
    const end = login.indexOf('export function ReactLogin');
    const inviteBlock = login.slice(start, end);
    expect(inviteBlock).toMatch(/accept\.mutateAsync/);
    expect(inviteBlock).not.toMatch(/sessionCommands\.login/);
  });

  it('frozen identity path unchanged in infrastructure adapter', () => {
    const adapter = read('src/infrastructure/clientLifecycle/DbClientLifecycleAdapters.ts');
    expect(adapter).toMatch(/registerFromInvite/);
    expect(adapter).toMatch(/authService\.registerFromInvite/);
  });

  it('legacy invite handlers retained for rollback', () => {
    const legacy = read('src/ui/legacy/handlers/loginHandlers.ts');
    expect(legacy).toMatch(/form-accept-invite/);
    expect(legacy).toMatch(/acceptClientInvitation/);
  });

  it('P14 cockpit create path does not use acceptInvitation', () => {
    const cockpit = read('src/ui/modules/pages/ReactManagerCockpitPage.tsx');
    expect(cockpit).not.toMatch(/acceptInvitation/);
    expect(cockpit).toMatch(/useCreateClientWithInvite/);
  });

  it('ReactLogin and hook import no dbService', () => {
    expect(read('src/ui/modules/Login/ReactLogin.tsx')).not.toMatch(/\bdbService\b/);
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    const idx = hooks.indexOf('export function useAcceptClientInvitation');
    expect(hooks.slice(idx, idx + 450)).not.toMatch(/\bdbService\b/);
  });
});

describe('P15 §28 — authority and non-regression guards', () => {
  it('Application AcceptClientInvitation input is token password displayName only', () => {
    const app = read('src/application/clientLifecycle/AcceptClientInvitation.ts');
    expect(app).toMatch(/token: string/);
    expect(app).toMatch(/password: string/);
    expect(app).toMatch(/displayName: string/);
    expect(app).not.toMatch(/organizationId\?:/);
    expect(app).not.toMatch(/clientId\?:/);
  });

  it('P6 onboarding wizard untouched by P15 login work', () => {
    const onboarding = read('src/ui/modules/Onboarding/ReactOnboardingWizard.tsx');
    expect(onboarding).toMatch(/useApplyOnboardingStep/);
    expect(onboarding).not.toMatch(/acceptInvitation/);
  });
});
