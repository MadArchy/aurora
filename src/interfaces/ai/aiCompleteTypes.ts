import type { AiOperation } from '../../domain/ai/operations';
import type { PromptIdentity } from '../../domain/ai/promptIdentity';
import type { AiExecutionMetadata } from '../../application/ai/contracts/result';

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
  metadata: AiExecutionMetadata;
}

export interface AiCompleteErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  metadata?: Partial<AiExecutionMetadata>;
}

export type AiCompleteHttpResponse = AiCompleteSuccessResponse | AiCompleteErrorResponse;
