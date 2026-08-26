/**
 * SPEC-008 Phase 3 — Infrastructure public surface.
 */

export {
  LEARNING_OBSERVATION_STORE_KEY,
  LEARNING_EVIDENCE_STORE_KEY,
  LEARNING_RECOMMENDATION_STORE_KEY,
  LEARNING_HISTORY_STORE_KEY,
  LEARNING_DECISION_STORE_KEY,
  LEARNING_IDEMPOTENCY_STORE_KEY,
  LEGACY_SIGNAL_OUTCOMES_KEY,
  LEGACY_RESULTS_V5_KEY,
  LEGACY_FEEDBACK_V1_KEY,
  LEARNING_OBSERVATION_STORE_SCHEMA,
  LEARNING_EVIDENCE_STORE_SCHEMA,
  LEARNING_RECOMMENDATION_STORE_SCHEMA,
  LEARNING_HISTORY_STORE_SCHEMA,
  LEARNING_DECISION_STORE_SCHEMA,
  LEARNING_IDEMPOTENCY_STORE_SCHEMA,
} from './storeKeys';
export { persistenceError, rethrowGoverned } from './persistenceErrors';
export {
  tenantEntityKey,
  idempotencyLookupKey,
  parseStoredObservation,
  parseStoredEvidence,
  parseStoredRecommendation,
  parseStoredHistory,
  parseStoredDecision,
  parseStoredIdempotency,
  cloneJson,
} from './serialization';
export {
  LocalLearningLoopStore,
  createLocalLearningLoopStore,
  type StorageLike,
} from './LocalLearningLoopStore';
export { LocalLearningObservationRepository } from './LocalLearningObservationRepository';
export { LocalLearningEvidenceRepository } from './LocalLearningEvidenceRepository';
export { LocalStrategicRecommendationRepository } from './LocalStrategicRecommendationRepository';
export { LocalLearningHistoryAdapter } from './LocalLearningHistoryAdapter';
export { LocalRecommendationDecisionAdapter } from './LocalRecommendationDecisionAdapter';
export {
  LegacyLearningCompatibilityReader,
  createLegacyLearningCompatibilityReader,
  type LegacyLearningCompatibilityRecord,
  type LegacyLearningMigrationDisposition,
} from './LegacyLearningCompatibilityReader';
export { LocalOpportunityOutcomeReader } from './LocalOpportunityOutcomeReader';
