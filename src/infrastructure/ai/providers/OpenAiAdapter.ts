import type { AiProviderPort, AiProviderCompletionRequest, AiProviderCompletionResponse } from '../../../application/ai/ports/outbound/AiProviderPort';
import { requireProviderSecret, ProviderSecretMissingError, type ProviderSecretConfig } from '../configuration/providerSecrets';
import type { ProviderTimeoutPolicy } from '../configuration/providerTimeout';
import { fetchWithTimeout, type FetchFn } from './fetchTransport';
import { mapHttpStatusToProviderError, ProviderCallError } from './providerErrors';
import { ProviderPortError } from '../../../application/ai/errors/providerPortErrors';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAiAdapter implements AiProviderPort {
  constructor(
    private readonly secrets: ProviderSecretConfig,
    private readonly timeout: ProviderTimeoutPolicy,
    private readonly fetchFn: FetchFn = fetch
  ) {}

  async complete(request: AiProviderCompletionRequest): Promise<AiProviderCompletionResponse> {
    let apiKey: string;
    try {
      apiKey = requireProviderSecret(this.secrets, 'openai');
    } catch (error) {
      if (error instanceof ProviderSecretMissingError) {
        throw new ProviderCallError({
          code: 'PROVIDER_UNAVAILABLE',
          message: error.message,
          retryable: false,
          providerName: 'openai',
        });
      }
      throw error;
    }

    const started = Date.now();
    const body: Record<string, unknown> = {
      model: request.model.providerModelId,
      temperature: request.model.temperature,
      max_tokens: request.model.maxTokens,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (request.structuredJsonRequired && request.model.supportsJsonMode) {
      body.response_format = { type: 'json_object' };
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(
        OPENAI_CHAT_URL,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        this.timeout.timeoutMs,
        this.fetchFn
      );
    } catch (error) {
      if (error instanceof ProviderPortError || error instanceof ProviderCallError) throw error;
      throw error;
    }

    const payload = (await response.json()) as {
      id?: string;
      model?: string;
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      error?: { message?: string };
    };

    if (!response.ok) {
      throw mapHttpStatusToProviderError({
        providerName: 'openai',
        httpStatus: response.status,
        message: payload.error?.message || `OpenAI HTTP ${response.status}`,
      });
    }

    const rawText = payload.choices?.[0]?.message?.content ?? '';
    if (!rawText.trim()) {
      throw new ProviderCallError({
        code: 'PROVIDER_ERROR',
        message: 'OpenAI returned empty completion',
        retryable: false,
        providerName: 'openai',
      });
    }

    return {
      rawText,
      providerName: 'openai',
      providerModelId: payload.model || request.model.providerModelId,
      promptTokens: payload.usage?.prompt_tokens,
      completionTokens: payload.usage?.completion_tokens,
      totalTokens: payload.usage?.total_tokens,
      finishReason: payload.choices?.[0]?.finish_reason,
      providerRequestId: payload.id,
      latencyMs: Date.now() - started,
    };
  }
}
