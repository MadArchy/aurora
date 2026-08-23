import type { AiGatewayRequest } from '../../contracts/request';
import type { AiGatewayResult } from '../../contracts/result';
import type { AiOperation } from '../../../../domain/ai/operations';
import type { AiOperationOutputMap } from '../../schemas/outputRegistry';

/** Inbound application port — exposed to HTTP/Cloud Function/UI adapters. */
export interface AiGatewayPort {
  execute<K extends AiOperation>(
    request: AiGatewayRequest<unknown>
  ): Promise<AiGatewayResult<AiOperationOutputMap[K]>>;
}

export type ExecuteAiOperationUseCase = AiGatewayPort;

export function assertGatewayRequestOperation<K extends AiOperation>(
  request: AiGatewayRequest<unknown>,
  expected: K
): asserts request is AiGatewayRequest<unknown> & { operation: K } {
  if (request.operation !== expected) {
    throw new Error(`Expected operation ${expected}, got ${request.operation}`);
  }
}
