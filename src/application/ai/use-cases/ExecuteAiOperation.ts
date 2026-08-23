import type { AiGatewayPort } from '../ports/inbound/AiGatewayPort';
import type { AiGatewayRequest } from '../contracts/request';
import type { AiGatewayResult, AiExecutionMetadata, AiGatewayFailure } from '../contracts/result';
import { aiGatewayFailure, aiGatewaySuccess, markValidatedDomainOutput } from '../contracts/result';
import type { AiOperationOutputMap } from '../schemas/outputRegistry';
import { resolveOperationSchema, resolveSchemaIdentity, isOperationSupported } from '../schemas/outputRegistry';
import { DEFAULT_MODEL_ROLE_BY_OPERATION } from '../../../domain/ai/modelRole';
import { createGatewayError } from '../../../domain/ai/errors';
import {
  MAX_PROVIDER_RETRIES,
  PROVIDER_RETRY_BACKOFF_MS,
  REPAIR_MODEL_ROLE,
  DEFAULT_PROVIDER_TIMEOUT_MS,
} from '../../../domain/ai/constants';
import type { AiProviderPort, AiProviderCompletionResponse } from '../ports/outbound/AiProviderPort';
import type { ModelRegistryPort } from '../ports/outbound/ModelRegistryPort';
import type { PromptRegistryPort } from '../ports/outbound/PromptRegistryPort';
import { validateAiOutput } from '../validation/validateOutput';
import { canAttemptRepair } from '../validation/validationPipeline';
import { ProviderPortError, PromptResolutionError } from '../errors/providerPortErrors';
import { isModelConfigurationResolved } from '../validation/modelConfiguration';
import type { AiOperation } from '../../../domain/ai/operations';
import { ProviderCallBudget } from '../resilience/providerCallBudget';
import { executeProviderWithRetry } from '../resilience/providerRetryPolicy';
import { isValidationRepairEligible, validationFailureReason } from '../resilience/repairEligibility';
import {
  createGatewayExecutionDeadline,
  GatewayDeadlineExceededError,
} from '../resilience/gatewayExecutionDeadline';

export interface ExecuteAiOperationDeps {
  providerPort: AiProviderPort;
  modelRegistry: ModelRegistryPort;
  promptRegistry: PromptRegistryPort;
  /** Override retry backoff for deterministic tests (default: PROVIDER_RETRY_BACKOFF_MS). */
  retryBackoffMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
  providerTimeoutMs?: number;
  nowFn?: () => number;
  maxGatewayExecutionMs?: number;
}

/** Application orchestration — resolves ports, retries transient failures, repairs invalid output. */
export class ExecuteAiOperation implements AiGatewayPort {
  constructor(private readonly deps: ExecuteAiOperationDeps) {}

  async execute<K extends AiOperation>(
    request: AiGatewayRequest<unknown>
  ): Promise<AiGatewayResult<AiOperationOutputMap[K]>> {
    if (!isOperationSupported(request.operation)) {
      return aiGatewayFailure(
        createGatewayError({
          code: 'OPERATION_NOT_SUPPORTED',
          message: `Unsupported operation: ${request.operation}`,
          retryable: false,
        })
      );
    }

    const operation = request.operation;
    const schemaDef = resolveOperationSchema(operation);
    const schemaIdentity = resolveSchemaIdentity(operation);
    const logicalRole = DEFAULT_MODEL_ROLE_BY_OPERATION[operation];
    const modelConfig = this.deps.modelRegistry.resolve(logicalRole, operation);

    if (!isModelConfigurationResolved(modelConfig)) {
      return aiGatewayFailure(
        createGatewayError({
          code: 'MODEL_NOT_RESOLVED',
          message: `Model not resolved for role ${logicalRole}`,
          retryable: false,
        })
      );
    }

    let resolvedPrompt;
    try {
      resolvedPrompt = this.deps.promptRegistry.resolve({
        operation,
        identity: request.prompt,
        input: request.input,
      });
    } catch (error) {
      const message = error instanceof PromptResolutionError ? error.message : 'Prompt resolution failed';
      return aiGatewayFailure(
        createGatewayError({
          code: 'OPERATION_NOT_SUPPORTED',
          message,
          retryable: false,
        })
      );
    }

    const budget = new ProviderCallBudget();
    const deadline = createGatewayExecutionDeadline(this.deps.nowFn, this.deps.maxGatewayExecutionMs);
    const providerTimeoutMs = this.deps.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
    let totalRetryCount = 0;

    let primaryExecution;
    try {
      primaryExecution = await executeProviderWithRetry({
        providerPort: this.deps.providerPort,
        budget,
        deadline,
        providerTimeoutMs,
        maxRetries: MAX_PROVIDER_RETRIES,
        backoffMs: this.deps.retryBackoffMs ?? PROVIDER_RETRY_BACKOFF_MS,
        sleepFn: this.deps.sleepFn,
        request: {
          operation,
          logicalModelRole: logicalRole,
          model: modelConfig,
          structuredJsonRequired: true,
          messages: [
            { role: 'system', content: resolvedPrompt.systemMessage },
            { role: 'user', content: resolvedPrompt.userMessage },
          ],
        },
      });
      totalRetryCount += primaryExecution.retryCount;
    } catch (error) {
      return this.mapProviderFailure(error, {
        operation,
        prompt: resolvedPrompt.identity,
        schema: schemaIdentity,
        attemptCount: budget.providerCallCount,
        retryCount: totalRetryCount,
        repairCount: 0,
        providerCallCount: budget.providerCallCount,
        logicalModelRole: logicalRole,
      });
    }

    const primaryValidation = validateAiOutput({
      raw: primaryExecution.response.rawText,
      schema: schemaDef.schema,
    });

    if (primaryValidation.status === 'VALID') {
      return aiGatewaySuccess(
        markValidatedDomainOutput(primaryValidation.data),
        this.buildMetadata({
          operation,
          prompt: resolvedPrompt.identity,
          schema: schemaIdentity,
          validationStatus: 'VALID',
          repairCount: 0,
          attemptCount: primaryExecution.attemptCount,
          retryCount: totalRetryCount,
          providerCallCount: budget.providerCallCount,
          response: primaryExecution.response,
          logicalModelRole: logicalRole,
        })
      ) as AiGatewayResult<AiOperationOutputMap[K]>;
    }

    if (!isValidationRepairEligible(primaryValidation) || !canAttemptRepair(0)) {
      return aiGatewayFailure(
        createGatewayError({
          code: 'INVALID_OUTPUT',
          message:
            primaryValidation.status === 'REJECTED'
              ? primaryValidation.reason
              : 'Schema validation failed',
          retryable: false,
        }),
        this.buildMetadata({
          operation,
          prompt: resolvedPrompt.identity,
          schema: schemaIdentity,
          validationStatus: 'REJECTED',
          repairCount: 0,
          attemptCount: primaryExecution.attemptCount,
          retryCount: totalRetryCount,
          providerCallCount: budget.providerCallCount,
          response: primaryExecution.response,
          logicalModelRole: logicalRole,
          validationFailureReason: validationFailureReason(primaryValidation),
        })
      );
    }

    if (!deadline.canFitProviderAttempt(providerTimeoutMs)) {
      return this.gatewayDeadlineFailure({
        operation,
        prompt: resolvedPrompt.identity,
        schema: schemaIdentity,
        repairCount: 0,
        attemptCount: primaryExecution.attemptCount,
        retryCount: totalRetryCount,
        providerCallCount: budget.providerCallCount,
        logicalModelRole: logicalRole,
        validationFailureReason: validationFailureReason(primaryValidation),
      });
    }

    const repairPrompt = this.deps.promptRegistry.resolveRepair({
      operation,
      schemaIdentity,
      validationIssues: primaryValidation.issues,
      invalidOutput: primaryExecution.response.rawText,
    });

    const repairModelConfig = this.deps.modelRegistry.resolve(REPAIR_MODEL_ROLE, operation);
    if (!isModelConfigurationResolved(repairModelConfig)) {
      return aiGatewayFailure(
        createGatewayError({
          code: 'MODEL_NOT_RESOLVED',
          message: `Repair model not resolved for role ${REPAIR_MODEL_ROLE}`,
          retryable: false,
        }),
        this.buildMetadata({
          operation,
          prompt: resolvedPrompt.identity,
          schema: schemaIdentity,
          validationStatus: 'REPAIR_REQUIRED',
          repairCount: 0,
          attemptCount: primaryExecution.attemptCount,
          retryCount: totalRetryCount,
          providerCallCount: budget.providerCallCount,
          response: primaryExecution.response,
          logicalModelRole: logicalRole,
          validationFailureReason: validationFailureReason(primaryValidation),
        })
      );
    }

    let repairExecution;
    try {
      repairExecution = await executeProviderWithRetry({
        providerPort: this.deps.providerPort,
        budget,
        deadline,
        providerTimeoutMs,
        maxRetries: MAX_PROVIDER_RETRIES,
        backoffMs: this.deps.retryBackoffMs ?? PROVIDER_RETRY_BACKOFF_MS,
        sleepFn: this.deps.sleepFn,
        request: {
          operation,
          logicalModelRole: REPAIR_MODEL_ROLE,
          model: repairModelConfig,
          structuredJsonRequired: true,
          messages: [
            { role: 'system', content: repairPrompt.systemMessage },
            { role: 'user', content: repairPrompt.userMessage },
          ],
        },
      });
      totalRetryCount += repairExecution.retryCount;
    } catch (error) {
      return this.mapProviderFailure(error, {
        operation,
        prompt: resolvedPrompt.identity,
        schema: schemaIdentity,
        attemptCount: budget.providerCallCount,
        retryCount: totalRetryCount,
        repairCount: 1,
        providerCallCount: budget.providerCallCount,
        logicalModelRole: REPAIR_MODEL_ROLE,
        validationFailureReason: validationFailureReason(primaryValidation),
      });
    }

    const repairValidation = validateAiOutput({
      raw: repairExecution.response.rawText,
      schema: schemaDef.schema,
    });

    if (repairValidation.status === 'VALID') {
      return aiGatewaySuccess(
        markValidatedDomainOutput(repairValidation.data),
        this.buildMetadata({
          operation,
          prompt: resolvedPrompt.identity,
          schema: schemaIdentity,
          validationStatus: 'VALID',
          repairCount: 1,
          attemptCount: primaryExecution.attemptCount + repairExecution.attemptCount,
          retryCount: totalRetryCount,
          providerCallCount: budget.providerCallCount,
          response: repairExecution.response,
          logicalModelRole: REPAIR_MODEL_ROLE,
          validationFailureReason: validationFailureReason(primaryValidation),
        })
      ) as AiGatewayResult<AiOperationOutputMap[K]>;
    }

    return aiGatewayFailure(
      createGatewayError({
        code: 'REPAIR_FAILED',
        message:
          repairValidation.status === 'REJECTED'
            ? `Repair output still invalid: ${repairValidation.reason}`
            : 'Repair validation failed',
        retryable: false,
      }),
      this.buildMetadata({
        operation,
        prompt: resolvedPrompt.identity,
        schema: schemaIdentity,
        validationStatus: 'REJECTED',
        repairCount: 1,
        attemptCount: primaryExecution.attemptCount + repairExecution.attemptCount,
        retryCount: totalRetryCount,
        providerCallCount: budget.providerCallCount,
        response: repairExecution.response,
        logicalModelRole: REPAIR_MODEL_ROLE,
        validationFailureReason: validationFailureReason(repairValidation),
      })
    );
  }

  private mapProviderFailure(
    error: unknown,
    partial: {
      operation: AiOperation;
      prompt: AiExecutionMetadata['prompt'];
      schema: AiExecutionMetadata['schema'];
      validationStatus?: AiExecutionMetadata['validationStatus'];
      repairCount: number;
      attemptCount: number;
      retryCount: number;
      providerCallCount: number;
      logicalModelRole?: string;
      validationFailureReason?: AiExecutionMetadata['validationFailureReason'];
    }
  ): AiGatewayFailure {
    const metadata = this.buildMetadata({
      ...partial,
      validationStatus: partial.validationStatus ?? 'REJECTED',
      response: undefined,
    });

    if (error instanceof GatewayDeadlineExceededError) {
      return aiGatewayFailure(
        createGatewayError({
          code: 'TIMEOUT',
          message: error.message,
          retryable: true,
        }),
        metadata
      );
    }

    if (error instanceof ProviderPortError) {
      return aiGatewayFailure(
        createGatewayError({
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          details: error.httpStatus ? { httpStatus: error.httpStatus } : undefined,
        }),
        metadata
      );
    }

    return aiGatewayFailure(
      createGatewayError({
        code: 'PROVIDER_ERROR',
        message: error instanceof Error ? error.message : 'Provider call failed',
        retryable: false,
      }),
      metadata
    );
  }

  private gatewayDeadlineFailure(partial: {
    operation: AiOperation;
    prompt: AiExecutionMetadata['prompt'];
    schema: AiExecutionMetadata['schema'];
    repairCount: number;
    attemptCount: number;
    retryCount: number;
    providerCallCount: number;
    logicalModelRole?: string;
    validationFailureReason?: AiExecutionMetadata['validationFailureReason'];
  }): AiGatewayFailure {
    return aiGatewayFailure(
      createGatewayError({
        code: 'TIMEOUT',
        message: 'Gateway execution deadline exceeded',
        retryable: true,
      }),
      this.buildMetadata({
        ...partial,
        validationStatus: 'REJECTED',
        response: undefined,
      })
    );
  }

  private buildMetadata(params: {
    operation: AiOperation;
    prompt: AiExecutionMetadata['prompt'];
    schema: AiExecutionMetadata['schema'];
    validationStatus: AiExecutionMetadata['validationStatus'];
    repairCount: number;
    attemptCount: number;
    retryCount: number;
    providerCallCount: number;
    response?: AiProviderCompletionResponse;
    logicalModelRole?: string;
    validationFailureReason?: AiExecutionMetadata['validationFailureReason'];
  }): AiExecutionMetadata {
    return {
      operation: params.operation,
      prompt: params.prompt,
      schema: params.schema,
      validationStatus: params.validationStatus,
      repairCount: params.repairCount,
      attemptCount: params.attemptCount,
      retryCount: params.retryCount,
      providerCallCount: params.providerCallCount,
      validationFailureReason: params.validationFailureReason,
      logicalModelRole: params.logicalModelRole,
      providerName: params.response?.providerName,
      providerModelId: params.response?.providerModelId,
      latencyMs: params.response?.latencyMs,
      promptTokens: params.response?.promptTokens,
      completionTokens: params.response?.completionTokens,
    };
  }
}
