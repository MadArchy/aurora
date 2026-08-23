import type { AiGatewayPort } from '../../application/ai/ports/inbound/AiGatewayPort';
import type { AiGatewayRequest } from '../../application/ai/contracts/request';
import { isOperationSupported } from '../../application/ai/schemas/outputRegistry';
import { createGatewayError } from '../../domain/ai/errors';
import {
  resolveTrustedTenantForAiComplete,
  trustedTenantFailureToGatewayError,
  type AuthDerivedTenantInput,
} from './resolveTrustedTenant';
import type { AiCompleteHttpResponse, AiCompleteRequestBody } from './aiCompleteTypes';

export async function handleAiCompleteRequest(params: {
  gateway: AiGatewayPort;
  auth: AuthDerivedTenantInput;
  body: AiCompleteRequestBody;
}): Promise<AiCompleteHttpResponse> {
  const { body } = params;

  if (!isOperationSupported(body.operation)) {
    return {
      ok: false,
      error: createGatewayError({
        code: 'OPERATION_NOT_SUPPORTED',
        message: `Unsupported operation: ${body.operation}`,
        retryable: false,
      }),
    };
  }

  const tenantResult = resolveTrustedTenantForAiComplete(params.auth, {
    operation: body.operation,
    bodyClientId: body.clientId,
  });
  if (!tenantResult.ok) {
    return { ok: false, error: trustedTenantFailureToGatewayError(tenantResult) };
  }

  const request: AiGatewayRequest = {
    operation: body.operation,
    tenant: tenantResult.tenant,
    input: body.input,
    prompt: body.prompt,
  };

  const result = await params.gateway.execute(request);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    data: result.data,
    metadata: result.metadata,
  };
}

export function mapAiCompleteErrorStatus(code: string): number {
  switch (code) {
    case 'AUTH_CONTEXT_INVALID':
    case 'OPERATION_NOT_SUPPORTED':
      return 400;
    case 'RATE_LIMITED':
      return 429;
    case 'TIMEOUT':
      return 504;
    case 'PROVIDER_UNAVAILABLE':
    case 'MODEL_NOT_RESOLVED':
      return 503;
    default:
      return 502;
  }
}
