import type { AiOperation } from '../../../../domain/ai/operations';
import type { AiGatewayErrorCode } from '../../../../domain/ai/errors';
import type { ValidationStatus } from '../../../../domain/ai/validationState';
import type { PromptIdentity } from '../../../../domain/ai/promptIdentity';
import type { SchemaIdentity } from '../../../../domain/ai/schemaIdentity';

export interface AiProviderExecutionAudit {
  provider: string;
  providerModelId: string;
  modelRole: string;
  attemptCount: number;
  retryCount: number;
  repairCount: number;
  providerCallCount: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  status: 'SUCCESS' | 'FAILED';
  errorClass?: AiGatewayErrorCode;
}

/** Storage-neutral gateway audit record (Phase 4 + 5C-MP comparative). */
export interface AiRunPersistenceRecord {
  id: string;
  organizationId: string;
  clientId: string;
  userId?: string;
  correlationId?: string;
  operation: AiOperation;
  /** Discriminated execution mode — SINGLE is default for six single-provider ops. */
  executionMode?: 'SINGLE' | 'COMPARATIVE';
  providerName?: string;
  providerModelId?: string;
  modelRole?: string;
  /** Bounded per-provider details for COMPARATIVE executions (exactly two entries). */
  providerExecutions?: AiProviderExecutionAudit[];
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
