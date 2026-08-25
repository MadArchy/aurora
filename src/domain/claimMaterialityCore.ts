/**
 * SPEC-006 Phase 1 — Material identity helpers (no timestamps as sole identity).
 */

import type { Claim } from './claimCore';
import type { ClaimEvidenceLink } from './claimLinkCore';
import type { ClaimOverrideRecord } from './claimOverrideCore';
import type { ClaimVerification } from './claimVerificationCore';
import { claimEvidenceFingerprint, type ClaimEvidence } from './evidenceCore';

function sortedIds(ids: readonly string[]): string {
  return [...ids].sort().join(',');
}

/** Fingerprint of claim assertion + status + linkage refs (not createdAt alone). */
export function claimMaterialFingerprint(
  claim: Claim,
  linkedEvidenceIds: readonly string[] = []
): string {
  return [
    claim.id,
    claim.organizationId,
    claim.clientId,
    claim.contentId,
    claim.contentHash,
    claim.text,
    claim.kind,
    claim.status,
    String(claim.version),
    claim.thesisId ?? '',
    claim.strategicBriefId ?? '',
    String(claim.strategicBriefVersion ?? ''),
    sortedIds(linkedEvidenceIds),
  ].join('::');
}

export function claimVerificationMaterialFingerprint(
  verification: ClaimVerification
): string {
  return [
    verification.id,
    verification.claimId,
    verification.result,
    verification.claimStatusAfter,
    verification.actorType,
    verification.actorId,
    verification.ruleId,
    verification.ruleVersion,
    sortedIds(verification.evidenceIds),
    verification.contentHash,
  ].join('::');
}

export function claimLinkMaterialFingerprint(link: ClaimEvidenceLink): string {
  return [
    link.id,
    link.organizationId,
    link.clientId,
    link.claimId,
    link.evidenceId,
  ].join('::');
}

export function claimOverrideMaterialFingerprint(
  override: ClaimOverrideRecord
): string {
  return [
    override.claimId,
    override.organizationId,
    override.clientId,
    override.previousStatus,
    override.nextStatus,
    override.actorId,
    override.reason,
    String(override.claimVersion),
    override.contentHash,
  ].join('::');
}

export function isMaterialClaimChange(
  before: Claim,
  after: Claim,
  beforeEvidenceIds: readonly string[] = [],
  afterEvidenceIds: readonly string[] = []
): boolean {
  return (
    claimMaterialFingerprint(before, beforeEvidenceIds) !==
    claimMaterialFingerprint(after, afterEvidenceIds)
  );
}

export function isMaterialEvidenceChange(
  before: ClaimEvidence,
  after: ClaimEvidence
): boolean {
  return claimEvidenceFingerprint(before) !== claimEvidenceFingerprint(after);
}

/** Structured explainability projection (no chain-of-thought). */
export interface ClaimExplainabilityProjection {
  claimId: string;
  claimText: string;
  claimStatus: Claim['status'];
  claimKind: Claim['kind'];
  claimVersion: number;
  contentId: string;
  contentHash: string;
  evidenceIds: string[];
  verificationId?: string;
  verificationResult?: ClaimVerification['result'];
  verificationActorType?: ClaimVerification['actorType'];
  ruleId?: string;
  ruleVersion?: string;
  gateResult?: string;
  gateReasonCode?: string;
  overrideApplied: boolean;
  strategicBriefId?: string;
  strategicBriefVersion?: number;
}

export function buildClaimExplainabilityProjection(input: {
  claim: Claim;
  evidenceIds?: string[];
  verification?: ClaimVerification;
  gateResult?: string;
  gateReasonCode?: string;
  overrideApplied?: boolean;
}): ClaimExplainabilityProjection {
  const { claim, verification } = input;
  return {
    claimId: claim.id,
    claimText: claim.text,
    claimStatus: claim.status,
    claimKind: claim.kind,
    claimVersion: claim.version,
    contentId: claim.contentId,
    contentHash: claim.contentHash,
    evidenceIds: [...(input.evidenceIds ?? verification?.evidenceIds ?? [])],
    verificationId: verification?.id,
    verificationResult: verification?.result,
    verificationActorType: verification?.actorType,
    ruleId: verification?.ruleId,
    ruleVersion: verification?.ruleVersion,
    gateResult: input.gateResult,
    gateReasonCode: input.gateReasonCode,
    overrideApplied: Boolean(input.overrideApplied),
    strategicBriefId: claim.strategicBriefId,
    strategicBriefVersion: claim.strategicBriefVersion,
  };
}
