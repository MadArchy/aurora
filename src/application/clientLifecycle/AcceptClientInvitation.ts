import type { Client, Invitation } from '../../types';
import { ClientLifecycleError } from './errors';
import type { ClientIdentityActivationPort } from './ports/ClientIdentityActivationPort';
import type { ClientShellPort } from './ports/ClientShellPort';
import type { InvitationPort } from './ports/InvitationPort';

/**
 * Caller intent only — token is the product credential; password/name are form data.
 * Caller must NOT supply organizationId, clientId, role, or invitation snapshot authority.
 */
export interface AcceptClientInvitationInput {
  token: string;
  password: string;
  displayName: string;
}

export interface AcceptClientInvitationResult {
  client: Client;
  invitation: Invitation;
  userId: string;
}

export interface AcceptClientInvitationDeps {
  clients: ClientShellPort;
  invitations: InvitationPort;
  identity: ClientIdentityActivationPort;
  /** Injected clock for expiry comparison — Application does not invent expiry policy. */
  now?: () => number;
}

/**
 * CR-1 #1 — Accept invitation and activate invited client.
 *
 * Loads authoritative invitation + client from ports. Reuses existing product
 * semantics already enforced elsewhere (PENDING status, expiresAt) without
 * inventing new Domain rules.
 */
export function createAcceptClientInvitation(deps: AcceptClientInvitationDeps) {
  return async function acceptClientInvitation(
    input: AcceptClientInvitationInput
  ): Promise<AcceptClientInvitationResult> {
    const token = input.token?.trim() ?? '';
    const password = input.password ?? '';
    const displayName = input.displayName?.trim() ?? '';
    if (!token) {
      throw new ClientLifecycleError('INVALID_INPUT', 'Invitation token is required.');
    }
    if (!password) {
      throw new ClientLifecycleError('INVALID_INPUT', 'Password is required.');
    }
    if (!displayName) {
      throw new ClientLifecycleError('INVALID_INPUT', 'Display name is required.');
    }

    const invitation = deps.invitations.getByToken(token);
    if (!invitation) {
      throw new ClientLifecycleError('INVITATION_NOT_FOUND', 'Token de invitación inválido.');
    }

    if (invitation.status === 'ACCEPTED') {
      throw new ClientLifecycleError(
        'INVITATION_NOT_PENDING',
        'La invitación ya fue aceptada.'
      );
    }
    if (invitation.status === 'REVOKED' || invitation.status === 'EXPIRED') {
      throw new ClientLifecycleError(
        'INVITATION_NOT_PENDING',
        'La invitación no está vigente.'
      );
    }
    if (invitation.status !== 'PENDING') {
      throw new ClientLifecycleError(
        'INVITATION_NOT_PENDING',
        'La invitación no está vigente.'
      );
    }

    const nowMs = (deps.now ?? Date.now)();
    if (Date.parse(invitation.expiresAt) < nowMs) {
      throw new ClientLifecycleError('INVITATION_EXPIRED', 'INVITATION_EXPIRED');
    }

    if (!invitation.organizationId?.trim() || !invitation.clientId?.trim()) {
      throw new ClientLifecycleError(
        'TENANT_CONTEXT_INVALID',
        'Invitation missing organizationId or clientId (fail-closed).'
      );
    }

    const client = deps.clients.getById(invitation.clientId);
    if (!client) {
      throw new ClientLifecycleError('CLIENT_NOT_FOUND', 'Cliente de la invitación no encontrado.');
    }
    if (client.organizationId?.trim() !== invitation.organizationId.trim()) {
      throw new ClientLifecycleError(
        'CLIENT_TENANT_MISMATCH',
        'Invitation/client organization mismatch — denied.'
      );
    }

    const activation = await deps.identity.activateFromInvitation({
      invitation,
      password,
      displayName,
    });
    if (!activation.ok) {
      throw new ClientLifecycleError('IDENTITY_ACTIVATION_FAILED', activation.message);
    }

    deps.invitations.markAccepted(invitation.id);
    const updated = deps.clients.update(invitation.clientId, {
      userId: activation.userId,
      status: 'ACTIVE',
      onboardingStatus: 'IN_PROGRESS',
      updatedBy: activation.userId,
    });
    if (!updated) {
      throw new ClientLifecycleError(
        'PERSISTENCE_ERROR',
        'Invitation accepted but client activation persistence failed.'
      );
    }

    const refreshedInvite = deps.invitations.getById(invitation.id) ?? {
      ...invitation,
      status: 'ACCEPTED' as const,
    };

    return {
      client: updated,
      invitation: refreshedInvite,
      userId: activation.userId,
    };
  };
}
