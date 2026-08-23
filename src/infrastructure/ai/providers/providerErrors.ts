import { ProviderPortError } from '../../../application/ai/errors/providerPortErrors';

/** @deprecated alias — infrastructure throws ProviderPortError */
export class ProviderCallError extends ProviderPortError {
  constructor(params: ConstructorParameters<typeof ProviderPortError>[0]) {
    super(params);
    this.name = 'ProviderCallError';
  }
}

export function mapHttpStatusToProviderError(params: {
  providerName: string;
  httpStatus: number;
  message: string;
}): ProviderCallError {
  const { providerName, httpStatus, message } = params;
  if (httpStatus === 429) {
    return new ProviderCallError({
      code: 'RATE_LIMITED',
      message,
      retryable: true,
      providerName,
      httpStatus,
    });
  }
  if (httpStatus === 408 || httpStatus === 504) {
    return new ProviderCallError({
      code: 'TIMEOUT',
      message,
      retryable: true,
      providerName,
      httpStatus,
    });
  }
  if (httpStatus >= 500) {
    return new ProviderCallError({
      code: 'PROVIDER_ERROR',
      message,
      retryable: true,
      providerName,
      httpStatus,
    });
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return new ProviderCallError({
      code: 'PROVIDER_UNAVAILABLE',
      message,
      retryable: false,
      providerName,
      httpStatus,
    });
  }
  return new ProviderCallError({
    code: 'PROVIDER_ERROR',
    message,
    retryable: false,
    providerName,
    httpStatus,
  });
}

export function mapFetchFailureToProviderError(params: {
  providerName: string;
  error: unknown;
  timeoutMs: number;
}): ProviderCallError {
  if (params.error instanceof ProviderCallError) return params.error;
  const message = params.error instanceof Error ? params.error.message : 'Provider request failed';
  if (message.includes('abort') || message.includes('AbortError') || message.includes('TIMEOUT')) {
    return new ProviderCallError({
      code: 'TIMEOUT',
      message: `Provider request timed out after ${params.timeoutMs}ms`,
      retryable: true,
      providerName: params.providerName,
    });
  }
  return new ProviderCallError({
    code: 'PROVIDER_ERROR',
    message,
    retryable: true,
    providerName: params.providerName,
  });
}
