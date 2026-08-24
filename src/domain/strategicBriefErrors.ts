export type StrategicBriefDomainErrorCode =
  | 'INVALID_BRIEF'
  | 'INVALID_DECISION'
  | 'INVALID_STATE_TRANSITION'
  | 'BRIEF_NOT_ACTIONABLE'
  | 'ROUTING_CONTEXT_INVALID'
  | 'MATERIAL_REVISION_REQUIRED'
  | 'OVERRIDE_INVALID';

export class StrategicBriefDomainError extends Error {
  readonly code: StrategicBriefDomainErrorCode;

  constructor(code: StrategicBriefDomainErrorCode, message: string) {
    super(message);
    this.name = 'StrategicBriefDomainError';
    this.code = code;
  }
}

export type BriefDomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: StrategicBriefDomainError };

export function briefOk<T>(value: T): BriefDomainResult<T> {
  return { ok: true, value };
}

export function briefFail(
  code: StrategicBriefDomainErrorCode,
  message: string
): BriefDomainResult<never> {
  return { ok: false, error: new StrategicBriefDomainError(code, message) };
}
