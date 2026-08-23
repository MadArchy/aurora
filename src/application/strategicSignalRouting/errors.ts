export type StrategicRoutingErrorCode =
  | 'SIGNAL_NOT_FOUND'
  | 'THESIS_NOT_FOUND'
  | 'THESIS_NOT_ELIGIBLE'
  | 'UNAUTHORIZED_OVERRIDE'
  | 'TENANT_CONTEXT_INVALID'
  | 'PERSISTENCE_ERROR';

export class StrategicRoutingError extends Error {
  readonly code: StrategicRoutingErrorCode;

  constructor(code: StrategicRoutingErrorCode, message: string) {
    super(message);
    this.name = 'StrategicRoutingError';
    this.code = code;
  }
}
