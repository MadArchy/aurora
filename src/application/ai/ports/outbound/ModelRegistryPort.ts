import type { AiOperation } from '../../../../domain/ai/operations';
import type { AiModelRole } from '../../../../domain/ai/modelRole';

export interface ModelConfiguration {
  role: AiModelRole;
  providerName: string;
  providerModelId: string;
  enabled: boolean;
  maxTokens: number;
  temperature: number;
  supportsJsonMode: boolean;
}

export interface ModelRegistryPort {
  resolve(role: AiModelRole, operation: AiOperation): ModelConfiguration;
}
