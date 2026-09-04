export type ExecutionDeliveryErrorCode =
  | 'ACTOR_NOT_AUTHORIZED'
  | 'TENANT_CONTEXT_INVALID'
  | 'INVALID_INPUT'
  | 'TASK_NOT_FOUND'
  | 'CONTENT_NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'PUBLICATION_GATE_DENIED'
  | 'STRATEGIC_BRIEF_GATE_DENIED'
  | 'CONTENT_AUTHORIZATION_AMBIGUOUS'
  | 'CURATION_ALREADY_EXISTS'
  | 'PERSISTENCE_ERROR';

export class ExecutionDeliveryError extends Error {
  readonly code: ExecutionDeliveryErrorCode;

  constructor(code: ExecutionDeliveryErrorCode, message: string) {
    super(message);
    this.name = 'ExecutionDeliveryError';
    this.code = code;
  }
}
