export type StrategicScoringErrorCode =
  | 'SIGNAL_NOT_FOUND'
  | 'ROUTING_CONTEXT_REQUIRED'
  | 'ROUTING_CONTEXT_CONTESTED'
  | 'ROUTING_CONTEXT_INVALID'
  | 'THESIS_NOT_FOUND'
  | 'TENANT_CONTEXT_INVALID'
  | 'SCORING_INPUT_INVALID'
  | 'PERSISTENCE_ERROR';

export class StrategicScoringError extends Error {
  readonly code: StrategicScoringErrorCode;

  constructor(code: StrategicScoringErrorCode, message: string) {
    super(message);
    this.name = 'StrategicScoringError';
    this.code = code;
  }
}
