import { z } from 'zod';
import { isClientScopedOperation, type AiOperation } from '../../../domain/ai/operations';
import type { AiTenantContext, UntrustedTenantPayload } from '../../../domain/ai/tenantContext';
import type { AiGatewayErrorCode } from '../../../domain/ai/errors';

export const AiTenantContextSchema = z
  .object({
    organizationId: z.string().min(1),
    clientId: z.string().min(1).nullable().optional(),
    userId: z.string().min(1).optional(),
    role: z.enum(['ADMIN', 'CLIENT']).optional(),
  })
  .strict();

export function validateTenantContextForOperation(
  tenant: UntrustedTenantPayload,
  operation: AiOperation
): { ok: true; context: AiTenantContext } | { ok: false; code: AiGatewayErrorCode; message: string } {
  const org = tenant.organizationId?.trim();
  if (!org) {
    return { ok: false, code: 'AUTH_CONTEXT_INVALID', message: 'organizationId is required' };
  }

  if (isClientScopedOperation(operation)) {
    const clientId = tenant.clientId?.trim();
    if (!clientId) {
      return {
        ok: false,
        code: 'AUTH_CONTEXT_INVALID',
        message: `clientId is required for operation ${operation}`,
      };
    }
  }

  const parsed = AiTenantContextSchema.safeParse({
    ...tenant,
    organizationId: org,
    clientId: tenant.clientId?.trim() ?? tenant.clientId,
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: 'AUTH_CONTEXT_INVALID',
      message: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }

  return { ok: true, context: parsed.data };
}
