import type { Invitation } from '../../../types';

export interface InvitationPort {
  getByToken(token: string): Invitation | undefined;
  getById(invitationId: string): Invitation | undefined;
  create(clientId: string, email: string): Invitation;
  markAccepted(invitationId: string): void;
  /** Compensation path — uses existing Invitation status enum REVOKED. */
  markRevoked(invitationId: string): void;
}
