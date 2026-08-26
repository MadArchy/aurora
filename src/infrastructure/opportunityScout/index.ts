/**
 * SPEC-007 Phase 3 — Infrastructure public surface.
 */

export {
  OPPORTUNITY_CANDIDATE_STORE_KEY,
  OPPORTUNITY_CURRENT_STORE_KEY,
  OPPORTUNITY_HISTORY_STORE_KEY,
  OPPORTUNITY_IDEMPOTENCY_STORE_KEY,
  LEGACY_OPPORTUNITIES_V5_KEY,
  CANDIDATE_STORE_SCHEMA,
  OPPORTUNITY_STORE_SCHEMA,
  OPPORTUNITY_HISTORY_STORE_SCHEMA,
  OPPORTUNITY_IDEMPOTENCY_STORE_SCHEMA,
} from './storeKeys';
export { persistenceError, rethrowGoverned } from './persistenceErrors';
export {
  tenantEntityKey,
  idempotencyLookupKey,
  parseStoredCandidate,
  parseStoredOpportunity,
  parseStoredOpportunityScore,
  parseStoredHistory,
  cloneJson,
} from './serialization';
export {
  LocalOpportunityScoutStore,
  createLocalOpportunityScoutStore,
  type StorageLike,
} from './LocalOpportunityScoutStore';
export { LocalOpportunityCandidateRepository } from './LocalOpportunityCandidateRepository';
export { LocalOpportunityRepository } from './LocalOpportunityRepository';
export { LocalOpportunityHistoryAdapter } from './LocalOpportunityHistoryAdapter';
export {
  LegacyOpportunityV5CompatibilityReader,
  createLegacyOpportunityV5CompatibilityReader,
  type LegacyOpportunityV5CompatibilityRecord,
  type LegacyMigrationDisposition,
} from './LegacyOpportunityV5CompatibilityReader';
