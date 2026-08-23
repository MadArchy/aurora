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

/** Explicit dual-provider plan for ANALYSIS_COMPARATIVE — not fallback. */
export interface ComparativeExecutionPlan {
  operation: 'ANALYSIS_COMPARATIVE';
  slices: [ModelConfiguration, ModelConfiguration];
}

export interface ModelRegistryPort {
  resolve(role: AiModelRole, operation: AiOperation): ModelConfiguration;
  /** Server-side OpenAI + Anthropic configs for multi-provider comparative. */
  resolveComparativePlan(operation: AiOperation): ComparativeExecutionPlan;
}
