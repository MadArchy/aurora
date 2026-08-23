import { MAX_PROVIDER_RETRIES, PROVIDER_RETRY_BACKOFF_MS, DEFAULT_PROVIDER_TIMEOUT_MS } from '../../../domain/ai/constants';
import type { AiProviderCompletionRequest, AiProviderCompletionResponse, AiProviderPort } from '../ports/outbound/AiProviderPort';
import { ProviderPortError } from '../errors/providerPortErrors';
import { ProviderCallBudget } from './providerCallBudget';
import { GatewayDeadlineExceededError, type GatewayExecutionDeadline } from './gatewayExecutionDeadline';

export interface ProviderRetryResult {
  response: AiProviderCompletionResponse;
  attemptCount: number;
  retryCount: number;
  providerCallCount: number;
}

export function isRetryableProviderError(error: unknown): boolean {
  return error instanceof ProviderPortError && error.retryable;
}

/** delayMs = baseMs × 2^retryIndex — with MAX_PROVIDER_RETRIES=1 only retryIndex 0 applies (one sleep). */
export function computeProviderRetryDelayMs(retryIndex: number, baseMs: number = PROVIDER_RETRY_BACKOFF_MS): number {
  if (baseMs <= 0) return 0;
  return baseMs * 2 ** retryIndex;
}

/** Max backoff sleep per provider sequence (initial + one retry). */
export function maxBackoffPerProviderSequence(baseMs: number = PROVIDER_RETRY_BACKOFF_MS): number {
  let total = 0;
  for (let i = 0; i < MAX_PROVIDER_RETRIES; i++) {
    total += computeProviderRetryDelayMs(i, baseMs);
  }
  return total;
}

export async function executeProviderWithRetry(params: {
  providerPort: AiProviderPort;
  request: AiProviderCompletionRequest;
  budget: ProviderCallBudget;
  deadline?: GatewayExecutionDeadline;
  providerTimeoutMs?: number;
  maxRetries?: number;
  backoffMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}): Promise<ProviderRetryResult> {
  const maxRetries = params.maxRetries ?? MAX_PROVIDER_RETRIES;
  const backoffMs = params.backoffMs ?? PROVIDER_RETRY_BACKOFF_MS;
  const providerTimeoutMs = params.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const sleepFn = params.sleepFn ?? defaultSleep;

  let retryCount = 0;
  let attemptCount = 0;

  while (true) {
    params.deadline?.assertCanStartProviderAttempt(providerTimeoutMs);
    params.budget.recordCall();
    attemptCount += 1;

    try {
      const response = await params.providerPort.complete(params.request);
      return {
        response,
        attemptCount,
        retryCount,
        providerCallCount: params.budget.providerCallCount,
      };
    } catch (error) {
      const delay = computeProviderRetryDelayMs(retryCount, backoffMs);
      const canRetry =
        isRetryableProviderError(error) &&
        retryCount < maxRetries &&
        params.budget.canCall() &&
        (params.deadline?.canFitProviderAttempt(providerTimeoutMs, delay) ?? true);

      if (!canRetry) {
        if (
          isRetryableProviderError(error) &&
          retryCount < maxRetries &&
          params.deadline &&
          !params.deadline.canFitProviderAttempt(providerTimeoutMs, delay)
        ) {
          throw new GatewayDeadlineExceededError();
        }
        throw error;
      }

      retryCount += 1;
      if (delay > 0) {
        await sleepFn(delay);
      }
    }
  }
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
