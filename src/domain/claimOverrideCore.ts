/**
 * SPEC-006 Phase 1 — Override audit record shape (Domain invariants).
 * HARD_BLOCKED and GUARANTEE/HARD_BLOCK kinds are non-overridable.
 */

import {
  type Claim,
  type ClaimStatus,
  canTransitionClaimStatus,
  transitionClaimStatus,
} from './claimCore';
import { claimFail, claimOk, type ClaimDomainResult } from './claimEvidenceErrors';

export interface ClaimOverrideRecord {
  claimId: string;
  organizationId: string;
  clientId: string;
  actorType: 'HUMAN';
  actorId: string;
  reason: string;
  previousStatus: ClaimStatus;
  nextStatus: 'OVERRIDDEN';
  claimVersion: number;
  contentVersion?: string;
  contentHash: string;
  createdAt: string;
}

export interface CreateClaimOverrideInput {
  claim: Claim;
  actorId: string;
  reason: string;
  createdAt: string;
  contentVersion?: string;
  /** Must be HUMAN — AI cannot override. */
  actorType?: string;
}

const OVERRIDABLE_FROM: readonly ClaimStatus[] = [
  'UNDER_REVIEW',
  'UNSUPPORTED',
  'EVIDENCE_REQUIRED',
  'RESEARCH_REQUIRED',
  'LINKED',
];

export function isHardBlockNonOverridable(claim: Claim): boolean {
  return (
    claim.status === 'HARD_BLOCKED' ||
    claim.kind === 'HARD_BLOCK' ||
    claim.kind === 'GUARANTEE'
  );
}

export function createClaimOverride(
  input: CreateClaimOverrideInput
): ClaimDomainResult<{ claim: Claim; override: ClaimOverrideRecord }> {
  const actorType = input.actorType ?? 'HUMAN';
  if (actorType !== 'HUMAN') {
    return claimFail(
      'OVERRIDE_INVALID',
      'only HUMAN actors may override claim publication blocks'
    );
  }

  if (isHardBlockNonOverridable(input.claim)) {
    return claimFail(
      'HARD_BLOCK_NON_OVERRIDABLE',
      'HARD_BLOCKED / GUARANTEE / HARD_BLOCK claims cannot be overridden'
    );
  }

  if (!OVERRIDABLE_FROM.includes(input.claim.status)) {
    return claimFail(
      'OVERRIDE_INVALID',
      `cannot override from status ${input.claim.status}`
    );
  }

  if (!canTransitionClaimStatus(input.claim.status, 'OVERRIDDEN')) {
    return claimFail(
      'INVALID_STATE_TRANSITION',
      `cannot transition from ${input.claim.status} to OVERRIDDEN`
    );
  }

  if (typeof input.reason !== 'string' || input.reason.trim().length === 0) {
    return claimFail('OVERRIDE_INVALID', 'override reason is required');
  }
  if (typeof input.actorId !== 'string' || input.actorId.trim().length === 0) {
    return claimFail('OVERRIDE_INVALID', 'override actorId is required');
  }
  if (typeof input.createdAt !== 'string' || input.createdAt.trim().length === 0) {
    return claimFail('OVERRIDE_INVALID', 'override createdAt is required');
  }

  const transitioned = transitionClaimStatus(
    input.claim,
    'OVERRIDDEN',
    input.createdAt.trim()
  );
  if (!transitioned.ok) return transitioned;

  const override: ClaimOverrideRecord = {
    claimId: input.claim.id,
    organizationId: input.claim.organizationId,
    clientId: input.claim.clientId,
    actorType: 'HUMAN',
    actorId: input.actorId.trim(),
    reason: input.reason.trim(),
    previousStatus: input.claim.status,
    nextStatus: 'OVERRIDDEN',
    claimVersion: transitioned.value.version,
    contentVersion: input.contentVersion?.trim() || undefined,
    contentHash: input.claim.contentHash,
    createdAt: input.createdAt.trim(),
  };

  return claimOk({ claim: transitioned.value, override });
}
