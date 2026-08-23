import { randomUUID } from 'node:crypto';
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
import type { AiRunRepositoryPort } from '../ports/outbound/AiRunRepositoryPort';
import { validateAiOutput } from '../validation/validateOutput';
import { canAttemptRepair } from '../validation/validationPipeline';
import { ProviderPortError, PromptResolutionError, ModelNotResolvedError } from '../errors/providerPortErrors';
import { isModelConfigurationResolved } from '../validation/modelConfiguration';
import type { AiOperation } from '../../../domain/ai/operations';
import type { PromptIdentity } from '../../../domain/ai/promptIdentity';
import type { SchemaIdentity } from '../../../domain/ai/schemaIdentity';
import { ProviderCallBudget } from '../resilience/providerCallBudget';
import { executeProviderWithRetry } from '../resilience/providerRetryPolicy';
import { isValidationRepairEligible, validationFailureReason } from '../resilience/repairEligibility';
import {
  createGatewayExecutionDeadline,
  GatewayDeadlineExceededError,
} from '../resilience/gatewayExecutionDeadline';
import { buildAiRunPersistenceRecord } from '../audit/buildAiRunPersistenceRecord';
import { computeRenderedPromptHash } from '../audit/renderedPromptHash';
import {
  executeComparativeSlice,
  aggregateComparativeSlices,
  pickComparativeFailureError,
  sumComparativeTokenUsage,
} from '../resilience/comparativeOrchestration';

export interface ExecuteAiOperationDeps {
  providerPort: AiProviderPort;
  modelRegistry: ModelRegistryPort;
  promptRegistry: PromptRegistryPort;
  aiRunRepository?: AiRunRepositoryPort;
  /** Override retry backoff for deterministic tests (default: PROVIDER_RETRY_BACKOFF_MS). */
  retryBackoffMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
  providerTimeoutMs?: number;
  nowFn?: () => number;
  maxGatewayExecutionMs?: number;
}

class TokenUsageTracker {
  promptTokens?: number;
  completionTokens?: number;

  add(response?: AiProviderCompletionResponse): void {
    if (!response) return;
    if (response.promptTokens != null) {
      this.promptTokens = (this.promptTokens ?? 0) + response.promptTokens;
    }
    if (response.completionTokens != null) {
      this.completionTokens = (this.completionTokens ?? 0) + response.completionTokens;
    }
  }
}

/** Application orchestration — resolves ports, retries transient failures, repairs invalid output. */
export class ExecuteAiOperation implements AiGatewayPort {
  constructor(private readonly deps: ExecuteAiOperationDeps) {}

  async execute<K extends AiOperation>(
    request: AiGatewayRequest<unknown>
  ): Promise<AiGatewayResult<AiOperationOutputMap[K]>> {
    const runId = randomUUID();
    const startedAt = this.now();
    const tokenUsage = new TokenUsageTracker();

    if (!isOperationSupported(request.operation)) {
      return this.finalize(request, runId, startedAt, undefined, undefined, tokenUsage, aiGatewayFailure(
        createGatewayError({
          code: 'OPERATION_NOT_SUPPORTED',
          message: `Unsupported operation: ${request.operation}`,
          retryable: false,
        })
      ));
    }

    const operation = request.operation;
    if (operation === 'ANALYSIS_COMPARATIVE') {
      return this.executeComparative(request, runId, startedAt, tokenUsage) as Promise<
        AiGatewayResult<AiOperationOutputMap[K]>
      >;
    }

    const schemaDef = resolveOperationSchema(operation);
    const schemaIdentity = resolveSchemaIdentity(operation);
    const logicalRole = DEFAULT_MODEL_ROLE_BY_OPERATION[operation];
    const modelConfig = this.deps.modelRegistry.resolve(logicalRole, operation);

    if (!isModelConfigurationResolved(modelConfig)) {
      return this.finalize(request, runId, startedAt, undefined, schemaIdentity, tokenUsage, aiGatewayFailure(
        createGatewayError({
          code: 'MODEL_NOT_RESOLVED',
          message: `Model not resolved for role ${logicalRole}`,
          retryable: false,
        }),
        {
          operation,
          schema: schemaIdentity,
          validationStatus: 'REJECTED',
          repairCount: 0,
          logicalModelRole: logicalRole,
        }
      ));
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
      return this.finalize(request, runId, startedAt, undefined, schemaIdentity, tokenUsage, aiGatewayFailure(
        createGatewayError({
          code: 'OPERATION_NOT_SUPPORTED',
          message,
          retryable: false,
        }),
        {
          operation,
          schema: schemaIdentity,
          validationStatus: 'REJECTED',
          repairCount: 0,
          logicalModelRole: logicalRole,
        }
      ));
    }

    const renderedPromptHash = computeRenderedPromptHash(
      resolvedPrompt.systemMessage,
      resolvedPrompt.userMessage
    );

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
      tokenUsage.add(primaryExecution.response);
    } catch (error) {
      return this.finalize(
        request,
        runId,
        startedAt,
        renderedPromptHash,
        schemaIdentity,
        tokenUsage,
        this.mapProviderFailure(error, {
          operation,
          prompt: resolvedPrompt.identity,
          schema: schemaIdentity,
          attemptCount: budget.providerCallCount,
          retryCount: totalRetryCount,
          repairCount: 0,
          providerCallCount: budget.providerCallCount,
          logicalModelRole: logicalRole,
          tokenUsage,
        })
      );
    }

    const primaryValidation = validateAiOutput({
      raw: primaryExecution.response.rawText,
      schema: schemaDef.schema,
    });

    if (primaryValidation.status === 'VALID') {
      return this.finalize(
        request,
        runId,
        startedAt,
        renderedPromptHash,
        schemaIdentity,
        tokenUsage,
        aiGatewaySuccess(
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
            tokenUsage,
          })
        ) as AiGatewayResult<AiOperationOutputMap[K]>
      );
    }

    if (!isValidationRepairEligible(primaryValidation) || !canAttemptRepair(0)) {
      return this.finalize(
        request,
        runId,
        startedAt,
        renderedPromptHash,
        schemaIdentity,
        tokenUsage,
        aiGatewayFailure(
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
            tokenUsage,
          })
        )
      );
    }

    if (!deadline.canFitProviderAttempt(providerTimeoutMs)) {
      return this.finalize(
        request,
        runId,
        startedAt,
        renderedPromptHash,
        schemaIdentity,
        tokenUsage,
        this.gatewayDeadlineFailure({
          operation,
          prompt: resolvedPrompt.identity,
          schema: schemaIdentity,
          repairCount: 0,
          attemptCount: primaryExecution.attemptCount,
          retryCount: totalRetryCount,
          providerCallCount: budget.providerCallCount,
          logicalModelRole: logicalRole,
          validationFailureReason: validationFailureReason(primaryValidation),
          tokenUsage,
        })
      );
    }

    const repairPrompt = this.deps.promptRegistry.resolveRepair({
      operation,
      schemaIdentity,
      validationIssues: primaryValidation.issues,
      invalidOutput: primaryExecution.response.rawText,
    });

    const repairModelConfig = this.deps.modelRegistry.resolve(REPAIR_MODEL_ROLE, operation);
    if (!isModelConfigurationResolved(repairModelConfig)) {
      return this.finalize(
        request,
        runId,
        startedAt,
        renderedPromptHash,
        schemaIdentity,
        tokenUsage,
        aiGatewayFailure(
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
            tokenUsage,
          })
        )
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
      tokenUsage.add(repairExecution.response);
    } catch (error) {
      return this.finalize(
        request,
        runId,
        startedAt,
        renderedPromptHash,
        schemaIdentity,
        tokenUsage,
        this.mapProviderFailure(error, {
          operation,
          prompt: resolvedPrompt.identity,
          schema: schemaIdentity,
          attemptCount: budget.providerCallCount,
          retryCount: totalRetryCount,
          repairCount: 1,
          providerCallCount: budget.providerCallCount,
          logicalModelRole: REPAIR_MODEL_ROLE,
          validationFailureReason: validationFailureReason(primaryValidation),
          tokenUsage,
        })
      );
    }

    const repairValidation = validateAiOutput({
      raw: repairExecution.response.rawText,
      schema: schemaDef.schema,
    });

    if (repairValidation.status === 'VALID') {
      return this.finalize(
        request,
        runId,
        startedAt,
        renderedPromptHash,
        schemaIdentity,
        tokenUsage,
        aiGatewaySuccess(
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
            tokenUsage,
          })
        ) as AiGatewayResult<AiOperationOutputMap[K]>
      );
    }

    return this.finalize(
      request,
      runId,
      startedAt,
      renderedPromptHash,
      schemaIdentity,
      tokenUsage,
      aiGatewayFailure(
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
          tokenUsage,
        })
      )
    );
  }

  private async executeComparative(
    request: AiGatewayRequest<unknown>,
    runId: string,
    startedAt: number,
    tokenUsage: TokenUsageTracker
  ): Promise<AiGatewayResult<AiOperationOutputMap['ANALYSIS_COMPARATIVE']>> {
    type ComparativeResult = AiGatewayResult<AiOperationOutputMap['ANALYSIS_COMPARATIVE']>;
    const operation = 'ANALYSIS_COMPARATIVE' as const;
    const schemaIdentity = resolveSchemaIdentity(operation);
    const logicalRole = DEFAULT_MODEL_ROLE_BY_OPERATION[operation];

    const finish = async (outcome: ComparativeResult): Promise<ComparativeResult> =>
      this.finalize(request, runId, startedAt, undefined, schemaIdentity, tokenUsage, outcome as never) as Promise<ComparativeResult>;

    const finishWithHash = async (
      renderedPromptHash: string,
      outcome: ComparativeResult
    ): Promise<ComparativeResult> =>
      this.finalize(
        request,
        runId,
        startedAt,
        renderedPromptHash,
        schemaIdentity,
        tokenUsage,
        outcome as never
      ) as Promise<ComparativeResult>;

    let plan;
    try {
      plan = this.deps.modelRegistry.resolveComparativePlan(operation);
    } catch (error) {
      const message =
        error instanceof ModelNotResolvedError ? error.message : 'Comparative model plan not resolved';
      return finish(
        aiGatewayFailure(
          createGatewayError({
            code: 'MODEL_NOT_RESOLVED',
            message,
            retryable: false,
          }),
          {
            operation,
            schema: schemaIdentity,
            validationStatus: 'REJECTED',
            repairCount: 0,
            logicalModelRole: logicalRole,
            executionMode: 'COMPARATIVE',
          }
        )
      );
    }

    const [openaiConfig, anthropicConfig] = plan.slices;
    if (!isModelConfigurationResolved(openaiConfig) || !isModelConfigurationResolved(anthropicConfig)) {
      return finish(
        aiGatewayFailure(
          createGatewayError({
            code: 'MODEL_NOT_RESOLVED',
            message: 'Comparative OpenAI or Anthropic model configuration is not resolved',
            retryable: false,
          }),
          {
            operation,
            schema: schemaIdentity,
            validationStatus: 'REJECTED',
            repairCount: 0,
            logicalModelRole: logicalRole,
            executionMode: 'COMPARATIVE',
          }
        )
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
      return finish(
        aiGatewayFailure(
          createGatewayError({
            code: 'OPERATION_NOT_SUPPORTED',
            message,
            retryable: false,
          }),
          {
            operation,
            schema: schemaIdentity,
            validationStatus: 'REJECTED',
            repairCount: 0,
            logicalModelRole: logicalRole,
            executionMode: 'COMPARATIVE',
          }
        )
      );
    }

    const renderedPromptHash = computeRenderedPromptHash(
      resolvedPrompt.systemMessage,
      resolvedPrompt.userMessage
    );
    const deadline = createGatewayExecutionDeadline(this.deps.nowFn, this.deps.maxGatewayExecutionMs);
    const providerTimeoutMs = this.deps.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;

    const sliceParamsBase = {
      operation,
      promptIdentity: resolvedPrompt.identity,
      schemaIdentity,
      systemMessage: resolvedPrompt.systemMessage,
      userMessage: resolvedPrompt.userMessage,
      providerPort: this.deps.providerPort,
      promptRegistry: this.deps.promptRegistry,
      deadline,
      providerTimeoutMs,
      retryBackoffMs: this.deps.retryBackoffMs ?? PROVIDER_RETRY_BACKOFF_MS,
      sleepFn: this.deps.sleepFn,
    };

    // Concurrent independent slices — Application owns orchestration (not adapters).
    const [openaiSlice, anthropicSlice] = await Promise.all([
      executeComparativeSlice({
        ...sliceParamsBase,
        label: 'openai',
        model: openaiConfig,
      }),
      executeComparativeSlice({
        ...sliceParamsBase,
        label: 'anthropic',
        model: anthropicConfig,
      }),
    ]);

    const tokens = sumComparativeTokenUsage([openaiSlice, anthropicSlice]);
    if (tokens.promptTokens != null) tokenUsage.promptTokens = tokens.promptTokens;
    if (tokens.completionTokens != null) tokenUsage.completionTokens = tokens.completionTokens;

    const totalProviderCalls =
      openaiSlice.audit.providerCallCount + anthropicSlice.audit.providerCallCount;
    const totalRetryCount = openaiSlice.audit.retryCount + anthropicSlice.audit.retryCount;
    const totalRepairCount = openaiSlice.audit.repairCount + anthropicSlice.audit.repairCount;
    const totalAttemptCount = openaiSlice.audit.attemptCount + anthropicSlice.audit.attemptCount;

    const aggregated = aggregateComparativeSlices({
      openai: openaiSlice,
      anthropic: anthropicSlice,
    });

    if (aggregated.ok) {
      return finishWithHash(
        renderedPromptHash,
        aiGatewaySuccess(markValidatedDomainOutput(aggregated.aggregate), {
          operation,
          prompt: resolvedPrompt.identity,
          schema: schemaIdentity,
          validationStatus: 'VALID',
          repairCount: totalRepairCount,
          attemptCount: totalAttemptCount,
          retryCount: totalRetryCount,
          providerCallCount: totalProviderCalls,
          logicalModelRole: logicalRole,
          executionMode: 'COMPARATIVE',
          providerExecutions: aggregated.providerExecutions,
          promptTokens: tokenUsage.promptTokens,
          completionTokens: tokenUsage.completionTokens,
        })
      );
    }

    const failureError =
      !openaiSlice.ok && !anthropicSlice.ok
        ? pickComparativeFailureError(openaiSlice, anthropicSlice)
        : aggregated.error;

    return finishWithHash(
      renderedPromptHash,
      aiGatewayFailure(failureError, {
        operation,
        prompt: resolvedPrompt.identity,
        schema: schemaIdentity,
        validationStatus: 'REJECTED',
        repairCount: totalRepairCount,
        attemptCount: totalAttemptCount,
        retryCount: totalRetryCount,
        providerCallCount: totalProviderCalls,
        logicalModelRole: logicalRole,
        executionMode: 'COMPARATIVE',
        providerExecutions: aggregated.providerExecutions,
        promptTokens: tokenUsage.promptTokens,
        completionTokens: tokenUsage.completionTokens,
      })
    );
  }

  private now(): number {
    return this.deps.nowFn?.() ?? Date.now();
  }

  private async finalize<K extends AiOperation>(
    request: AiGatewayRequest<unknown>,
    runId: string,
    startedAt: number,
    renderedPromptHash: string | undefined,
    schemaIdentity: SchemaIdentity | undefined,
    tokenUsage: TokenUsageTracker,
    outcome: AiGatewayResult<AiOperationOutputMap[K]>
  ): Promise<AiGatewayResult<AiOperationOutputMap[K]>> {
    const repository = this.deps.aiRunRepository;
    if (!repository) return outcome;

    const clientId = request.tenant.clientId?.trim();
    if (!clientId) {
      if (outcome.ok) {
        return aiGatewayFailure(
          createGatewayError({
            code: 'PERSISTENCE_ERROR',
            message: 'clientId is required for aiRun persistence',
            retryable: false,
          }),
          outcome.metadata
        );
      }
      return outcome;
    }

    const latencyMs = this.now() - startedAt;
    const metadata = outcome.ok
      ? { ...outcome.metadata, promptTokens: tokenUsage.promptTokens, completionTokens: tokenUsage.completionTokens, latencyMs }
      : {
          ...outcome.metadata,
          promptTokens: tokenUsage.promptTokens ?? outcome.metadata?.promptTokens,
          completionTokens: tokenUsage.completionTokens ?? outcome.metadata?.completionTokens,
          latencyMs,
        };

    const record = buildAiRunPersistenceRecord({
      id: runId,
      tenant: request.tenant,
      requestMetadata: request.metadata,
      operation: request.operation,
      executionStatus: outcome.ok ? 'SUCCESS' : 'FAILED',
      metadata,
      prompt: metadata.prompt ?? request.prompt,
      renderedPromptHash,
      schema: metadata.schema ?? schemaIdentity,
      error: outcome.ok ? undefined : outcome.error,
      latencyMs,
    });

    try {
      await repository.save(record);
    } catch {
      return aiGatewayFailure(
        createGatewayError({
          code: 'PERSISTENCE_ERROR',
          message: 'Failed to persist aiRun audit record',
          retryable: false,
        }),
        metadata
      );
    }

    return outcome;
  }

  private mapProviderFailure(
    error: unknown,
    partial: {
      operation: AiOperation;
      prompt: PromptIdentity;
      schema: SchemaIdentity;
      validationStatus?: AiExecutionMetadata['validationStatus'];
      repairCount: number;
      attemptCount: number;
      retryCount: number;
      providerCallCount: number;
      logicalModelRole?: string;
      validationFailureReason?: AiExecutionMetadata['validationFailureReason'];
      tokenUsage: TokenUsageTracker;
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
    prompt: PromptIdentity;
    schema: SchemaIdentity;
    repairCount: number;
    attemptCount: number;
    retryCount: number;
    providerCallCount: number;
    logicalModelRole?: string;
    validationFailureReason?: AiExecutionMetadata['validationFailureReason'];
    tokenUsage: TokenUsageTracker;
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
    prompt: PromptIdentity;
    schema: SchemaIdentity;
    validationStatus: AiExecutionMetadata['validationStatus'];
    repairCount: number;
    attemptCount: number;
    retryCount: number;
    providerCallCount: number;
    response?: AiProviderCompletionResponse;
    logicalModelRole?: string;
    validationFailureReason?: AiExecutionMetadata['validationFailureReason'];
    tokenUsage?: TokenUsageTracker;
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
      promptTokens: params.tokenUsage?.promptTokens ?? params.response?.promptTokens,
      completionTokens: params.tokenUsage?.completionTokens ?? params.response?.completionTokens,
    };
  }
}
