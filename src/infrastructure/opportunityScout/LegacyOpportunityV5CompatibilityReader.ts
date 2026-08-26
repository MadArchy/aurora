/**
 * SPEC-007 Phase 3 — Legacy postura_opportunities_v5 COMPATIBILITY reader.
 * Does NOT become canonical authority. Ambiguous lifecycle → MIGRATION_REVIEW_REQUIRED.
 * Does not modify db.ts / consumer wiring.
 */

import {
  mapLegacyToCanonicalOpportunityStatus,
  type LegacyLifecycleStage,
  type LegacyOpportunityStatus,
} from '../../domain/opportunityLegacyMappingCore';
import type { CanonicalOpportunityStatus } from '../../domain/opportunityLifecycleCore';
import type { StorageLike } from './LocalOpportunityScoutStore';
import { LEGACY_OPPORTUNITIES_V5_KEY } from './storeKeys';

export type LegacyMigrationDisposition =
  | 'MAPPED'
  | 'MIGRATION_REVIEW_REQUIRED'
  | 'SKIPPED_MALFORMED';

export interface LegacyOpportunityV5CompatibilityRecord {
  legacyId: string;
  organizationId?: string;
  clientId?: string;
  thesisId?: string;
  disposition: LegacyMigrationDisposition;
  canonicalStatus?: CanonicalOpportunityStatus;
  reason?: string;
  /** Never treated as MaterializedOpportunity authority. */
  authority: 'COMPATIBILITY_ONLY';
}

/**
 * Read-only compatibility projection of legacy v5 opportunities.
 * Callers must not persist these as SPEC-007 authoritative rows without Phase 4 review.
 */
export class LegacyOpportunityV5CompatibilityReader {
  constructor(private readonly kv: StorageLike) {}

  listCompatibilityRecords(): LegacyOpportunityV5CompatibilityRecord[] {
    const raw = this.kv.getItem(LEGACY_OPPORTUNITIES_V5_KEY);
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [
        {
          legacyId: '*',
          disposition: 'SKIPPED_MALFORMED',
          reason: 'legacy store JSON malformed',
          authority: 'COMPATIBILITY_ONLY',
        },
      ];
    }
    if (!Array.isArray(parsed)) {
      return [
        {
          legacyId: '*',
          disposition: 'SKIPPED_MALFORMED',
          reason: 'legacy store is not an array',
          authority: 'COMPATIBILITY_ONLY',
        },
      ];
    }

    const results: LegacyOpportunityV5CompatibilityRecord[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        results.push({
          legacyId: 'unknown',
          disposition: 'SKIPPED_MALFORMED',
          reason: 'non-object legacy row',
          authority: 'COMPATIBILITY_ONLY',
        });
        continue;
      }
      const row = item as Record<string, unknown>;
      const legacyId = typeof row.id === 'string' ? row.id : 'unknown';
      const status = row.status;
      const lifecycleStage = row.lifecycleStage;
      if (typeof status !== 'string') {
        results.push({
          legacyId,
          organizationId:
            typeof row.organizationId === 'string' ? row.organizationId : undefined,
          clientId: typeof row.clientId === 'string' ? row.clientId : undefined,
          disposition: 'SKIPPED_MALFORMED',
          reason: 'missing legacy status',
          authority: 'COMPATIBILITY_ONLY',
        });
        continue;
      }

      const mapped = mapLegacyToCanonicalOpportunityStatus({
        status: status as LegacyOpportunityStatus,
        lifecycleStage:
          typeof lifecycleStage === 'string'
            ? (lifecycleStage as LegacyLifecycleStage)
            : null,
      });

      if (!mapped.ok) {
        results.push({
          legacyId,
          organizationId:
            typeof row.organizationId === 'string' ? row.organizationId : undefined,
          clientId: typeof row.clientId === 'string' ? row.clientId : undefined,
          thesisId: typeof row.thesisId === 'string' ? row.thesisId : undefined,
          disposition: 'MIGRATION_REVIEW_REQUIRED',
          reason: mapped.error.message,
          authority: 'COMPATIBILITY_ONLY',
        });
        continue;
      }

      results.push({
        legacyId,
        organizationId:
          typeof row.organizationId === 'string' ? row.organizationId : undefined,
        clientId: typeof row.clientId === 'string' ? row.clientId : undefined,
        thesisId: typeof row.thesisId === 'string' ? row.thesisId : undefined,
        disposition: 'MAPPED',
        canonicalStatus: mapped.value,
        authority: 'COMPATIBILITY_ONLY',
      });
    }
    return results;
  }
}

export function createLegacyOpportunityV5CompatibilityReader(
  kv: StorageLike
): LegacyOpportunityV5CompatibilityReader {
  return new LegacyOpportunityV5CompatibilityReader(kv);
}
