import type { AiProviderPort, AiProviderCompletionRequest, AiProviderCompletionResponse } from '../../../application/ai/ports/outbound/AiProviderPort';
import { ProviderCallError } from './providerErrors';

/** Routes completion to a concrete provider adapter by resolved model configuration. */
export class RoutingAiProviderPort implements AiProviderPort {
  constructor(private readonly adapters: ReadonlyMap<string, AiProviderPort>) {}

  async complete(request: AiProviderCompletionRequest): Promise<AiProviderCompletionResponse> {
    const key = request.model.providerName.toLowerCase();
    const adapter = this.adapters.get(key);
    if (!adapter) {
      throw new ProviderCallError({
        code: 'PROVIDER_UNAVAILABLE',
        message: `No adapter registered for provider ${request.model.providerName}`,
        retryable: false,
        providerName: request.model.providerName,
      });
    }
    return adapter.complete(request);
  }
}
