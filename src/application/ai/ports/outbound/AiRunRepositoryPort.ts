import type { AiOperation } from '../../../../domain/ai/operations';
import type { AiGatewayErrorCode } from '../../../../domain/ai/errors';
import type { ValidationStatus } from '../../../../domain/ai/validationState';
import type { PromptIdentity } from '../../../../domain/ai/promptIdentity';
import type { SchemaIdentity } from '../../../../domain/ai/schemaIdentity';

/** Minimum persistence contract for gateway audit runs (Phase 4 implementation). */
export interface AiRunPersistenceRecord {
  id?: string;
  organizationId: string;
  clientId?: string | null;
  operation: AiOperation;
  providerName?: string;
  providerModelId?: string;
  prompt: PromptIdentity;
  schema: SchemaIdentity;
  validationStatus: ValidationStatus;
  repairCount: number;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  status: 'SUCCESS' | 'FAILURE';
  errorCode?: AiGatewayErrorCode;
  createdAt?: string;
}

export interface AiRunRepositoryPort {
  save(run: AiRunPersistenceRecord): Promise<string>;
}
