/**
 * CR-1 Workstream 2 — Master Profile Application errors.
 */

export type MasterProfileErrorCode =
  | 'ACTOR_NOT_AUTHORIZED'
  | 'TENANT_CONTEXT_INVALID'
  | 'INVALID_INPUT'
  | 'INVALID_STEP'
  | 'CLIENT_NOT_FOUND'
  | 'PERSISTENCE_ERROR';

export class MasterProfileError extends Error {
  readonly code: MasterProfileErrorCode;

  constructor(code: MasterProfileErrorCode, message: string) {
    super(message);
    this.name = 'MasterProfileError';
    this.code = code;
  }
}
