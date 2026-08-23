import type { AiOperation } from '../../../domain/ai/operations';
import type { PromptIdentity } from '../../../domain/ai/promptIdentity';
import type { ValidatedAiTenantContext } from '../../../domain/ai/tenantContext';

export interface AiRequestMetadata {
  correlationId?: string;
  source?: string;
  thesisId?: string;
  campaignId?: string;
}

export interface AiGatewayRequest<TInput = unknown> {
  operation: AiOperation;
  tenant: ValidatedAiTenantContext;
  input: TInput;
  prompt: PromptIdentity;
  metadata?: AiRequestMetadata;
}

export type ForbiddenGatewayRequestFields =
  | 'apiKey'
  | 'openaiKey'
  | 'claudeKey'
  | 'authorization'
  | 'providerEndpoint'
  | 'model'
  | 'providerModelId'
  | 'temperature'
  | 'maxTokens';
