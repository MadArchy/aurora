import type { AiOperation } from '../../../../domain/ai/operations';
import type { AiModelRole } from '../../../../domain/ai/modelRole';
import type { ModelConfiguration } from './ModelRegistryPort';

export interface AiProviderMessage {
  role: 'system' | 'user';
  content: string;
}

/** Application-level provider request — no credentials or SDK shapes. */
export interface AiProviderCompletionRequest {
  operation: AiOperation;
  logicalModelRole: AiModelRole;
  /** Application-resolved model configuration from ModelRegistryPort. */
  model: ModelConfiguration;
  messages: AiProviderMessage[];
  structuredJsonRequired: boolean;
}

/** Untrusted provider response — requires application validation before domain trust. */
export interface AiProviderCompletionResponse {
  rawText: string;
  providerName: string;
  providerModelId: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  finishReason?: string;
  providerRequestId?: string;
  latencyMs: number;
}

export interface AiProviderPort {
  complete(request: AiProviderCompletionRequest): Promise<AiProviderCompletionResponse>;
}
