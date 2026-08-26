/**
 * SPEC-008 Phase 3 — versioned local-authoritative physical store names.
 * Separate from legacy postura_signal_outcomes_v1 / postura_results_v5 / postura_feedback_v1.
 * Remote Firestore learning persistence is FUTURE / SPEC-009.
 */

export const LEARNING_OBSERVATION_STORE_KEY = 'postura_learning_observations_v1';
export const LEARNING_EVIDENCE_STORE_KEY = 'postura_learning_evidence_v1';
export const LEARNING_RECOMMENDATION_STORE_KEY = 'postura_learning_recommendations_v1';
export const LEARNING_HISTORY_STORE_KEY = 'postura_learning_history_v1';
export const LEARNING_DECISION_STORE_KEY = 'postura_learning_decisions_v1';
export const LEARNING_IDEMPOTENCY_STORE_KEY = 'postura_learning_idempotency_v1';

/** Legacy keys — COMPATIBILITY readers only; never canonical authority. */
export const LEGACY_SIGNAL_OUTCOMES_KEY = 'postura_signal_outcomes_v1';
export const LEGACY_RESULTS_V5_KEY = 'postura_results_v5';
export const LEGACY_FEEDBACK_V1_KEY = 'postura_feedback_v1';

export const LEARNING_OBSERVATION_STORE_SCHEMA = 'learning-observation-store-v1' as const;
export const LEARNING_EVIDENCE_STORE_SCHEMA = 'learning-evidence-store-v1' as const;
export const LEARNING_RECOMMENDATION_STORE_SCHEMA =
  'learning-recommendation-store-v1' as const;
export const LEARNING_HISTORY_STORE_SCHEMA = 'learning-history-store-v1' as const;
export const LEARNING_DECISION_STORE_SCHEMA = 'learning-decision-store-v1' as const;
export const LEARNING_IDEMPOTENCY_STORE_SCHEMA = 'learning-idempotency-store-v1' as const;
