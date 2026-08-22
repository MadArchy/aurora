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

/**
 * Gate centralizado: BLOCK nunca avanza.
 * REVIEW solo se frena cuando `requireReviewAck` es true y no hay ack.
 */
export function assertClaimSafeTransition(
  currentStatus: ContentStatus,
  targetStatus: ContentStatus,
  claimSafety: ClaimSafetyVerdictRecord | undefined,
  options?: { reviewAcknowledged?: boolean; requireReviewAck?: boolean }
): ClaimSafetyGateResult {
  if (!CLAIM_GATED_STATUSES.includes(targetStatus)) {
    return { allowed: true, status: targetStatus };
  }

  if (!claimSafety) {
    return {
      allowed: false,
      status: currentStatus,
      reason: 'Falta pasar el contenido por Claim Safety antes de avanzar.',
    };
  }

  if (claimSafety.verdict === 'BLOCK') {
    return {
      allowed: false,
      status: currentStatus,
      reason: `Claim safety bloquea el avance: ${claimSafety.summary}`,
    };
  }

  if (
    claimSafety.verdict === 'REVIEW' &&
    options?.requireReviewAck &&
    !options?.reviewAcknowledged
  ) {
    return {
      allowed: false,
      status: currentStatus,
      requiresAck: true,
      reason: `Hay afirmaciones por revisar: ${claimSafety.summary}`,
    };
  }

  return { allowed: true, status: targetStatus };
}

/** True si el target exige gate. */
export function isClaimGatedStatus(status: ContentStatus): boolean {
  return CLAIM_GATED_STATUSES.includes(status);
}
