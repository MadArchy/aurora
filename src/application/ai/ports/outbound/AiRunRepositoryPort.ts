import type { AiOperation } from '../../../../domain/ai/operations';
import type { AiGatewayErrorCode } from '../../../../domain/ai/errors';
import type { ValidationStatus } from '../../../../domain/ai/validationState';
import type { PromptIdentity } from '../../../../domain/ai/promptIdentity';
import type { SchemaIdentity } from '../../../../domain/ai/schemaIdentity';

/** Storage-neutral gateway audit record (Phase 4). */
export interface AiRunPersistenceRecord {
  id: string;
  organizationId: string;
  clientId: string;
  userId?: string;
  correlationId?: string;
  operation: AiOperation;
  providerName?: string;
  providerModelId?: string;
  modelRole?: string;
  prompt?: PromptIdentity;
  renderedPromptHash?: string;
  schema?: SchemaIdentity;
  executionStatus: 'SUCCESS' | 'FAILED';
  validationStatus?: ValidationStatus;
  validationFailureReason?: 'INVALID_JSON' | 'SCHEMA_MISMATCH';
  attemptCount?: number;
  retryCount?: number;
  repairCount: number;
  providerCallCount?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  errorClass?: AiGatewayErrorCode;
  errorMessageSanitized?: string;
  source: 'AI_GATEWAY';
  costStatus: 'NOT_CALCULATED';
}

export interface AiRunRepositoryPort {
  save(run: AiRunPersistenceRecord): Promise<string>;
}
