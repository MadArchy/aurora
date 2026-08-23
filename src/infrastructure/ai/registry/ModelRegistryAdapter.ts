import type { AiOperation } from '../../../domain/ai/operations';
import type { AiModelRole } from '../../../domain/ai/modelRole';
import type { ModelRegistryPort, ModelConfiguration } from '../../../application/ai/ports/outbound/ModelRegistryPort';
import { MODEL_REGISTRY_ENTRIES } from './modelRegistryConfig';

export class ModelRegistryAdapter implements ModelRegistryPort {
  constructor(private readonly entries: Record<AiModelRole, ModelConfiguration> = MODEL_REGISTRY_ENTRIES) {}

  resolve(role: AiModelRole, _operation: AiOperation): ModelConfiguration {
    const config = this.entries[role];
    if (!config || !config.enabled) {
      return {
        role,
        providerName: 'unknown',
        providerModelId: '',
        enabled: false,
        maxTokens: 0,
        temperature: 0,
        supportsJsonMode: false,
      };
    }
    return { ...config };
  }
}
