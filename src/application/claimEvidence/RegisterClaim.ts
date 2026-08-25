import { createClaim, type Claim, type ClaimKind } from '../../domain/claimCore';
import { claimMaterialFingerprint } from '../../domain/claimMaterialityCore';
import { commitClaimWriteUnit } from './commitWriteUnit';
import { ClaimEvidenceError } from './errors';
import { unwrapDomain } from './mapDomainError';
import type { ClaimContentReader } from './ports/ClaimContentReader';
import type { ClaimHistoryPort } from './ports/ClaimHistoryPort';
import type { ClaimRepository } from './ports/ClaimRepository';
import {
  assertNoTenantSpoof,
  assertTrustedClaimActor,
  type TrustedClaimActorContext,
} from './trustedContext';

export interface RegisterClaimInput {
  trusted: TrustedClaimActorContext;
  claimId: string;
  contentId: string;
  text: string;
  kind: ClaimKind;
  thesisId?: string;
  /** Ignored for verification — provenance only if content carries them. */
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Caller may pass body hash; Application prefers content context hash. */
  contentHash?: string;
  strategicBriefId?: string;
  strategicBriefVersion?: number;
  /** When false, returns write unit without committing (tests). Default true. */
  persist?: boolean;
}

export interface RegisterClaimResult {
  claim: Claim;
  created: boolean;
  writeUnitCommitted: boolean;
}

export interface RegisterClaimDeps {
  claims: ClaimRepository;
  history: ClaimHistoryPort;
  content: ClaimContentReader;
}

export function createRegisterClaim(deps: RegisterClaimDeps) {
  return function registerClaim(input: RegisterClaimInput): RegisterClaimResult {
    assertTrustedClaimActor(input.trusted);
    assertNoTenantSpoof(input);

    const tenant = {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    };

    const contentCtx = deps.content.getById(input.contentId, tenant);
    if (!contentCtx) {
      throw new ClaimEvidenceError(
        'CONTENT_NOT_FOUND',
        `Content not found in tenant: ${input.contentId}`
      );
    }

    const contentHash = contentCtx.contentHash;
    if (input.contentHash && input.contentHash !== contentHash) {
      throw new ClaimEvidenceError(
        'STALE_VERIFICATION',
        'Caller contentHash does not match governed content context.'
      );
    }

    const existingById = deps.claims.getById(input.claimId, tenant);
    if (existingById) {
      const same =
        existingById.contentId === contentCtx.contentId &&
        existingById.contentHash === contentHash &&
        existingById.text === input.text.trim() &&
        existingById.kind === input.kind;
      if (same) {
        return { claim: existingById, created: false, writeUnitCommitted: false };
      }
      throw new ClaimEvidenceError(
        'CLAIM_CONFLICT',
        `Claim id already exists with different material identity: ${input.claimId}`
      );
    }

    const duplicate = deps.claims.findByContentHash(
      tenant,
      contentCtx.contentId,
      contentHash,
      input.text.trim(),
      input.kind
    );
    if (duplicate) {
      return { claim: duplicate, created: false, writeUnitCommitted: false };
    }

    const claim = unwrapDomain(
      createClaim({
        id: input.claimId,
        organizationId: tenant.organizationId,
        clientId: tenant.clientId,
        contentId: contentCtx.contentId,
        contentHash,
        text: input.text,
        kind: input.kind,
        status: 'DETECTED',
        thesisId: input.thesisId,
        strategicBriefId:
          input.strategicBriefId ?? contentCtx.strategicBriefId,
        strategicBriefVersion:
          input.strategicBriefVersion ?? contentCtx.strategicBriefVersion,
        createdAt: input.trusted.now,
        createdBy: input.trusted.actorId,
      })
    );

    // supportingEvidenceIds are never auto-verification.
    void claimMaterialFingerprint(claim);

    const history = {
      id: `hist_${input.claimId}_reg`,
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      claimId: claim.id,
      event: 'CLAIM_REGISTERED' as const,
      actorId: input.trusted.actorId,
      at: input.trusted.now,
      afterStatus: claim.status,
      contentHash: claim.contentHash,
    };

    const persist = input.persist !== false;
    if (persist) {
      commitClaimWriteUnit(deps.claims, deps.history, {
        claims: [claim],
        history: [history],
      });
    }

    return { claim, created: true, writeUnitCommitted: persist };
  };
}
