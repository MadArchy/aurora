import type { AiGatewayPort } from '../ports/inbound/AiGatewayPort';
import type { AiGatewayRequest } from '../contracts/request';
import type { AiGatewayResult, AiExecutionMetadata } from '../contracts/result';
import { aiGatewayFailure, aiGatewaySuccess, markValidatedDomainOutput } from '../contracts/result';
import type { AiOperationOutputMap } from '../schemas/outputRegistry';
import { resolveOperationSchema, resolveSchemaIdentity, isOperationSupported } from '../schemas/outputRegistry';
import { DEFAULT_MODEL_ROLE_BY_OPERATION } from '../../../domain/ai/modelRole';
import { createGatewayError } from '../../../domain/ai/errors';
import type { AiProviderPort } from '../ports/outbound/AiProviderPort';
import type { ModelRegistryPort } from '../ports/outbound/ModelRegistryPort';
import type { PromptRegistryPort } from '../ports/outbound/PromptRegistryPort';
import { runValidationPipeline } from '../validation/validationPipeline';
import { ProviderPortError, PromptResolutionError } from '../errors/providerPortErrors';
import { isModelConfigurationResolved } from '../validation/modelConfiguration';
import type { AiOperation } from '../../../domain/ai/operations';

export interface ExecuteAiOperationDeps {
  providerPort: AiProviderPort;
  modelRegistry: ModelRegistryPort;
  promptRegistry: PromptRegistryPort;
}

/** Application orchestration — resolves ports, validates untrusted provider output. */
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

    const baseMetadata: Partial<AiExecutionMetadata> = {
      operation,
      prompt: resolvedPrompt.identity,
      schema: schemaIdentity,
    };

    let providerResponse;
    try {
      providerResponse = await this.deps.providerPort.complete({
        operation,
        logicalModelRole: logicalRole,
        model: modelConfig,
        structuredJsonRequired: true,
        messages: [
          { role: 'system', content: resolvedPrompt.systemMessage },
          { role: 'user', content: resolvedPrompt.userMessage },
        ],
      });
    } catch (error) {
      if (error instanceof ProviderPortError) {
        return aiGatewayFailure(
          createGatewayError({
            code: error.code,
            message: error.message,
            retryable: error.retryable,
            details: error.httpStatus ? { httpStatus: error.httpStatus } : undefined,
          }),
          {
            ...baseMetadata,
            latencyMs: undefined,
            promptTokens: undefined,
            completionTokens: undefined,
          }
        );
      }
      return aiGatewayFailure(
        createGatewayError({
          code: 'PROVIDER_ERROR',
          message: error instanceof Error ? error.message : 'Provider call failed',
          retryable: false,
        }),
        baseMetadata
      );
    }

    const validation = runValidationPipeline({
      raw: providerResponse.rawText,
      schema: schemaDef.schema,
    });

    const metadata: AiExecutionMetadata = {
      operation,
      prompt: resolvedPrompt.identity,
      schema: schemaIdentity,
      validationStatus: validation.status,
      repairCount: validation.repairCount,
      latencyMs: providerResponse.latencyMs,
      promptTokens: providerResponse.promptTokens,
      completionTokens: providerResponse.completionTokens,
    };

    if (validation.status === 'VALID' && validation.result?.status === 'VALID') {
      return aiGatewaySuccess(
        markValidatedDomainOutput(validation.result.data),
        metadata
      ) as AiGatewayResult<AiOperationOutputMap[K]>;
    }

    if (validation.status === 'REPAIR_REQUIRED') {
      return aiGatewayFailure(
        createGatewayError({
          code: 'INVALID_OUTPUT',
          message: 'Output requires repair — repair orchestration deferred to Phase 3',
          retryable: false,
        }),
        metadata
      );
    }

    return aiGatewayFailure(
      createGatewayError({
        code: 'INVALID_OUTPUT',
        message: validation.result?.status === 'REJECTED' ? validation.result.reason : 'Schema validation failed',
        retryable: false,
      }),
      metadata
    );
  }
}
