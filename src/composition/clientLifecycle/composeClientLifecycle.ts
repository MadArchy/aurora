import {
  createAcceptClientInvitation,
  createCreateClientWithInvite,
  type ClientIdentityActivationPort,
  type ClientShellPort,
  type InvitationPort,
  type PendingAccountPort,
} from '../../application/clientLifecycle';
import {
  createAuthIdentityActivationPort,
  createAuthPendingAccountPort,
  createDbClientShellPort,
  createDbInvitationPort,
} from '../../infrastructure/clientLifecycle';

export interface ComposeClientLifecycleOptions {
  clients?: ClientShellPort;
  invitations?: InvitationPort;
  pendingAccounts?: PendingAccountPort;
  identity?: ClientIdentityActivationPort;
  now?: () => number;
}

/**
 * Composition root for CR-1 Client Lifecycle.
 * Default wiring uses temporary legacy adapters (dbService / authService).
 */
export function composeClientLifecycle(options: ComposeClientLifecycleOptions = {}) {
  const clients = options.clients ?? createDbClientShellPort();
  const invitations = options.invitations ?? createDbInvitationPort();
  const pendingAccounts = options.pendingAccounts ?? createAuthPendingAccountPort();
  const identity = options.identity ?? createAuthIdentityActivationPort();

  return {
    createClientWithInvite: createCreateClientWithInvite({
      clients,
      invitations,
      pendingAccounts,
    }),
    acceptClientInvitation: createAcceptClientInvitation({
      clients,
      invitations,
      identity,
      now: options.now,
    }),
  };
}
