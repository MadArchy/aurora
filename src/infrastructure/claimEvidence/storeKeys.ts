/**
 * SPEC-006 Phase 3 — versioned local-authoritative physical store names.
 * Claim current / link / verification / evidence / history / override stay OUT of
 * dbService.saveAll / Firestore exportSnapshot.
 * Remote Firestore Claim persistence is FUTURE / SPEC-009.
 */

export const CLAIM_CURRENT_STORE_KEY = 'postura_claim_v1';
export const CLAIM_LINK_STORE_KEY = 'postura_claim_link_v1';
export const CLAIM_VERIFICATION_STORE_KEY = 'postura_claim_verification_v1';
export const CLAIM_EVIDENCE_STORE_KEY = 'postura_claim_evidence_v1';
export const CLAIM_HISTORY_STORE_KEY = 'postura_claim_history_v1';
export const CLAIM_OVERRIDE_STORE_KEY = 'postura_claim_override_v1';

export const CLAIM_CURRENT_STORE_SCHEMA = 'claim-store-v1' as const;
export const CLAIM_LINK_STORE_SCHEMA = 'claim-link-store-v1' as const;
export const CLAIM_VERIFICATION_STORE_SCHEMA = 'claim-verification-store-v1' as const;
export const CLAIM_EVIDENCE_STORE_SCHEMA = 'claim-evidence-store-v1' as const;
export const CLAIM_HISTORY_STORE_SCHEMA = 'claim-history-store-v1' as const;
export const CLAIM_OVERRIDE_STORE_SCHEMA = 'claim-override-store-v1' as const;

export type ClaimCurrentStoreSchema = typeof CLAIM_CURRENT_STORE_SCHEMA;
export type ClaimLinkStoreSchema = typeof CLAIM_LINK_STORE_SCHEMA;
export type ClaimVerificationStoreSchema = typeof CLAIM_VERIFICATION_STORE_SCHEMA;
export type ClaimEvidenceStoreSchema = typeof CLAIM_EVIDENCE_STORE_SCHEMA;
export type ClaimHistoryStoreSchema = typeof CLAIM_HISTORY_STORE_SCHEMA;
export type ClaimOverrideStoreSchema = typeof CLAIM_OVERRIDE_STORE_SCHEMA;
