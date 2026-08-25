/**
 * Publication gate shim — Phase 4 demoted.
 *
 * Canonical authority: Application AuthorizePublication (via options.canonical).
 * ContentItem.claimSafety / legacy verdicts are COMPATIBILITY_ONLY and never
 * authorize gated CLIENT_REVIEW / READY / PUBLISHED alone.
 */

import type { ClaimSafetyVerdictRecord, ContentStatus } from '../types';

/** Estados que exponen el contenido al cliente o al público. */
export const CLAIM_GATED_STATUSES: ContentStatus[] = ['CLIENT_REVIEW', 'READY', 'PUBLISHED'];

export interface ClaimSafetyGateResult {
  allowed: boolean;
  /** Estado al que se puede avanzar (puede ser el actual si el gate bloquea). */
  status: ContentStatus;
  reason?: string;
  requiresAck?: boolean;
}

export interface CanonicalPublicationGateInput {
  allowed: boolean;
  reason?: string;
  reasonCode?: string;
}

/**
 * Gate centralizado (Phase 4 strangler).
 * Gated targets require `options.canonical` from AuthorizePublication.
 * Legacy `claimSafety` is ignored for allow/deny (COMPATIBILITY_ONLY).
 */
export function assertClaimSafeTransition(
  currentStatus: ContentStatus,
  targetStatus: ContentStatus,
  claimSafety: ClaimSafetyVerdictRecord | undefined,
  options?: {
    reviewAcknowledged?: boolean;
    requireReviewAck?: boolean;
    /** From AuthorizePublication — sole gated publication authority. */
    canonical?: CanonicalPublicationGateInput;
  }
): ClaimSafetyGateResult {
  if (!CLAIM_GATED_STATUSES.includes(targetStatus)) {
    return { allowed: true, status: targetStatus };
  }

  // Explicitly discard legacy verdict as authority.
  void claimSafety;
  void options?.reviewAcknowledged;
  void options?.requireReviewAck;

  if (!options?.canonical) {
    return {
      allowed: false,
      status: currentStatus,
      reason:
        'Canonical AuthorizePublication decision is required before gated content status advances.',
    };
  }

  if (!options.canonical.allowed) {
    return {
      allowed: false,
      status: currentStatus,
      reason:
        options.canonical.reason ||
        'Claim publication gate blocks this content status advance.',
    };
  }

  return { allowed: true, status: targetStatus };
}

/** True si el target exige gate. */
export function isClaimGatedStatus(status: ContentStatus): boolean {
  return CLAIM_GATED_STATUSES.includes(status);
}
