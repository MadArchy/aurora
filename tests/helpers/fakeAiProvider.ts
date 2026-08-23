import type { AiProviderPort, AiProviderCompletionRequest, AiProviderCompletionResponse } from '../../src/application/ai/ports/outbound/AiProviderPort';

export class FakeAiProviderPort implements AiProviderPort {
  constructor(
    private readonly handler: (request: AiProviderCompletionRequest) => Promise<AiProviderCompletionResponse> | AiProviderCompletionResponse
  ) {}

  async complete(request: AiProviderCompletionRequest): Promise<AiProviderCompletionResponse> {
    return this.handler(request);
  }
}

export function jsonProviderResponse(raw: unknown, overrides: Partial<AiProviderCompletionResponse> = {}): AiProviderCompletionResponse {
  return {
    rawText: typeof raw === 'string' ? raw : JSON.stringify(raw),
    providerName: 'fake',
    providerModelId: 'fake-model',
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
    latencyMs: 5,
    ...overrides,
  };
}
