import type { AiOperation } from '../../../../domain/ai/operations';
import type { PromptIdentity } from '../../../../domain/ai/promptIdentity';

export interface ResolvedPrompt {
  identity: PromptIdentity;
  systemMessage: string;
  userMessage: string;
}

export interface PromptRegistryPort {
  resolve(params: {
    operation: AiOperation;
    identity: PromptIdentity;
    input: unknown;
  }): ResolvedPrompt;
}
