import type { Claim } from '../../domain/claimCore';
import {
  createClaimOverride,
  type ClaimOverrideRecord,
} from '../../domain/claimOverrideCore';
import { commitClaimWriteUnit } from './commitWriteUnit';
import { ClaimEvidenceError } from './errors';
import { unwrapDomain } from './mapDomainError';
import type { ClaimHistoryPort } from './ports/ClaimHistoryPort';
import type { ClaimRepository } from './ports/ClaimRepository';
import {
  assertNoTenantSpoof,
  assertTrustedClaimActor,
  type TrustedClaimActorContext,
} from './trustedContext';

export interface OverrideClaimGateInput {
  trusted: TrustedClaimActorContext;
  claimId: string;
  reason: string;
  contentVersion?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Spoof attempts — ignored / rejected. */
  claimedActorType?: string;
  persist?: boolean;
}

export interface OverrideClaimGateResult {
  claim: Claim;
  override: ClaimOverrideRecord;
  writeUnitCommitted: boolean;
}

export interface OverrideClaimGateDeps {
  claims: ClaimRepository;
  history: ClaimHistoryPort;
}

export function createOverrideClaimGate(deps: OverrideClaimGateDeps) {
  return function overrideClaimGate(
    input: OverrideClaimGateInput
  ): OverrideClaimGateResult {
    assertTrustedClaimActor(input.trusted);
    assertNoTenantSpoof(input);

    if (input.claimedActorType === 'AI' || input.claimedActorType === 'SOFTWARE') {
      throw new ClaimEvidenceError(
        'OVERRIDE_INVALID',
        'Only trusted HUMAN actors may override claim gates.'
      );
    }

    if (!input.reason?.trim()) {
      throw new ClaimEvidenceError('OVERRIDE_INVALID', 'Override reason is required.');
    }

    const tenant = {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    };

    const claim = deps.claims.getById(input.claimId, tenant);
    if (!claim) {
      throw new ClaimEvidenceError('CLAIM_NOT_FOUND', `Claim not found: ${input.claimId}`);
    }

    const result = unwrapDomain(
      createClaimOverride({
        claim,
        actorId: input.trusted.actorId,
        actorType: 'HUMAN',
        reason: input.reason,
        createdAt: input.trusted.now,
        contentVersion: input.contentVersion,
      })
    );

    const history = {
      id: `hist_${claim.id}_override_${result.override.claimVersion}`,
      organizationId: tenant.organizationId,
      clientId: tenant.clientId,
      claimId: claim.id,
      event: 'CLAIM_OVERRIDDEN' as const,
      actorId: input.trusted.actorId,
      at: input.trusted.now,
      beforeStatus: result.override.previousStatus,
      afterStatus: result.claim.status,
      reason: result.override.reason,
      contentHash: claim.contentHash,
    };

    const persist = input.persist !== false;
    if (persist) {
      commitClaimWriteUnit(deps.claims, deps.history, {
        claims: [result.claim],
        history: [history],
        overrideAudit: result.override,
      });
    }

    return {
      claim: result.claim,
      override: result.override,
      writeUnitCommitted: persist,
    };
  };
}
