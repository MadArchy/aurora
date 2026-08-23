import type { AiOperation } from '../../domain/ai/operations';
import type { PromptIdentity } from '../../domain/ai/promptIdentity';

export interface AiCompleteRequestBody {
  operation: AiOperation;
  /** Optional routing hint — must match authenticated claims when present. */
  clientId?: string;
  input: unknown;
  prompt: PromptIdentity;
}

export interface AiCompleteSuccessResponse {
  ok: true;
  data: unknown;
  metadata: {
    operation: string;
    prompt: PromptIdentity;
    schema: { schemaId: string; schemaVersion: string };
    validationStatus: string;
    repairCount: number;
    latencyMs?: number;
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface AiCompleteErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export type AiCompleteHttpResponse = AiCompleteSuccessResponse | AiCompleteErrorResponse;
