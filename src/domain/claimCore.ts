/**
 * SPEC-006 Phase 1 — Claim aggregate + ClaimStatus lifecycle (pure).
 */

import { claimFail, claimOk, type ClaimDomainResult } from './claimEvidenceErrors';
import {
  assertClaimTenantStructure,
  type ClaimTenantEnvelope,
} from './claimTenantCore';

export const CLAIM_SCHEMA_VERSION = 'claim-v1' as const;

export const CLAIM_KINDS = [
  'CREDENTIAL',
  'AWARD',
  'METRIC',
  'SUPERLATIVE',
  'GUARANTEE',
  'HARD_BLOCK',
  'OTHER',
] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const CLAIM_STATUSES = [
  'DETECTED',
  'EVIDENCE_REQUIRED',
  'RESEARCH_REQUIRED',
  'LINKED',
  'UNDER_REVIEW',
  'VERIFIED',
  'UNSUPPORTED',
  'HARD_BLOCKED',
  'OVERRIDDEN',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** Statuses that allow gated client/public exposure. */
export const PUBLICATION_ALLOWED_CLAIM_STATUSES: readonly ClaimStatus[] = [
  'VERIFIED',
  'OVERRIDDEN',
];

/** Statuses that always block gated publication. */
export const PUBLICATION_BLOCKING_CLAIM_STATUSES: readonly ClaimStatus[] = [
  'DETECTED',
  'EVIDENCE_REQUIRED',
  'RESEARCH_REQUIRED',
  'LINKED',
  'UNDER_REVIEW',
  'UNSUPPORTED',
  'HARD_BLOCKED',
];

/**
 * Explicit legal transitions (fail-closed otherwise).
 * HARD_BLOCKED has no outbound transitions (non-overridable).
 */
export const CLAIM_STATUS_TRANSITIONS: Record<ClaimStatus, readonly ClaimStatus[]> = {
  DETECTED: [
    'EVIDENCE_REQUIRED',
    'RESEARCH_REQUIRED',
    'LINKED',
    'UNDER_REVIEW',
    'HARD_BLOCKED',
  ],
  EVIDENCE_REQUIRED: ['LINKED', 'RESEARCH_REQUIRED', 'HARD_BLOCKED', 'UNDER_REVIEW'],
  RESEARCH_REQUIRED: [
    'EVIDENCE_REQUIRED',
    'LINKED',
    'UNDER_REVIEW',
    'HARD_BLOCKED',
  ],
  LINKED: ['UNDER_REVIEW', 'VERIFIED', 'UNSUPPORTED', 'HARD_BLOCKED', 'EVIDENCE_REQUIRED'],
  UNDER_REVIEW: [
    'VERIFIED',
    'UNSUPPORTED',
    'EVIDENCE_REQUIRED',
    'RESEARCH_REQUIRED',
    'OVERRIDDEN',
    'HARD_BLOCKED',
    'LINKED',
  ],
  VERIFIED: ['UNDER_REVIEW', 'EVIDENCE_REQUIRED', 'LINKED', 'HARD_BLOCKED'],
  UNSUPPORTED: [
    'UNDER_REVIEW',
    'OVERRIDDEN',
    'EVIDENCE_REQUIRED',
    'RESEARCH_REQUIRED',
    'LINKED',
  ],
  HARD_BLOCKED: [],
  OVERRIDDEN: ['UNDER_REVIEW', 'EVIDENCE_REQUIRED', 'HARD_BLOCKED'],
};

export interface Claim {
  id: string;
  organizationId: string;
  clientId: string;
  contentId: string;
  contentHash: string;
  text: string;
  kind: ClaimKind;
  status: ClaimStatus;
  thesisId?: string;
  strategicBriefId?: string;
  strategicBriefVersion?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  schemaVersion: typeof CLAIM_SCHEMA_VERSION;
  version: number;
}

export interface CreateClaimInput {
  id: string;
  organizationId: string;
  clientId: string;
  contentId: string;
  contentHash: string;
  text: string;
  kind: ClaimKind;
  /** Defaults to DETECTED. GUARANTEE/HARD_BLOCK may start HARD_BLOCKED when requested. */
  status?: ClaimStatus;
  thesisId?: string;
  strategicBriefId?: string;
  strategicBriefVersion?: number;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  version?: number;
}

function nonEmpty(value: unknown, field: string): ClaimDomainResult<string> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return claimFail('INVALID_CLAIM', `${field} is required`);
  }
  return claimOk(value.trim());
}

export function isClaimStatus(value: unknown): value is ClaimStatus {
  return typeof value === 'string' && (CLAIM_STATUSES as readonly string[]).includes(value);
}

export function isClaimKind(value: unknown): value is ClaimKind {
  return typeof value === 'string' && (CLAIM_KINDS as readonly string[]).includes(value);
}

export function canTransitionClaimStatus(
  from: ClaimStatus,
  to: ClaimStatus
): boolean {
  if (from === to) return true;
  return CLAIM_STATUS_TRANSITIONS[from].includes(to);
}

export function transitionClaimStatus(
  claim: Claim,
  to: ClaimStatus,
  updatedAt: string
): ClaimDomainResult<Claim> {
  if (!isClaimStatus(to)) {
    return claimFail('INVALID_STATE_TRANSITION', 'target status is invalid');
  }
  if (!canTransitionClaimStatus(claim.status, to)) {
    return claimFail(
      'INVALID_STATE_TRANSITION',
      `cannot transition Claim status from ${claim.status} to ${to}`
    );
  }
  const at = nonEmpty(updatedAt, 'updatedAt');
  if (!at.ok) return at;

  const nextVersion = to === claim.status ? claim.version : claim.version + 1;

  return claimOk({
    ...claim,
    status: to,
    updatedAt: at.value,
    version: nextVersion,
  });
}

/**
 * EVIDENCE_REQUIRED: support needed and no eligible link yet.
 * Distinct from RESEARCH_REQUIRED (investigation beyond vault).
 */
export function markEvidenceRequired(
  claim: Claim,
  updatedAt: string
): ClaimDomainResult<Claim> {
  return transitionClaimStatus(claim, 'EVIDENCE_REQUIRED', updatedAt);
}

export function markResearchRequired(
  claim: Claim,
  updatedAt: string
): ClaimDomainResult<Claim> {
  return transitionClaimStatus(claim, 'RESEARCH_REQUIRED', updatedAt);
}

/** After intentional tenant-valid ClaimEvidenceLink. */
export function markClaimLinked(
  claim: Claim,
  updatedAt: string
): ClaimDomainResult<Claim> {
  return transitionClaimStatus(claim, 'LINKED', updatedAt);
}

export function markHardBlocked(
  claim: Claim,
  updatedAt: string
): ClaimDomainResult<Claim> {
  return transitionClaimStatus(claim, 'HARD_BLOCKED', updatedAt);
}

export function createClaim(input: CreateClaimInput): ClaimDomainResult<Claim> {
  const tenant = assertClaimTenantStructure({
    organizationId: input.organizationId,
    clientId: input.clientId,
  });
  if (!tenant.ok) return tenant;

  const id = nonEmpty(input.id, 'id');
  if (!id.ok) return id;
  const contentId = nonEmpty(input.contentId, 'contentId');
  if (!contentId.ok) return contentId;
  const contentHash = nonEmpty(input.contentHash, 'contentHash');
  if (!contentHash.ok) return contentHash;
  const text = nonEmpty(input.text, 'text');
  if (!text.ok) return text;
  const createdBy = nonEmpty(input.createdBy, 'createdBy');
  if (!createdBy.ok) return createdBy;
  const createdAt = nonEmpty(input.createdAt, 'createdAt');
  if (!createdAt.ok) return createdAt;

  if (!isClaimKind(input.kind)) {
    return claimFail('INVALID_CLAIM', 'kind is not a canonical ClaimKind');
  }

  const status: ClaimStatus = input.status ?? 'DETECTED';
  if (!isClaimStatus(status)) {
    return claimFail('INVALID_CLAIM', 'status is not a canonical ClaimStatus');
  }

  if (status !== 'DETECTED' && status !== 'HARD_BLOCKED') {
    return claimFail(
      'INVALID_CLAIM',
      'createClaim initial status must be DETECTED or HARD_BLOCKED'
    );
  }

  if (
    input.kind === 'HARD_BLOCK' &&
    status === 'DETECTED'
  ) {
    // Caller may still create DETECTED then markHardBlocked; allow both.
  }

  const version = input.version ?? 1;
  if (!Number.isInteger(version) || version < 1) {
    return claimFail('INVALID_CLAIM', 'version must be a positive integer');
  }

  if (
    input.strategicBriefVersion !== undefined &&
    (!Number.isInteger(input.strategicBriefVersion) ||
      input.strategicBriefVersion < 1)
  ) {
    return claimFail(
      'INVALID_CLAIM',
      'strategicBriefVersion must be a positive integer when set'
    );
  }

  const updatedAt = input.updatedAt
    ? nonEmpty(input.updatedAt, 'updatedAt')
    : createdAt;
  if (!updatedAt.ok) return updatedAt;

  return claimOk({
    id: id.value,
    organizationId: tenant.value.organizationId,
    clientId: tenant.value.clientId,
    contentId: contentId.value,
    contentHash: contentHash.value,
    text: text.value,
    kind: input.kind,
    status,
    thesisId: input.thesisId?.trim() || undefined,
    strategicBriefId: input.strategicBriefId?.trim() || undefined,
    strategicBriefVersion: input.strategicBriefVersion,
    createdAt: createdAt.value,
    updatedAt: updatedAt.value,
    createdBy: createdBy.value,
    schemaVersion: CLAIM_SCHEMA_VERSION,
    version,
  });
}

export function claimTenantOf(claim: Claim): ClaimTenantEnvelope {
  return {
    organizationId: claim.organizationId,
    clientId: claim.clientId,
  };
}

export function isPublicationAllowedClaimStatus(status: ClaimStatus): boolean {
  return PUBLICATION_ALLOWED_CLAIM_STATUSES.includes(status);
}

export function claimBlocksGatedPublication(status: ClaimStatus): boolean {
  return PUBLICATION_BLOCKING_CLAIM_STATUSES.includes(status);
}
