/**
 * CR-1 Workstream 1 — Client Lifecycle Application errors.
 * Operational business orchestration — not SPEC-009 security policy.
 */

export type ClientLifecycleErrorCode =
  | 'ACTOR_NOT_AUTHORIZED'
  | 'TENANT_CONTEXT_INVALID'
  | 'INVALID_INPUT'
  | 'INVITATION_NOT_FOUND'
  | 'INVITATION_NOT_PENDING'
  | 'INVITATION_EXPIRED'
  | 'CLIENT_NOT_FOUND'
  | 'CLIENT_TENANT_MISMATCH'
  | 'IDENTITY_ACTIVATION_FAILED'
  | 'PERSISTENCE_ERROR'
  | 'QUOTA_EXCEEDED'
  | 'PARTIAL_FAILURE_COMPENSATED';

export class ClientLifecycleError extends Error {
  readonly code: ClientLifecycleErrorCode;

  constructor(code: ClientLifecycleErrorCode, message: string) {
    super(message);
    this.name = 'ClientLifecycleError';
    this.code = code;
  }
}
