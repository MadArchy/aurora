import type { AiModelRole } from '../../../domain/ai/modelRole';
import type { ModelConfiguration } from '../../../application/ai/ports/outbound/ModelRegistryPort';

/**
 * Deterministic model registry — provider model IDs live here only.
 * Phase-0 verified defaults: gpt-4o-mini (OpenAI), claude-3-5-haiku-20241022 (Anthropic).
 */
export const MODEL_REGISTRY_ENTRIES: Record<AiModelRole, ModelConfiguration> = {
  FAST_STRUCTURED: {
    role: 'FAST_STRUCTURED',
    providerName: 'openai',
    providerModelId: 'gpt-4o-mini',
    enabled: true,
    maxTokens: 1200,
    temperature: 0.3,
    supportsJsonMode: true,
  },
  DEEP_REASONING: {
    role: 'DEEP_REASONING',
    providerName: 'openai',
    providerModelId: 'gpt-4o-mini',
    enabled: true,
    maxTokens: 1200,
    temperature: 0.3,
    supportsJsonMode: true,
  },
  CREATIVE_WRITING: {
    role: 'CREATIVE_WRITING',
    providerName: 'openai',
    providerModelId: 'gpt-4o-mini',
    enabled: true,
    maxTokens: 1200,
    temperature: 0.3,
    supportsJsonMode: true,
  },
};

/** Anthropic-capable config for adapter tests — not used by default role routing. */
export const ANTHROPIC_TEST_MODEL_CONFIG: ModelConfiguration = {
  role: 'FAST_STRUCTURED',
  providerName: 'anthropic',
  providerModelId: 'claude-3-5-haiku-20241022',
  enabled: true,
  maxTokens: 1200,
  temperature: 0.3,
  supportsJsonMode: false,
};
