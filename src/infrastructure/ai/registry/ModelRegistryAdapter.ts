import type { AiOperation } from '../../../domain/ai/operations';
import type { AiModelRole } from '../../../domain/ai/modelRole';
import type {
  ModelRegistryPort,
  ModelConfiguration,
  ComparativeExecutionPlan,
} from '../../../application/ai/ports/outbound/ModelRegistryPort';
import {
  MODEL_REGISTRY_ENTRIES,
  COMPARATIVE_OPENAI_MODEL_CONFIG,
  COMPARATIVE_ANTHROPIC_MODEL_CONFIG,
} from './modelRegistryConfig';
import { ModelNotResolvedError } from '../../../application/ai/errors/providerPortErrors';

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

  resolveComparativePlan(operation: AiOperation): ComparativeExecutionPlan {
    if (operation !== 'ANALYSIS_COMPARATIVE') {
      throw new ModelNotResolvedError(`Comparative plan not defined for operation ${operation}`);
    }
    const openai = { ...COMPARATIVE_OPENAI_MODEL_CONFIG };
    const anthropic = { ...COMPARATIVE_ANTHROPIC_MODEL_CONFIG };
    if (!openai.enabled || !anthropic.enabled) {
      throw new ModelNotResolvedError('Comparative provider model configuration is disabled');
    }
    if (openai.providerName.toLowerCase() !== 'openai' || anthropic.providerName.toLowerCase() !== 'anthropic') {
      throw new ModelNotResolvedError('Comparative plan must resolve openai + anthropic providers');
    }
    return {
      operation: 'ANALYSIS_COMPARATIVE',
      slices: [openai, anthropic],
    };
  }
}
