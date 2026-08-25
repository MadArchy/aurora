/**
 * SPEC-006 Phase 1 — Publication eligibility predicates (pure Domain gate).
 * Does not save/publish/UI/database — returns structured decision only.
 */

import {
  type Claim,
  type ClaimStatus,
  isPublicationAllowedClaimStatus,
} from './claimCore';
import { claimOk, type ClaimDomainResult } from './claimEvidenceErrors';

/** Content statuses that expose content to client/public (legacy CLAIM_GATED_STATUSES). */
export const CLAIM_GATED_CONTENT_STATUSES = [
  'CLIENT_REVIEW',
  'READY',
  'PUBLISHED',
] as const;
export type ClaimGatedContentStatus = (typeof CLAIM_GATED_CONTENT_STATUSES)[number];

/** Constitution §17 / claim-model gate outcomes. */
export const CLAIM_PUBLICATION_GATE_RESULTS = [
  'PASS',
  'REVIEW_REQUIRED',
  'BLOCK',
] as const;
export type ClaimPublicationGateResult =
  (typeof CLAIM_PUBLICATION_GATE_RESULTS)[number];

export type ClaimPublicationReasonCode =
  | 'NO_CLAIMS'
  | 'ALL_CLAIMS_CLEAR'
  | 'EVIDENCE_REQUIRED'
  | 'RESEARCH_REQUIRED'
  | 'HARD_BLOCKED'
  | 'UNSUPPORTED'
  | 'UNDER_REVIEW'
  | 'NOT_VERIFIED'
  | 'TARGET_NOT_GATED';

export interface ClaimPublicationDecision {
  result: ClaimPublicationGateResult;
  allowed: boolean;
  reasonCode: ClaimPublicationReasonCode;
  summary: string;
  blockingClaimIds: string[];
  reviewClaimIds: string[];
  /** Per-claim status snapshot for explainability. */
  claimStatuses: Array<{ claimId: string; status: ClaimStatus; text: string }>;
}

export interface EvaluateClaimPublicationInput {
  claims: readonly Claim[];
  targetContentStatus: string;
}

function isGatedTarget(status: string): status is ClaimGatedContentStatus {
  return (CLAIM_GATED_CONTENT_STATUSES as readonly string[]).includes(status);
}

function claimsOfStatus(
  claims: readonly Claim[],
  status: ClaimStatus
): Claim[] {
  return claims.filter((c) => c.status === status);
}

/**
 * Multi-claim aggregation: one unsafe claim fails closed.
 * No first-claim [0]. No majority vote.
 */
export function evaluateClaimPublicationEligibility(
  input: EvaluateClaimPublicationInput
): ClaimDomainResult<ClaimPublicationDecision> {
  const claimStatuses = input.claims.map((c) => ({
    claimId: c.id,
    status: c.status,
    text: c.text,
  }));

  if (!isGatedTarget(input.targetContentStatus)) {
    return claimOk({
      result: 'PASS',
      allowed: true,
      reasonCode: 'TARGET_NOT_GATED',
      summary: 'Target content status is not claim-gated.',
      blockingClaimIds: [],
      reviewClaimIds: [],
      claimStatuses,
    });
  }

  if (input.claims.length === 0) {
    return claimOk({
      result: 'PASS',
      allowed: true,
      reasonCode: 'NO_CLAIMS',
      summary: 'No claims registered for this content revision.',
      blockingClaimIds: [],
      reviewClaimIds: [],
      claimStatuses,
    });
  }

  const hardBlocked = claimsOfStatus(input.claims, 'HARD_BLOCKED');
  if (hardBlocked.length) {
    return claimOk({
      result: 'BLOCK',
      allowed: false,
      reasonCode: 'HARD_BLOCKED',
      summary: `${hardBlocked.length} claim(s) are HARD_BLOCKED.`,
      blockingClaimIds: hardBlocked.map((c) => c.id),
      reviewClaimIds: [],
      claimStatuses,
    });
  }

  const unsupported = claimsOfStatus(input.claims, 'UNSUPPORTED');
  if (unsupported.length) {
    return claimOk({
      result: 'BLOCK',
      allowed: false,
      reasonCode: 'UNSUPPORTED',
      summary: `${unsupported.length} claim(s) are UNSUPPORTED.`,
      blockingClaimIds: unsupported.map((c) => c.id),
      reviewClaimIds: [],
      claimStatuses,
    });
  }

  const evidenceRequired = claimsOfStatus(input.claims, 'EVIDENCE_REQUIRED');
  if (evidenceRequired.length) {
    return claimOk({
      result: 'BLOCK',
      allowed: false,
      reasonCode: 'EVIDENCE_REQUIRED',
      summary: `${evidenceRequired.length} claim(s) require evidence.`,
      blockingClaimIds: evidenceRequired.map((c) => c.id),
      reviewClaimIds: [],
      claimStatuses,
    });
  }

  const researchRequired = claimsOfStatus(input.claims, 'RESEARCH_REQUIRED');
  if (researchRequired.length) {
    return claimOk({
      result: 'BLOCK',
      allowed: false,
      reasonCode: 'RESEARCH_REQUIRED',
      summary: `${researchRequired.length} claim(s) require research.`,
      blockingClaimIds: researchRequired.map((c) => c.id),
      reviewClaimIds: [],
      claimStatuses,
    });
  }

  const underReview = claimsOfStatus(input.claims, 'UNDER_REVIEW');
  const linked = claimsOfStatus(input.claims, 'LINKED');
  const detected = claimsOfStatus(input.claims, 'DETECTED');

  const notClear = input.claims.filter(
    (c) => !isPublicationAllowedClaimStatus(c.status)
  );

  if (underReview.length && notClear.every((c) => c.status === 'UNDER_REVIEW' || isPublicationAllowedClaimStatus(c.status))) {
    // Gated exposure still blocked; surface REVIEW_REQUIRED for explainability.
    return claimOk({
      result: 'REVIEW_REQUIRED',
      allowed: false,
      reasonCode: 'UNDER_REVIEW',
      summary: `${underReview.length} claim(s) are UNDER_REVIEW — gated exposure blocked.`,
      blockingClaimIds: underReview.map((c) => c.id),
      reviewClaimIds: underReview.map((c) => c.id),
      claimStatuses,
    });
  }

  if (notClear.length) {
    const blockingClaimIds = [...detected, ...linked, ...underReview, ...notClear]
      .map((c) => c.id)
      .filter((id, i, arr) => arr.indexOf(id) === i);

    return claimOk({
      result: 'BLOCK',
      allowed: false,
      reasonCode: 'NOT_VERIFIED',
      summary: `${notClear.length} claim(s) are not VERIFIED or OVERRIDDEN.`,
      blockingClaimIds,
      reviewClaimIds: underReview.map((c) => c.id),
      claimStatuses,
    });
  }

  return claimOk({
    result: 'PASS',
    allowed: true,
    reasonCode: 'ALL_CLAIMS_CLEAR',
    summary: 'All claims are VERIFIED or OVERRIDDEN.',
    blockingClaimIds: [],
    reviewClaimIds: [],
    claimStatuses,
  });
}
