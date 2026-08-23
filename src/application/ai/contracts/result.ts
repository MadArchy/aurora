import type { AiGatewayError } from '../../../domain/ai/errors';
import type { PromptIdentity } from '../../../domain/ai/promptIdentity';
import type { SchemaIdentity } from '../../../domain/ai/schemaIdentity';
import type { ValidationStatus } from '../../../domain/ai/validationState';

export interface AiExecutionMetadata {
  operation: string;
  prompt: PromptIdentity;
  schema: SchemaIdentity;
  validationStatus: ValidationStatus;
  repairCount: number;
  attemptCount: number;
  retryCount: number;
  providerCallCount: number;
  validationFailureReason?: 'INVALID_JSON' | 'SCHEMA_MISMATCH';
  logicalModelRole?: string;
  providerName?: string;
  providerModelId?: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  /** SINGLE (default) or COMPARATIVE multi-provider orchestration. */
  executionMode?: 'SINGLE' | 'COMPARATIVE';
  providerExecutions?: import('../ports/outbound/AiRunRepositoryPort').AiProviderExecutionAudit[];
}

/** Trusted output — only produced after application validation. */
export type ValidatedDomainOutput<T> = T & { readonly __validatedDomainOutput: unique symbol };

export type AiGatewaySuccess<TOutput> = {
  ok: true;
  data: ValidatedDomainOutput<TOutput>;
  metadata: AiExecutionMetadata;
};

export type AiGatewayFailure = {
  ok: false;
  error: AiGatewayError;
  metadata?: Partial<AiExecutionMetadata>;
};

export type AiGatewayResult<TOutput> = AiGatewaySuccess<TOutput> | AiGatewayFailure;

export function aiGatewaySuccess<TOutput>(
  data: ValidatedDomainOutput<TOutput>,
  metadata: AiExecutionMetadata
): AiGatewaySuccess<TOutput> {
  return { ok: true, data, metadata };
}

export function aiGatewayFailure(error: AiGatewayError, metadata?: Partial<AiExecutionMetadata>): AiGatewayFailure {
  return { ok: false, error, metadata };
}

export function markValidatedDomainOutput<T>(data: T): ValidatedDomainOutput<T> {
  return data as ValidatedDomainOutput<T>;
}

/** Untrusted provider payload before application validation. */
export type UntrustedProviderOutput = {
  rawText: string;
};

export function markUntrustedProviderOutput(rawText: string): UntrustedProviderOutput {
  return { rawText };
}
