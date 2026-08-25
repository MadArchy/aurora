/**
 * SPEC-006 Phase 1 — Verification record + authority rules.
 * AI is NEVER an authoritative verification actor.
 */

import { claimFail, claimOk, type ClaimDomainResult } from './claimEvidenceErrors';
import type { ClaimStatus } from './claimCore';
import {
  assertTenantsMatch,
  type ClaimTenantEnvelope,
} from './claimTenantCore';

export const VERIFICATION_RESULTS = [
  'PASS',
  'REVIEW_REQUIRED',
  'FAIL',
  'HARD_BLOCK',
] as const;
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

/** Authoritative actors only — AI may suggest, never verify. */
export const VERIFICATION_ACTOR_TYPES = ['SOFTWARE', 'HUMAN'] as const;
export type VerificationActorType = (typeof VERIFICATION_ACTOR_TYPES)[number];

export interface ClaimVerification {
  id: string;
  claimId: string;
  organizationId: string;
  clientId: string;
  result: VerificationResult;
  claimStatusAfter: ClaimStatus;
  actorType: VerificationActorType;
  actorId: string;
  ruleId: string;
  ruleVersion: string;
  evidenceIds: string[];
  summary: string;
  createdAt: string;
  contentHash: string;
}

export interface CreateClaimVerificationInput {
  id: string;
  claimId: string;
  organizationId: string;
  clientId: string;
  /** Must match Claim tenant. */
  claimTenant: ClaimTenantEnvelope;
  result: VerificationResult;
  claimStatusAfter: ClaimStatus;
  actorType: string;
  actorId: string;
  ruleId: string;
  ruleVersion: string;
  evidenceIds: string[];
  summary: string;
  createdAt: string;
  contentHash: string;
  /** Must match Claim.contentHash. */
  claimContentHash: string;
}

function nonEmpty(value: unknown, field: string): ClaimDomainResult<string> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return claimFail('INVALID_VERIFICATION', `${field} is required`);
  }
  return claimOk(value.trim());
}

export function isAuthoritativeVerificationActor(
  actorType: string
): actorType is VerificationActorType {
  return (VERIFICATION_ACTOR_TYPES as readonly string[]).includes(actorType);
}

/**
 * Maps verification result → expected ClaimStatus (Domain suggestion for callers).
 */
export function claimStatusAfterVerificationResult(
  result: VerificationResult
): ClaimStatus {
  switch (result) {
    case 'PASS':
      return 'VERIFIED';
    case 'REVIEW_REQUIRED':
      return 'UNDER_REVIEW';
    case 'FAIL':
      return 'UNSUPPORTED';
    case 'HARD_BLOCK':
      return 'HARD_BLOCKED';
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}

export function createClaimVerification(
  input: CreateClaimVerificationInput
): ClaimDomainResult<ClaimVerification> {
  if (input.actorType === 'AI' || input.actorType === 'ai') {
    return claimFail(
      'AI_VERIFICATION_FORBIDDEN',
      'AI cannot be an authoritative Verification actor'
    );
  }

  if (!isAuthoritativeVerificationActor(input.actorType)) {
    return claimFail(
      'VERIFICATION_FORBIDDEN',
      'actorType must be SOFTWARE or HUMAN'
    );
  }

  if (!(VERIFICATION_RESULTS as readonly string[]).includes(input.result)) {
    return claimFail('INVALID_VERIFICATION', 'result is not a canonical VerificationResult');
  }

  const tenant = assertTenantsMatch(
    {
      organizationId: input.organizationId,
      clientId: input.clientId,
    },
    input.claimTenant
  );
  if (!tenant.ok) {
    return claimFail('TENANT_MISMATCH', 'Verification tenant must match Claim');
  }

  if (input.contentHash.trim() !== input.claimContentHash.trim()) {
    return claimFail(
      'INVALID_VERIFICATION',
      'contentHash must match Claim.contentHash'
    );
  }

  const expectedStatus = claimStatusAfterVerificationResult(input.result);
  if (input.claimStatusAfter !== expectedStatus) {
    return claimFail(
      'INVALID_VERIFICATION',
      `claimStatusAfter must be ${expectedStatus} for result ${input.result}`
    );
  }

  const id = nonEmpty(input.id, 'id');
  if (!id.ok) return id;
  const claimId = nonEmpty(input.claimId, 'claimId');
  if (!claimId.ok) return claimId;
  const actorId = nonEmpty(input.actorId, 'actorId');
  if (!actorId.ok) return actorId;
  const ruleId = nonEmpty(input.ruleId, 'ruleId');
  if (!ruleId.ok) return ruleId;
  const ruleVersion = nonEmpty(input.ruleVersion, 'ruleVersion');
  if (!ruleVersion.ok) return ruleVersion;
  const summary = nonEmpty(input.summary, 'summary');
  if (!summary.ok) return summary;
  const createdAt = nonEmpty(input.createdAt, 'createdAt');
  if (!createdAt.ok) return createdAt;
  const contentHash = nonEmpty(input.contentHash, 'contentHash');
  if (!contentHash.ok) return contentHash;

  if (!Array.isArray(input.evidenceIds)) {
    return claimFail('INVALID_VERIFICATION', 'evidenceIds must be an array');
  }

  const evidenceIds = input.evidenceIds
    .map((e) => (typeof e === 'string' ? e.trim() : ''))
    .filter(Boolean);

  return claimOk({
    id: id.value,
    claimId: claimId.value,
    organizationId: input.claimTenant.organizationId.trim(),
    clientId: input.claimTenant.clientId.trim(),
    result: input.result,
    claimStatusAfter: input.claimStatusAfter,
    actorType: input.actorType,
    actorId: actorId.value,
    ruleId: ruleId.value,
    ruleVersion: ruleVersion.value,
    evidenceIds,
    summary: summary.value,
    createdAt: createdAt.value,
    contentHash: contentHash.value,
  });
}
