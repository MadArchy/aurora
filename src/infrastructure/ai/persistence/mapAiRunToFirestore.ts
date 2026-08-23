import type { AiRunPersistenceRecord } from '../../../application/ai/ports/outbound/AiRunRepositoryPort';

export type FirestoreAiRunDocument = Record<string, unknown>;

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue !== undefined) out[key] = fieldValue;
  }
  return out as T;
}

/** Maps application audit record to Firestore-safe document fields. */
export function mapAiRunToFirestore(record: AiRunPersistenceRecord): FirestoreAiRunDocument {
  return omitUndefined({
    id: record.id,
    organizationId: record.organizationId,
    clientId: record.clientId,
    userId: record.userId,
    correlationId: record.correlationId,
    operation: record.operation,
    providerName: record.providerName,
    providerModelId: record.providerModelId,
    modelRole: record.modelRole,
    promptId: record.prompt?.promptId,
    promptVersion: record.prompt?.promptVersion,
    promptHash: record.prompt?.promptHash,
    renderedPromptHash: record.renderedPromptHash,
    schemaId: record.schema?.schemaId,
    schemaVersion: record.schema?.schemaVersion,
    executionStatus: record.executionStatus,
    validationStatus: record.validationStatus,
    validationFailureReason: record.validationFailureReason,
    attemptCount: record.attemptCount,
    retryCount: record.retryCount,
    repairCount: record.repairCount,
    providerCallCount: record.providerCallCount,
    promptTokens: record.promptTokens,
    completionTokens: record.completionTokens,
    totalTokens: record.totalTokens,
    latencyMs: record.latencyMs,
    errorClass: record.errorClass,
    errorMessageSanitized: record.errorMessageSanitized,
    source: record.source,
    costStatus: record.costStatus,
  });
}
