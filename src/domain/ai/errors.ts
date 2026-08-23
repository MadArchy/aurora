import { SECRET_ERROR_PATTERNS } from './constants';

export const AI_GATEWAY_ERROR_CODES = [
  'AUTH_CONTEXT_INVALID',
  'OPERATION_NOT_SUPPORTED',
  'MODEL_NOT_RESOLVED',
  'PROVIDER_UNAVAILABLE',
  'TIMEOUT',
  'RATE_LIMITED',
  'PROVIDER_ERROR',
  'INVALID_OUTPUT',
  'REPAIR_FAILED',
  'PERSISTENCE_ERROR',
] as const;

export type AiGatewayErrorCode = (typeof AI_GATEWAY_ERROR_CODES)[number];

export interface AiGatewayError {
  code: AiGatewayErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, string | number | boolean>;
}

export function createGatewayError(params: {
  code: AiGatewayErrorCode;
  message: string;
  retryable?: boolean;
  details?: Record<string, string | number | boolean>;
}): AiGatewayError {
  const safeMessage = sanitizeErrorMessage(params.message);
  const safeDetails = params.details
    ? Object.fromEntries(
        Object.entries(params.details).map(([k, v]) => [k, typeof v === 'string' ? sanitizeErrorMessage(v) : v])
      )
    : undefined;
  return {
    code: params.code,
    message: safeMessage,
    retryable: params.retryable ?? false,
    details: safeDetails,
  };
}

export function sanitizeErrorMessage(message: string): string {
  let out = message.slice(0, 500);
  for (const pattern of SECRET_ERROR_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

export function errorExposesSecrets(error: AiGatewayError): boolean {
  const blob = JSON.stringify(error);
  return SECRET_ERROR_PATTERNS.some((p) => p.test(blob));
}
