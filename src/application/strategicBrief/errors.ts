export type StrategicBriefErrorCode =
  | 'BRIEF_NOT_FOUND'
  | 'SIGNAL_NOT_FOUND'
  | 'STRATEGIC_CONTEXT_INVALID'
  | 'ROUTING_CONTEXT_REQUIRED'
  | 'ROUTING_CONTEXT_CONTESTED'
  | 'ROUTING_CONTEXT_UNROUTED'
  | 'ROUTING_NOT_CLEAR'
  | 'THESIS_CONTEXT_MISMATCH'
  | 'TENANT_CONTEXT_INVALID'
  | 'ACTOR_NOT_AUTHORIZED'
  | 'BRIEF_STATE_INVALID'
  | 'BRIEF_REVISION_STALE'
  | 'BRIEF_NOT_ACTIONABLE'
  | 'OVERRIDE_INVALID'
  | 'PERSISTENCE_ERROR';

export class StrategicBriefError extends Error {
  readonly code: StrategicBriefErrorCode;

  constructor(code: StrategicBriefErrorCode, message: string) {
    super(message);
    this.name = 'StrategicBriefError';
    this.code = code;
  }
}
