/**
 * SPEC-006 Phase 4 — advisory ClaimSafety projection helpers.
 * Compatibility display only — never publication / Verification authority.
 */

import type { ClaimSafetyReview } from '../../domain/claimSafetyCore';
import type { ClaimSafetyVerdictRecord } from '../../types';
import { simpleContentHash } from '../../lib/simpleContentHash';

/**
 * Maps legacy `reviewClaims` output to ContentItem.claimSafety COMPATIBILITY_ONLY shape.
 * Does not create Verification. Does not authorize publication.
 */
export function projectAdvisoryClaimSafety(
  review: ClaimSafetyReview,
  body: string,
  reviewedAt: string
): ClaimSafetyVerdictRecord {
  return {
    verdict: review.verdict,
    summary: review.summary,
    reviewedAt,
    contentHash: simpleContentHash(body),
    findings: review.findings.map((finding) => ({
      kind: finding.kind,
      severity: finding.severity,
      claim: finding.claim,
      detail: finding.detail,
      action: finding.action,
      supportingEvidenceIds: finding.supportingEvidenceIds,
    })),
  };
}
