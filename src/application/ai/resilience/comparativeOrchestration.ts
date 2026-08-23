import {
  MAX_PROVIDER_RETRIES,
  MAX_PROVIDER_CALLS_PER_PROVIDER_SLICE,
  PROVIDER_RETRY_BACKOFF_MS,
  DEFAULT_PROVIDER_TIMEOUT_MS,
} from '../../../domain/ai/constants';
import type { AiOperation } from '../../../domain/ai/operations';
import type { AiGatewayErrorCode } from '../../../domain/ai/errors';
import { createGatewayError } from '../../../domain/ai/errors';
import type { PromptIdentity } from '../../../domain/ai/promptIdentity';
import type { SchemaIdentity } from '../../../domain/ai/schemaIdentity';
import type { AiProviderPort, AiProviderCompletionResponse } from '../ports/outbound/AiProviderPort';
import type { ModelConfiguration } from '../ports/outbound/ModelRegistryPort';
import type { PromptRegistryPort } from '../ports/outbound/PromptRegistryPort';
import type { AiProviderExecutionAudit } from '../ports/outbound/AiRunRepositoryPort';
import type { ComparativeAnalysisOutput } from '../schemas/comparativeAnalysis';
import type { ComparativeAnalysisAggregate } from '../schemas/comparativeAnalysisAggregate';
import { resolveComparativeSliceSchema } from '../schemas/outputRegistry';
import { validateAiOutput } from '../validation/validateOutput';
import { canAttemptRepair } from '../validation/validationPipeline';
import { isValidationRepairEligible } from './repairEligibility';
import { ProviderCallBudget } from './providerCallBudget';
import { executeProviderWithRetry } from './providerRetryPolicy';
import {
  GatewayDeadlineExceededError,
  type GatewayExecutionDeadline,
} from './gatewayExecutionDeadline';
import { ProviderPortError } from '../errors/providerPortErrors';
import type { AiGatewayError } from '../../../domain/ai/errors';

export type ComparativeSliceLabel = 'openai' | 'anthropic';

export interface ComparativeSliceSuccess {
  ok: true;
  label: ComparativeSliceLabel;
  output: ComparativeAnalysisOutput;
  audit: AiProviderExecutionAudit;
  promptTokens?: number;
  completionTokens?: number;
}

export interface ComparativeSliceFailure {
  ok: false;
  label: ComparativeSliceLabel;
  audit: AiProviderExecutionAudit;
  error: AiGatewayError;
  promptTokens?: number;
  completionTokens?: number;
}

export type ComparativeSliceResult = ComparativeSliceSuccess | ComparativeSliceFailure;

export interface ExecuteComparativeSliceParams {
  label: ComparativeSliceLabel;
  model: ModelConfiguration;
  operation: AiOperation;
  promptIdentity: PromptIdentity;
  schemaIdentity: SchemaIdentity;
  systemMessage: string;
  userMessage: string;
  providerPort: AiProviderPort;
  promptRegistry: PromptRegistryPort;
  deadline: GatewayExecutionDeadline;
  providerTimeoutMs?: number;
  retryBackoffMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

function deriveTotalTokens(prompt?: number, completion?: number): number | undefined {
  if (prompt != null && completion != null) return prompt + completion;
  return undefined;
}

function mapProviderErrorToGateway(error: unknown): AiGatewayError {
  if (error instanceof GatewayDeadlineExceededError) {
    return createGatewayError({
      code: 'TIMEOUT',
      message: error.message,
      retryable: true,
    });
  }
  if (error instanceof ProviderPortError) {
    return createGatewayError({
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.httpStatus ? { httpStatus: error.httpStatus } : undefined,
    });
  }
  return createGatewayError({
    code: 'PROVIDER_ERROR',
    message: error instanceof Error ? error.message : 'Provider call failed',
    retryable: false,
  });
}

/**
 * Execute one comparative provider slice with provider-preserving repair.
 * Repair uses the SAME model configuration as the slice — never FAST_STRUCTURED cross-provider.
 */
export async function executeComparativeSlice(
  params: ExecuteComparativeSliceParams
): Promise<ComparativeSliceResult> {
  const budget = new ProviderCallBudget(MAX_PROVIDER_CALLS_PER_PROVIDER_SLICE);
  const providerTimeoutMs = params.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const sliceSchema = resolveComparativeSliceSchema();
  let totalRetryCount = 0;
  let repairCount = 0;
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let lastLatencyMs: number | undefined;
  let lastModelId = params.model.providerModelId;

  const addTokens = (response?: AiProviderCompletionResponse) => {
    if (!response) return;
    if (response.promptTokens != null) promptTokens = (promptTokens ?? 0) + response.promptTokens;
    if (response.completionTokens != null) {
      completionTokens = (completionTokens ?? 0) + response.completionTokens;
    }
    lastLatencyMs = response.latencyMs;
    lastModelId = response.providerModelId || lastModelId;
  };

  const buildAudit = (
    status: 'SUCCESS' | 'FAILED',
    errorClass?: AiGatewayErrorCode
  ): AiProviderExecutionAudit => ({
    provider: params.model.providerName,
    providerModelId: lastModelId,
    modelRole: params.model.role,
    attemptCount: budget.providerCallCount,
    retryCount: totalRetryCount,
    repairCount,
    providerCallCount: budget.providerCallCount,
    promptTokens,
    completionTokens,
    totalTokens: deriveTotalTokens(promptTokens, completionTokens),
    latencyMs: lastLatencyMs,
    status,
    errorClass,
  });

  let primaryExecution;
  try {
    primaryExecution = await executeProviderWithRetry({
      providerPort: params.providerPort,
      budget,
      deadline: params.deadline,
      providerTimeoutMs,
      maxRetries: MAX_PROVIDER_RETRIES,
      backoffMs: params.retryBackoffMs ?? PROVIDER_RETRY_BACKOFF_MS,
      sleepFn: params.sleepFn,
      request: {
        operation: params.operation,
        logicalModelRole: params.model.role,
        model: params.model,
        structuredJsonRequired: true,
        messages: [
          { role: 'system', content: params.systemMessage },
          { role: 'user', content: params.userMessage },
        ],
      },
    });
    totalRetryCount += primaryExecution.retryCount;
    addTokens(primaryExecution.response);
  } catch (error) {
    const gatewayError = mapProviderErrorToGateway(error);
    return {
      ok: false,
      label: params.label,
      audit: buildAudit('FAILED', gatewayError.code),
      error: gatewayError,
      promptTokens,
      completionTokens,
    };
  }

  const primaryValidation = validateAiOutput({
    raw: primaryExecution.response.rawText,
    schema: sliceSchema.schema,
  });

  if (primaryValidation.status === 'VALID') {
    return {
      ok: true,
      label: params.label,
      output: primaryValidation.data,
      audit: buildAudit('SUCCESS'),
      promptTokens,
      completionTokens,
    };
  }

  if (!isValidationRepairEligible(primaryValidation) || !canAttemptRepair(0)) {
    const code: AiGatewayErrorCode = 'INVALID_OUTPUT';
    return {
      ok: false,
      label: params.label,
      audit: buildAudit('FAILED', code),
      error: createGatewayError({
        code,
        message:
          primaryValidation.status === 'REJECTED'
            ? primaryValidation.reason
            : 'Schema validation failed',
        retryable: false,
      }),
      promptTokens,
      completionTokens,
    };
  }

  if (!params.deadline.canFitProviderAttempt(providerTimeoutMs)) {
    return {
      ok: false,
      label: params.label,
      audit: buildAudit('FAILED', 'TIMEOUT'),
      error: createGatewayError({
        code: 'TIMEOUT',
        message: 'Gateway execution deadline exceeded',
        retryable: true,
      }),
      promptTokens,
      completionTokens,
    };
  }

  const repairPrompt = params.promptRegistry.resolveRepair({
    operation: params.operation,
    schemaIdentity: params.schemaIdentity,
    validationIssues: primaryValidation.issues,
    invalidOutput: primaryExecution.response.rawText,
  });

  // CRITICAL: repair uses the SAME provider/model as the slice — never FAST_STRUCTURED cross-provider.
  let repairExecution;
  try {
    repairExecution = await executeProviderWithRetry({
      providerPort: params.providerPort,
      budget,
      deadline: params.deadline,
      providerTimeoutMs,
      maxRetries: MAX_PROVIDER_RETRIES,
      backoffMs: params.retryBackoffMs ?? PROVIDER_RETRY_BACKOFF_MS,
      sleepFn: params.sleepFn,
      request: {
        operation: params.operation,
        logicalModelRole: params.model.role,
        model: params.model,
        structuredJsonRequired: true,
        messages: [
          { role: 'system', content: repairPrompt.systemMessage },
          { role: 'user', content: repairPrompt.userMessage },
        ],
      },
    });
    repairCount = 1;
    totalRetryCount += repairExecution.retryCount;
    addTokens(repairExecution.response);
  } catch (error) {
    repairCount = 1;
    const gatewayError = mapProviderErrorToGateway(error);
    return {
      ok: false,
      label: params.label,
      audit: buildAudit('FAILED', gatewayError.code),
      error: gatewayError,
      promptTokens,
      completionTokens,
    };
  }

  const repairValidation = validateAiOutput({
    raw: repairExecution.response.rawText,
    schema: sliceSchema.schema,
  });

  if (repairValidation.status === 'VALID') {
    return {
      ok: true,
      label: params.label,
      output: repairValidation.data,
      audit: buildAudit('SUCCESS'),
      promptTokens,
      completionTokens,
    };
  }

  return {
    ok: false,
    label: params.label,
    audit: buildAudit('FAILED', 'REPAIR_FAILED'),
    error: createGatewayError({
      code: 'REPAIR_FAILED',
      message:
        repairValidation.status === 'REJECTED'
          ? `Repair output still invalid: ${repairValidation.reason}`
          : 'Repair validation failed',
      retryable: false,
    }),
    promptTokens,
    completionTokens,
  };
}

export interface AggregateComparativeParams {
  openai: ComparativeSliceResult;
  anthropic: ComparativeSliceResult;
}

/**
 * BOTH providers required. One-sided success is overall failure.
 * Aggregation is software logic — no judge model.
 */
export function aggregateComparativeSlices(
  params: AggregateComparativeParams
):
  | { ok: true; aggregate: ComparativeAnalysisAggregate; providerExecutions: AiProviderExecutionAudit[] }
  | { ok: false; error: AiGatewayError; providerExecutions: AiProviderExecutionAudit[] } {
  const providerExecutions = [params.openai.audit, params.anthropic.audit];

  if (params.openai.ok && params.anthropic.ok) {
    return {
      ok: true,
      aggregate: {
        openai: params.openai.output,
        anthropic: params.anthropic.output,
      },
      providerExecutions,
    };
  }

  // Prefer the more specific failure from a failed slice (not the successful one).
  const failed = !params.openai.ok
    ? params.openai
    : !params.anthropic.ok
      ? params.anthropic
      : null;

  if (failed && !failed.ok) {
    return { ok: false, error: failed.error, providerExecutions };
  }

  return {
    ok: false,
    error: createGatewayError({
      code: 'PROVIDER_ERROR',
      message: 'Comparative analysis requires both OpenAI and Anthropic slices',
      retryable: false,
    }),
    providerExecutions,
  };
}

/** Prefer Anthropic failure when both fail (deterministic tie-break). */
export function pickComparativeFailureError(
  openai: ComparativeSliceResult,
  anthropic: ComparativeSliceResult
): AiGatewayError {
  if (!openai.ok && !anthropic.ok) {
    // Prefer non-generic / more specific codes; otherwise Anthropic (second slice) error.
    const openaiCode = openai.error.code;
    const anthropicCode = anthropic.error.code;
    if (openaiCode === 'RATE_LIMITED' || anthropicCode === 'RATE_LIMITED') {
      return openaiCode === 'RATE_LIMITED' ? openai.error : anthropic.error;
    }
    if (openaiCode === 'REPAIR_FAILED' || anthropicCode === 'REPAIR_FAILED') {
      return openaiCode === 'REPAIR_FAILED' ? openai.error : anthropic.error;
    }
    if (openaiCode === 'TIMEOUT' || anthropicCode === 'TIMEOUT') {
      return openaiCode === 'TIMEOUT' ? openai.error : anthropic.error;
    }
    return anthropic.error;
  }
  if (!openai.ok) return openai.error;
  if (!anthropic.ok) return anthropic.error;
  return createGatewayError({
    code: 'PROVIDER_ERROR',
    message: 'Comparative analysis failed',
    retryable: false,
  });
}

export function sumComparativeTokenUsage(
  slices: ComparativeSliceResult[]
): { promptTokens?: number; completionTokens?: number } {
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  for (const slice of slices) {
    if (slice.promptTokens != null) promptTokens = (promptTokens ?? 0) + slice.promptTokens;
    if (slice.completionTokens != null) {
      completionTokens = (completionTokens ?? 0) + slice.completionTokens;
    }
  }
  return { promptTokens, completionTokens };
}
