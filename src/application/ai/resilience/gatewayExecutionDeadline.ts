import { DEFAULT_PROVIDER_TIMEOUT_MS } from '../../../domain/ai/constants';
import { MAX_GATEWAY_EXECUTION_MS } from '../../../domain/ai/constants';

/** Raised when gateway wall-clock budget is exhausted before a provider attempt can complete. */
export class GatewayDeadlineExceededError extends Error {
  readonly code = 'TIMEOUT' as const;

  constructor(message = 'Gateway execution deadline exceeded') {
    super(message);
    this.name = 'GatewayDeadlineExceededError';
  }
}

/** Tracks wall-clock budget for one gateway execute request. */
export class GatewayExecutionDeadline {
  constructor(
    private readonly startedAtMs: number,
    private readonly maxDurationMs: number = MAX_GATEWAY_EXECUTION_MS,
    private readonly nowFn: () => number = Date.now
  ) {}

  elapsedMs(): number {
    return this.nowFn() - this.startedAtMs;
  }

  remainingMs(): number {
    return Math.max(0, this.maxDurationMs - this.elapsedMs());
  }

  isExpired(): boolean {
    return this.remainingMs() <= 0;
  }

  /** Fail closed if a full provider attempt cannot fit in remaining budget. */
  assertCanStartProviderAttempt(providerTimeoutMs: number = DEFAULT_PROVIDER_TIMEOUT_MS): void {
    if (this.remainingMs() < providerTimeoutMs) {
      throw new GatewayDeadlineExceededError();
    }
  }

  /** Whether backoff + another provider attempt can fit in remaining budget. */
  canFitProviderAttempt(providerTimeoutMs: number, backoffMs: number = 0): boolean {
    return this.remainingMs() >= providerTimeoutMs + backoffMs;
  }
}

export function createGatewayExecutionDeadline(
  nowFn?: () => number,
  maxDurationMs?: number
): GatewayExecutionDeadline {
  const now = nowFn ?? Date.now;
  return new GatewayExecutionDeadline(now(), maxDurationMs, now);
}
