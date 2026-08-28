export type SignalIntakeErrorCode =
  | 'ACTOR_NOT_AUTHORIZED'
  | 'TENANT_CONTEXT_INVALID'
  | 'INVALID_INPUT'
  | 'DUPLICATE_SIGNAL'
  | 'PERSISTENCE_ERROR'
  | 'QUOTA_EXCEEDED';

export class SignalIntakeError extends Error {
  readonly code: SignalIntakeErrorCode;

  constructor(code: SignalIntakeErrorCode, message: string) {
    super(message);
    this.name = 'SignalIntakeError';
    this.code = code;
  }
}
