import type { AiGatewayPort } from '../ports/inbound/AiGatewayPort';
import type { AiGatewayRequest } from '../contracts/request';
import type { AiGatewayResult } from '../contracts/result';

/** Phase 1 stub — satisfies inbound port without outbound adapters. */
export class UnimplementedAiGateway implements AiGatewayPort {
  async execute(_request: AiGatewayRequest<unknown>): Promise<AiGatewayResult<never>> {
    return {
      ok: false,
      error: {
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Gateway not implemented until Phase 2',
        retryable: false,
      },
    };
  }
}
