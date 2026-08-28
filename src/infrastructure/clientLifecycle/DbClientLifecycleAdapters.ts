/**
 * TEMPORARY LEGACY ADAPTERS — CR-1 Client Lifecycle strangler.
 *
 * These adapters wrap existing `dbService` / `authService` persistence only.
 * They hold no business orchestration. Application owns create/accept decisions.
 * Do not treat this module as a generic dbService escape hatch.
 */

import type {
  ClientCreateFields,
  ClientIdentityActivationPort,
  ClientShellPort,
  InvitationPort,
  PendingAccountPort,
} from '../../application/clientLifecycle';
import type { Client, Invitation } from '../../types';
import { authService } from '../../services/auth';
import { dbService } from '../../services/db';

export function createDbClientShellPort(): ClientShellPort {
  return {
    getById(clientId: string): Client | undefined {
      return dbService.getClientById(clientId);
    },
    create(fields: ClientCreateFields): Client {
      return dbService.createClient({
        organizationId: fields.organizationId,
        primaryManagerId: fields.primaryManagerId,
        firstName: fields.firstName,
        lastName: fields.lastName,
        displayName: fields.displayName,
        primaryEmail: fields.primaryEmail,
        profession: fields.profession,
        company: fields.company,
        targetMarket: fields.targetMarket,
        onboardingStatus: fields.onboardingStatus,
        profileCompleteness: fields.profileCompleteness,
        status: fields.status,
        avatarUrl: fields.avatarUrl,
        createdBy: fields.createdBy,
        updatedBy: fields.updatedBy,
      });
    },
    update(clientId, updates) {
      return dbService.updateClient(clientId, updates);
    },
  };
}

export function createDbInvitationPort(): InvitationPort {
  return {
    getByToken(token: string): Invitation | undefined {
      return dbService.getInvitationByToken(token);
    },
    getById(invitationId: string): Invitation | undefined {
      return dbService.getInvitationById(invitationId);
    },
    create(clientId: string, email: string): Invitation {
      return dbService.createInvitation(clientId, email);
    },
    markAccepted(invitationId: string): void {
      dbService.markInvitationAccepted(invitationId);
    },
    markRevoked(invitationId: string): void {
      dbService.markInvitationRevoked(invitationId);
    },
  };
}

export function createAuthPendingAccountPort(): PendingAccountPort {
  return {
    createPending({ email, clientId, organizationId }) {
      authService.createPendingAccount(email, clientId, organizationId);
    },
  };
}

export function createAuthIdentityActivationPort(): ClientIdentityActivationPort {
  return {
    async activateFromInvitation({ invitation, password, displayName }) {
      const result = await authService.registerFromInvite(invitation, password, displayName);
      if (!result.ok) return result;
      const userId = authService.getCurrentUser()?.uid;
      if (!userId) {
        return { ok: false, message: 'Identity activation succeeded without session user.' };
      }
      return { ok: true, userId };
    },
  };
}
