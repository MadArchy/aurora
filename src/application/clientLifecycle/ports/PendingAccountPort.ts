/**
 * Pending CLIENT account shell (pre-password). Identity storage is infrastructure;
 * role/org policy remains SPEC-009's concern at the auth adapter.
 */
export interface PendingAccountPort {
  createPending(params: {
    email: string;
    clientId: string;
    organizationId: string;
  }): void;
}
