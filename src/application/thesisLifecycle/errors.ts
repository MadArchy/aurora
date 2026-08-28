export type ThesisLifecycleErrorCode =
  | 'ACTOR_NOT_AUTHORIZED'
  | 'TENANT_CONTEXT_INVALID'
  | 'INVALID_INPUT'
  | 'THESIS_NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'NOT_READY_FOR_REVIEW'
  | 'PERSISTENCE_ERROR'
  | 'QUOTA_EXCEEDED';

export class ThesisLifecycleError extends Error {
  readonly code: ThesisLifecycleErrorCode;

  constructor(code: ThesisLifecycleErrorCode, message: string) {
    super(message);
    this.name = 'ThesisLifecycleError';
    this.code = code;
  }
}
