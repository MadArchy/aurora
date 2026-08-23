import type { AiGatewayError } from '../../../domain/ai/errors';
import type { AiOperation } from '../../../domain/ai/operations';
import type { PromptIdentity } from '../../../domain/ai/promptIdentity';
import type { SchemaIdentity } from '../../../domain/ai/schemaIdentity';
import type { ValidatedAiTenantContext } from '../../../domain/ai/tenantContext';
import type { AiExecutionMetadata } from '../contracts/result';
import type { AiRequestMetadata } from '../contracts/request';
import type { AiRunPersistenceRecord } from '../ports/outbound/AiRunRepositoryPort';

export interface BuildAiRunPersistenceRecordParams {
  id: string;
  tenant: ValidatedAiTenantContext;
  requestMetadata?: AiRequestMetadata;
  operation: AiOperation;
  executionStatus: 'SUCCESS' | 'FAILED';
  metadata?: Partial<AiExecutionMetadata>;
  prompt?: PromptIdentity;
  renderedPromptHash?: string;
  schema?: SchemaIdentity;
  error?: AiGatewayError;
  latencyMs: number;
}

function deriveTotalTokens(
  promptTokens?: number,
  completionTokens?: number,
  explicitTotal?: number
): number | undefined {
  if (explicitTotal != null) return explicitTotal;
  if (promptTokens != null && completionTokens != null) {
    return promptTokens + completionTokens;
  }
  return undefined;
}

export function buildAiRunPersistenceRecord(
  params: BuildAiRunPersistenceRecordParams
): AiRunPersistenceRecord {
  const metadata = params.metadata;
  const promptTokens = metadata?.promptTokens;
  const completionTokens = metadata?.completionTokens;
  const executionMode = metadata?.executionMode ?? 'SINGLE';

  return {
    id: params.id,
    organizationId: params.tenant.organizationId,
    clientId: params.tenant.clientId ?? '',
    userId: params.tenant.userId,
    correlationId: params.requestMetadata?.correlationId,
    operation: params.operation,
    executionMode,
    providerName: executionMode === 'COMPARATIVE' ? undefined : metadata?.providerName,
    providerModelId: executionMode === 'COMPARATIVE' ? undefined : metadata?.providerModelId,
    modelRole: executionMode === 'COMPARATIVE' ? undefined : metadata?.logicalModelRole,
    providerExecutions: metadata?.providerExecutions,
    prompt: params.prompt ?? metadata?.prompt,
    renderedPromptHash: params.renderedPromptHash,
    schema: params.schema ?? metadata?.schema,
    executionStatus: params.executionStatus,
    validationStatus: metadata?.validationStatus,
    validationFailureReason: metadata?.validationFailureReason,
    attemptCount: metadata?.attemptCount,
    retryCount: metadata?.retryCount,
    repairCount: metadata?.repairCount ?? 0,
    providerCallCount: metadata?.providerCallCount,
    promptTokens,
    completionTokens,
    totalTokens: deriveTotalTokens(promptTokens, completionTokens),
    latencyMs: params.latencyMs,
    errorClass: params.error?.code,
    errorMessageSanitized: params.error?.message,
    source: 'AI_GATEWAY',
    costStatus: 'NOT_CALCULATED',
  };
}
