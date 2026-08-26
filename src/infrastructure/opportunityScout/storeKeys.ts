/**
 * SPEC-007 Phase 3 — versioned local-authoritative physical store names.
 * Separate from legacy postura_opportunities_v5 and dbService.
 * Remote Firestore Opportunity persistence is FUTURE / SPEC-009.
 */

export const OPPORTUNITY_CANDIDATE_STORE_KEY = 'postura_opportunity_candidate_v1';
export const OPPORTUNITY_CURRENT_STORE_KEY = 'postura_opportunity_v1';
export const OPPORTUNITY_HISTORY_STORE_KEY = 'postura_opportunity_history_v1';
export const OPPORTUNITY_IDEMPOTENCY_STORE_KEY = 'postura_opportunity_idempotency_v1';

/** Legacy key — COMPATIBILITY reader only; never canonical authority. */
export const LEGACY_OPPORTUNITIES_V5_KEY = 'postura_opportunities_v5';

export const CANDIDATE_STORE_SCHEMA = 'opportunity-candidate-store-v1' as const;
export const OPPORTUNITY_STORE_SCHEMA = 'opportunity-store-v1' as const;
export const OPPORTUNITY_HISTORY_STORE_SCHEMA = 'opportunity-history-store-v1' as const;
export const OPPORTUNITY_IDEMPOTENCY_STORE_SCHEMA =
  'opportunity-idempotency-store-v1' as const;
