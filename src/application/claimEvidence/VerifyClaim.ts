import {
  transitionClaimStatus,
  type Claim,
} from '../../domain/claimCore';
import {
  claimStatusAfterVerificationResult,
  createClaimVerification,
  type ClaimVerification,
  type VerificationResult,
} from '../../domain/claimVerificationCore';
import { claimMaterialFingerprint } from '../../domain/claimMaterialityCore';
import { commitClaimWriteUnit } from './commitWriteUnit';
import { ClaimEvidenceError } from './errors';
import { unwrapDomain } from './mapDomainError';
import type { ClaimHistoryPort } from './ports/ClaimHistoryPort';
import type { ClaimRepository } from './ports/ClaimRepository';
import type { EvidenceReader } from './ports/EvidenceReader';
import type { VerificationStore } from './ports/VerificationStore';
import {
  assertNoTenantSpoof,
  assertSoftwareAuthority,
  assertTrustedClaimActor,
  type TrustedClaimActorContext,
} from './trustedContext';

export type VerifyClaimInvocation =
  | { kind: 'HUMAN' }
  | { kind: 'SOFTWARE' };

export interface VerifyClaimInput {
  trusted: TrustedClaimActorContext;
  claimId: string;
  verificationId: string;
  result: VerificationResult;
  evidenceIds: string[];
  summary: string;
  ruleId: string;
  ruleVersion: string;
  /**
   * Authority channel — NOT taken from caller actorType string.
   * SOFTWARE requires trusted.softwareAuthority === true.
   */
  invocation: VerifyClaimInvocation;
  /** Ignored if present — spoof protection. */
  claimedActorType?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  persist?: boolean;
}

export interface VerifyClaimResult {
  claim: Claim;
  verification: ClaimVerification;
  created: boolean;
  writeUnitCommitted: boolean;
}

export interface VerifyClaimDeps {
  claims: ClaimRepository;
  history: ClaimHistoryPort;
  evidence: EvidenceReader;
  verifications: VerificationStore;
}

function ensureEvidenceIds(
  evidence: EvidenceReader,
  tenant: { organizationId: string; clientId: string },
  evidenceIds: string[]
): void {
  for (const id of evidenceIds) {
    const item = evidence.getById(id, tenant);
    if (!item) {
      throw new ClaimEvidenceError(
        'EVIDENCE_NOT_FOUND',
        `Evidence not found in tenant: ${id}`
      );
    }
  }
}

export function createVerifyClaim(deps: VerifyClaimDeps) {
  return function verifyClaim(input: VerifyClaimInput): VerifyClaimResult {
    assertTrustedClaimActor(input.trusted);
    assertNoTenantSpoof(input);

    // Caller-spoofed actorType is never authority.
    if (input.claimedActorType === 'AI' || input.claimedActorType === 'ai') {
      throw new ClaimEvidenceError(
        'AI_VERIFICATION_FORBIDDEN',
        'AI cannot be an authoritative Verification actor.'
      );
    }

    let actorType: 'SOFTWARE' | 'HUMAN';
    if (input.invocation.kind === 'SOFTWARE') {
      assertSoftwareAuthority(input.trusted);
      actorType = 'SOFTWARE';
    } else if (input.invocation.kind === 'HUMAN') {
      if (input.claimedActorType === 'SOFTWARE' || input.claimedActorType === 'software') {
        throw new ClaimEvidenceError(
          'VERIFICATION_FORBIDDEN',
          'Caller cannot spoof SOFTWARE verification actor.'
        );
      }
      actorType = 'HUMAN';
    } else {
      throw new ClaimEvidenceError('VERIFICATION_FORBIDDEN', 'Unknown verification invocation.');
    }

    const tenant = {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    };

    const claim = deps.claims.getById(input.claimId, tenant);
    if (!claim) {
      throw new ClaimEvidenceError('CLAIM_NOT_FOUND', `Claim not found: ${input.claimId}`);
    }

    ensureEvidenceIds(deps.evidence, tenant, input.evidenceIds);

    const existingSame = deps.verifications.findByClaimAndHash(
      claim.id,
      tenant,
      claim.contentHash
    );
    if (
      existingSame &&
      existingSame.result === input.result &&
      existingSame.ruleId === input.ruleId &&
      existingSame.ruleVersion === input.ruleVersion &&
      [...existingSame.evidenceIds].sort().join(',') ===
        [...input.evidenceIds].sort().join(',')
    ) {
      return {
        claim,
        verification: existingSame,
        created: false,
        writeUnitCommitted: false,
      };
    }

    // Stale prior verification for different material must not authorize.
    const latest = deps.verifications.getLatestForClaim(claim.id, tenant);
    if (latest && latest.contentHash !== claim.contentHash) {
      // Continuing creates a new verification for current hash — old is not used.
      void claimMaterialFingerprint(claim);
    }

    const claimStatusAfter = claimStatusAfterVerificationResult(input.result);
    const verification = unwrapDomain(
      createClaimVerification({
        id: input.verificationId,
        claimId: claim.id,
        organizationId: tenant.organizationId,
        clientId: tenant.clientId,
        claimTenant: claim,
        result: input.result,
        claimStatusAfter,
        actorType,
        actorId: input.trusted.actorId,
        ruleId: input.ruleId,
        ruleVersion: input.ruleVersion,
        evidenceIds: input.evidenceIds,
        summary: input.summary,
        createdAt: input.trusted.now,
        contentHash: claim.contentHash,
        claimContentHash: claim.contentHash,
      })
    );

    const nextClaim = unwrapDomain(
      transitionClaimStatus(claim, claimStatusAfter, input.trusted.now)
    );

    const history = {
      id: `hist_${verification.id}`,
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      claimId: claim.id,
      event: 'CLAIM_VERIFIED' as const,
      actorId: input.trusted.actorId,
      at: input.trusted.now,
      beforeStatus: claim.status,
      afterStatus: nextClaim.status,
      evidenceIds: input.evidenceIds,
      verificationId: verification.id,
      contentHash: claim.contentHash,
      ruleId: input.ruleId,
      ruleVersion: input.ruleVersion,
    };

    const persist = input.persist !== false;
    if (persist) {
      commitClaimWriteUnit(deps.claims, deps.history, {
        claims: [nextClaim],
        verifications: [verification],
        history: [history],
      });
    }

    return {
      claim: nextClaim,
      verification,
      created: true,
      writeUnitCommitted: persist,
    };
  };
}
