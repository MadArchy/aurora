import { MAX_PROVIDER_CALLS_PER_EXECUTION } from '../../../domain/ai/constants';
import { createGatewayError } from '../../../domain/ai/errors';
import { ProviderPortError } from '../errors/providerPortErrors';

/** Tracks and enforces the global provider-call ceiling per gateway execute. */
export class ProviderCallBudget {
  private calls = 0;

  constructor(private readonly maxCalls: number = MAX_PROVIDER_CALLS_PER_EXECUTION) {}

  get providerCallCount(): number {
    return this.calls;
  }

  canCall(): boolean {
    return this.calls < this.maxCalls;
  }

  assertCanCall(): void {
    if (!this.canCall()) {
      throw new ProviderPortError({
        code: 'PROVIDER_ERROR',
        message: 'Provider call budget exhausted',
        retryable: false,
        providerName: 'gateway',
      });
    }
  }

  recordCall(): void {
    this.assertCanCall();
    this.calls += 1;
  }
}

export function providerBudgetExhaustedError() {
  return createGatewayError({
    code: 'PROVIDER_ERROR',
    message: 'Provider call budget exhausted',
    retryable: false,
  });
}
