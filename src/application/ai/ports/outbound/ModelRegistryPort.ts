import type { AiOperation } from '../../../../domain/ai/operations';
import type { AiModelRole } from '../../../../domain/ai/modelRole';

export interface ModelConfiguration {
  providerName: string;
  providerModelId: string;
  maxTokens: number;
  temperature: number;
  supportsJsonMode: boolean;
}

export interface ModelRegistryPort {
  resolve(role: AiModelRole, operation: AiOperation): ModelConfiguration;
}
