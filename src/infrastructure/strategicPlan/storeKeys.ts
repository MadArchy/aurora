/**
 * SPEC-004 Phase 3 — versioned local-authoritative physical store names.
 * Plan current / items (aggregate) / history / idempotency stay OUT of
 * dbService.saveAll / Firestore exportSnapshot.
 * Remote Firestore Plan persistence is FUTURE / SPEC-009.
 */

export const STRATEGIC_PLAN_CURRENT_STORE_KEY = 'postura_strategic_plan_v1';
export const STRATEGIC_PLAN_HISTORY_STORE_KEY = 'postura_strategic_plan_history_v1';
export const STRATEGIC_PLAN_IDEMPOTENCY_STORE_KEY = 'postura_strategic_plan_idempotency_v1';

export const PLAN_CURRENT_STORE_SCHEMA = 'plan-store-v1' as const;
export const PLAN_HISTORY_STORE_SCHEMA = 'plan-history-store-v1' as const;
export const PLAN_IDEMPOTENCY_STORE_SCHEMA = 'plan-idempotency-store-v1' as const;

export type PlanCurrentStoreSchema = typeof PLAN_CURRENT_STORE_SCHEMA;
export type PlanHistoryStoreSchema = typeof PLAN_HISTORY_STORE_SCHEMA;
export type PlanIdempotencyStoreSchema = typeof PLAN_IDEMPOTENCY_STORE_SCHEMA;
