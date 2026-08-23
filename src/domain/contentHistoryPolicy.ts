/**
 * SPEC-009 F-009-A — Trusted content history policy (MODEL B).
 *
 * Inventory (production):
 * - Written locally in db.transitionContentPipeline / migrateContentPipelineFields
 * - Seeded in juanCampaignSeed
 * - Stripped on CLIENT Firestore persist (sync.prepareDocForWrite)
 * - Rules: CLIENT cannot mutate stateHistory (not on allowlist)
 * - No UI reads stateHistory; workflows use pipelineStatus
 *
 * Freeze:
 * - pipelineStatus = canonical current workflow state
 * - updatedAt     = canonical trusted workflow clock (serverTimestamp on CLIENT writes)
 * - stateHistory  = non-authoritative; not persisted for CLIENT; optional local/admin memory only
 *
 * Future: append-only server-managed transition records if product audit requires them.
 */
export const CONTENT_CANONICAL_WORKFLOW_FIELD = 'pipelineStatus' as const;
export const CONTENT_TRUSTED_AUDIT_CLOCK = 'updatedAt' as const;

/** CLIENT / untrusted writers must not treat stateHistory as authoritative. */
export const CLIENT_STATE_HISTORY_AUTHORITATIVE = false;

/** Remove stateHistory before CLIENT Firestore writes (Rules also deny mutating it). */
export function stripNonAuthoritativeContentHistory<T extends Record<string, unknown>>(
  doc: T
): Omit<T, 'stateHistory'> {
  const copy = { ...doc };
  delete copy.stateHistory;
  return copy;
}
