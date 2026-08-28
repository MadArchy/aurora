import type { Client, Invitation } from '../../types';
import { ClientLifecycleError } from './errors';
import type { ClientShellPort } from './ports/ClientShellPort';
import type { InvitationPort } from './ports/InvitationPort';
import type { PendingAccountPort } from './ports/PendingAccountPort';
import {
  assertNoOrganizationSpoof,
  assertTrustedAdminActor,
  type TrustedClientLifecycleAdminContext,
} from './trustedContext';

/** Non-authoritative form fields required to create the client shell. */
export interface CreateClientWithInviteInput {
  trusted: TrustedClientLifecycleAdminContext;
  firstName: string;
  lastName: string;
  email: string;
  profession?: string;
  company?: string;
  targetMarket?: string;
  /** If present, must match trusted organization — never authority. */
  claimedOrganizationId?: string;
}

export interface CreateClientWithInviteResult {
  client: Client;
  invitation: Invitation;
}

export interface CreateClientWithInviteDeps {
  clients: ClientShellPort;
  invitations: InvitationPort;
  pendingAccounts: PendingAccountPort;
}

/**
 * CR-1 #34 — Create client shell + invitation + pending account.
 *
 * Orchestration authority lives here. Persistence is port-only.
 * No atomic store transaction exists; on mid-flight failure the Application
 * compensates by archiving the client and revoking any invitation created
 * (existing status enums — not a new Domain rule).
 */
export function createCreateClientWithInvite(deps: CreateClientWithInviteDeps) {
  return function createClientWithInvite(
    input: CreateClientWithInviteInput
  ): CreateClientWithInviteResult {
    assertTrustedAdminActor(input.trusted);
    assertNoOrganizationSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
    });

    const firstName = input.firstName?.trim() ?? '';
    const lastName = input.lastName?.trim() ?? '';
    const email = input.email?.trim() ?? '';
    if (!firstName || !lastName || !email) {
      throw new ClientLifecycleError(
        'INVALID_INPUT',
        'firstName, lastName and email are required.'
      );
    }
    if (!email.includes('@')) {
      throw new ClientLifecycleError('INVALID_INPUT', 'email must be a valid address.');
    }

    const organizationId = input.trusted.organizationId;
    const actorId = input.trusted.actorId;

    let client: Client;
    try {
      client = deps.clients.create({
        organizationId,
        primaryManagerId: actorId,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        primaryEmail: email,
        profession: input.profession?.trim() || undefined,
        company: input.company?.trim() || undefined,
        targetMarket: input.targetMarket?.trim() || undefined,
        onboardingStatus: 'NOT_STARTED',
        profileCompleteness: 15,
        status: 'INVITED',
        avatarUrl: '',
        createdBy: actorId,
        updatedBy: actorId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create client.';
      if (/quota|límite|limit/i.test(message)) {
        throw new ClientLifecycleError('QUOTA_EXCEEDED', message);
      }
      throw new ClientLifecycleError('PERSISTENCE_ERROR', message);
    }

    let invitation: Invitation | undefined;
    try {
      invitation = deps.invitations.create(client.id, email);
      deps.pendingAccounts.createPending({
        email,
        clientId: client.id,
        organizationId,
      });
    } catch (err) {
      compensateCreateFailure(deps, client.id, invitation?.id, actorId, input.trusted.now);
      const message = err instanceof Error ? err.message : 'Failed after client create.';
      throw new ClientLifecycleError(
        'PARTIAL_FAILURE_COMPENSATED',
        `Client create rolled back (archived): ${message}`
      );
    }

    return { client, invitation };
  };
}

function compensateCreateFailure(
  deps: CreateClientWithInviteDeps,
  clientId: string,
  invitationId: string | undefined,
  actorId: string,
  nowIso: string
): void {
  try {
    if (invitationId) deps.invitations.markRevoked(invitationId);
  } catch {
    /* best-effort compensation */
  }
  try {
    deps.clients.update(clientId, {
      status: 'ARCHIVED',
      archivedAt: nowIso,
      archivedBy: actorId,
      updatedBy: actorId,
    });
  } catch {
    /* best-effort compensation */
  }
}
