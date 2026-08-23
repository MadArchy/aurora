/** Authenticated / validated tenant execution context (domain identity). */
export interface AiTenantContext {
  organizationId: string;
  clientId?: string | null;
  userId?: string;
  role?: 'ADMIN' | 'CLIENT';
}

export type ValidatedAiTenantContext = AiTenantContext & {
  readonly __tenantValidated: unique symbol;
};

export type UntrustedTenantPayload = AiTenantContext;

export function markTenantValidated(context: AiTenantContext): ValidatedAiTenantContext {
  return context as ValidatedAiTenantContext;
}
