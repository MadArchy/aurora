/**
 * aiComplete Cloud Function authorization policy (Phase 2).
 *
 * Enforced at: functions/src/index.ts → requirePosturaAuth({ adminOnly: true })
 *
 * CLIENT tenant resolution exists in resolveTrustedTenantForAiComplete for reuse
 * by future inbound adapters, but CLIENT cannot reach aiComplete today.
 */
export const AICOMPLETE_AUTH_POLICY = 'AICOMPLETE_ADMIN_ONLY' as const;

export type AiCompleteAuthPolicy = typeof AICOMPLETE_AUTH_POLICY;
