import type { Invitation } from '../../../types';

/**
 * SPEC-009 identity activation for an invitation.
 * Application loads the invitation; this port must not trust caller-built aggregates
 * for tenant fields beyond what Application already validated.
 */
export interface ClientIdentityActivationPort {
  activateFromInvitation(params: {
    invitation: Invitation;
    password: string;
    displayName: string;
  }): Promise<{ ok: true; userId: string } | { ok: false; message: string }>;
}
