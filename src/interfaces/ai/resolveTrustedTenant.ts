import { isClientScopedOperation, type AiOperation } from '../../domain/ai/operations';
import { markTenantValidated, type ValidatedAiTenantContext } from '../../domain/ai/tenantContext';
import { createGatewayError } from '../../domain/ai/errors';

export interface AuthDerivedTenantInput {
  role: 'ADMIN' | 'CLIENT';
  organizationId: string;
  clientId: string | null;
  userId?: string;
}

export interface AiCompleteTenantRequest {
  operation: AiOperation;
  bodyClientId?: string;
}

export type TrustedTenantResult =
  | { ok: true; tenant: ValidatedAiTenantContext }
  | { ok: false; code: 'AUTH_CONTEXT_INVALID'; message: string };

/** Derives trusted tenant context from auth claims — never trusts body org/client alone. */
export function resolveTrustedTenantForAiComplete(
  auth: AuthDerivedTenantInput,
  request: AiCompleteTenantRequest
): TrustedTenantResult {
  const organizationId = auth.organizationId.trim();
  if (!organizationId) {
    return { ok: false, code: 'AUTH_CONTEXT_INVALID', message: 'organizationId is required from auth claims' };
  }

  if (auth.role === 'CLIENT') {
    const claimClientId = auth.clientId?.trim();
    if (!claimClientId) {
      return { ok: false, code: 'AUTH_CONTEXT_INVALID', message: 'clientId is required for CLIENT role' };
    }
    if (request.bodyClientId && request.bodyClientId.trim() !== claimClientId) {
      return {
        ok: false,
        code: 'AUTH_CONTEXT_INVALID',
        message: 'clientId in request does not match authenticated client',
      };
    }
    return {
      ok: true,
      tenant: markTenantValidated({
        organizationId,
        clientId: claimClientId,
        userId: auth.userId,
        role: 'CLIENT',
      }),
    };
  }

  if (isClientScopedOperation(request.operation)) {
    const scopedClientId = request.bodyClientId?.trim();
    if (!scopedClientId) {
      return {
        ok: false,
        code: 'AUTH_CONTEXT_INVALID',
        message: `clientId is required for operation ${request.operation}`,
      };
    }
    return {
      ok: true,
      tenant: markTenantValidated({
        organizationId,
        clientId: scopedClientId,
        userId: auth.userId,
        role: 'ADMIN',
      }),
    };
  }

  return {
    ok: true,
    tenant: markTenantValidated({
      organizationId,
      clientId: auth.clientId,
      userId: auth.userId,
      role: 'ADMIN',
    }),
  };
}

export function trustedTenantFailureToGatewayError(result: Extract<TrustedTenantResult, { ok: false }>) {
  return createGatewayError({
    code: result.code,
    message: result.message,
    retryable: false,
  });
}
