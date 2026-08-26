/**
 * SPEC-007 Phase 1 — Legacy dual-status → canonical mapping helper (pure).
 * Ambiguous mappings fail closed. Does not mutate legacy models.
 */

import type { CanonicalOpportunityStatus } from './opportunityLifecycleCore';
import { oppFail, oppOk, type OpportunityDomainResult } from './opportunityScoutErrors';

/** Legacy OpportunityStatus values (read-only mapping inputs). */
export type LegacyOpportunityStatus =
  | 'DETECTED'
  | 'UNDER_REVIEW'
  | 'RECOMMENDED'
  | 'SENT_TO_CLIENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ARCHIVED';

export type LegacyLifecycleStage =
  | 'proposed'
  | 'accepted'
  | 'declined'
  | 'checklist'
  | 'submitted';

export interface LegacyOpportunityStatusPair {
  status: LegacyOpportunityStatus;
  lifecycleStage?: LegacyLifecycleStage | null;
}

/**
 * Map legacy dual status to canonical (opportunity-model.md).
 * Ambiguous COMPLETED paths MUST NOT be silently coerced.
 */
export function mapLegacyToCanonicalOpportunityStatus(
  pair: LegacyOpportunityStatusPair
): OpportunityDomainResult<CanonicalOpportunityStatus> {
  const { status, lifecycleStage } = pair;

  if (status === 'ACCEPTED' && lifecycleStage === 'declined') {
    return oppFail(
      'LEGACY_MAPPING_AMBIGUOUS',
      'ACCEPTED + declined lifecycleStage is ambiguous'
    );
  }
  if (status === 'COMPLETED' && lifecycleStage === 'checklist') {
    return oppFail(
      'LEGACY_MAPPING_AMBIGUOUS',
      'COMPLETED + checklist requires explicit migration review'
    );
  }
  if (status === 'COMPLETED' && lifecycleStage === 'submitted') {
    return oppFail(
      'LEGACY_MAPPING_AMBIGUOUS',
      'COMPLETED + submitted is ambiguous (SUBMITTED vs COMPLETED) — require human review'
    );
  }
  if (status === 'COMPLETED' && (!lifecycleStage || lifecycleStage === 'proposed')) {
    return oppFail(
      'LEGACY_MAPPING_AMBIGUOUS',
      'COMPLETED without unambiguous lifecycleStage requires human review'
    );
  }

  if (status === 'ARCHIVED') return oppOk('ARCHIVED');
  if (status === 'REJECTED' || lifecycleStage === 'declined') return oppOk('DECLINED');

  if (status === 'IN_PROGRESS') return oppOk('CHECKLIST');
  if (status === 'ACCEPTED' && lifecycleStage === 'checklist') return oppOk('CHECKLIST');
  if (lifecycleStage === 'checklist' && status === 'ACCEPTED') return oppOk('CHECKLIST');

  if (lifecycleStage === 'submitted') return oppOk('SUBMITTED');

  if (status === 'ACCEPTED' && (!lifecycleStage || lifecycleStage === 'accepted')) {
    return oppOk('ACCEPTED');
  }

  if (
    status === 'SENT_TO_CLIENT' ||
    status === 'RECOMMENDED' ||
    status === 'DETECTED' ||
    status === 'UNDER_REVIEW'
  ) {
    return oppOk('PROPOSED');
  }

  if (lifecycleStage === 'proposed') return oppOk('PROPOSED');
  if (lifecycleStage === 'accepted' && status === 'ACCEPTED') return oppOk('ACCEPTED');

  return oppFail(
    'LEGACY_MAPPING_AMBIGUOUS',
    `cannot map legacy status=${status} lifecycleStage=${String(lifecycleStage)}`
  );
}
