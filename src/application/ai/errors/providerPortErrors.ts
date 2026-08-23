import type { AiGatewayErrorCode } from '../../../domain/ai/errors';
import { sanitizeErrorMessage } from '../../../domain/ai/errors';

/** Thrown by infrastructure provider adapters — caught by application orchestration. */
export class ProviderPortError extends Error {
  readonly code: AiGatewayErrorCode;
  readonly retryable: boolean;
  readonly providerName: string;
  readonly httpStatus?: number;

  constructor(params: {
    code: AiGatewayErrorCode;
    message: string;
    retryable?: boolean;
    providerName: string;
    httpStatus?: number;
  }) {
    super(sanitizeErrorMessage(params.message));
    this.name = 'ProviderPortError';
    this.code = params.code;
    this.retryable = params.retryable ?? false;
    this.providerName = params.providerName;
    this.httpStatus = params.httpStatus;
  }
}

export class PromptResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptResolutionError';
  }
}
