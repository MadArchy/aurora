import type { AiProviderPort, AiProviderCompletionRequest, AiProviderCompletionResponse } from '../../../application/ai/ports/outbound/AiProviderPort';
import { requireProviderSecret, ProviderSecretMissingError, type ProviderSecretConfig } from '../configuration/providerSecrets';
import type { ProviderTimeoutPolicy } from '../configuration/providerTimeout';
import { fetchWithTimeout, type FetchFn } from './fetchTransport';
import { mapHttpStatusToProviderError, ProviderCallError } from './providerErrors';
import { ProviderPortError } from '../../../application/ai/errors/providerPortErrors';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export class AnthropicAdapter implements AiProviderPort {
  constructor(
    private readonly secrets: ProviderSecretConfig,
    private readonly timeout: ProviderTimeoutPolicy,
    private readonly fetchFn: FetchFn = fetch
  ) {}

  async complete(request: AiProviderCompletionRequest): Promise<AiProviderCompletionResponse> {
    let apiKey: string;
    try {
      apiKey = requireProviderSecret(this.secrets, 'anthropic');
    } catch (error) {
      if (error instanceof ProviderSecretMissingError) {
        throw new ProviderCallError({
          code: 'PROVIDER_UNAVAILABLE',
          message: error.message,
          retryable: false,
          providerName: 'anthropic',
        });
      }
      throw error;
    }

    const systemParts = request.messages.filter((m) => m.role === 'system');
    const userParts = request.messages.filter((m) => m.role === 'user');
    const system = systemParts.map((m) => m.content).join('\n\n');
    const userContent = userParts.map((m) => m.content).join('\n\n');

    const started = Date.now();
    const body: Record<string, unknown> = {
      model: request.model.providerModelId,
      max_tokens: request.model.maxTokens,
      temperature: request.model.temperature,
      messages: [{ role: 'user', content: userContent }],
    };
    if (system) body.system = system;

    let response: Response;
    try {
      response = await fetchWithTimeout(
        ANTHROPIC_MESSAGES_URL,
        {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
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
      content?: Array<{ type?: string; text?: string }>;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
      error?: { message?: string };
    };

    if (!response.ok) {
      throw mapHttpStatusToProviderError({
        providerName: 'anthropic',
        httpStatus: response.status,
        message: payload.error?.message || `Anthropic HTTP ${response.status}`,
      });
    }

    const rawText = Array.isArray(payload.content)
      ? payload.content.map((part) => part.text || '').join('\n')
      : '';
    if (!rawText.trim()) {
      throw new ProviderCallError({
        code: 'PROVIDER_ERROR',
        message: 'Anthropic returned empty completion',
        retryable: false,
        providerName: 'anthropic',
      });
    }

    const promptTokens = payload.usage?.input_tokens;
    const completionTokens = payload.usage?.output_tokens;

    return {
      rawText,
      providerName: 'anthropic',
      providerModelId: payload.model || request.model.providerModelId,
      promptTokens,
      completionTokens,
      totalTokens:
        promptTokens !== undefined && completionTokens !== undefined
          ? promptTokens + completionTokens
          : undefined,
      finishReason: payload.stop_reason,
      providerRequestId: payload.id,
      latencyMs: Date.now() - started,
    };
  }
}
