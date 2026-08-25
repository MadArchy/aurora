import type { Claim } from '../../domain/claimCore';
import type { ClaimVerification } from '../../domain/claimVerificationCore';
import {
  createVerifyClaim,
  type VerifyClaimDeps,
  type VerifyClaimInvocation,
} from './VerifyClaim';
import type { TrustedClaimActorContext } from './trustedContext';

export interface RejectClaimVerificationInput {
  trusted: TrustedClaimActorContext;
  claimId: string;
  verificationId: string;
  evidenceIds: string[];
  summary: string;
  ruleId: string;
  ruleVersion: string;
  invocation: VerifyClaimInvocation;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedActorType?: string;
  persist?: boolean;
}

export interface RejectClaimVerificationResult {
  claim: Claim;
  verification: ClaimVerification;
  created: boolean;
  writeUnitCommitted: boolean;
}

/**
 * Distinct from HARD_BLOCK / EVIDENCE_REQUIRED / RESEARCH_REQUIRED.
 * Sets Verification result FAIL → ClaimStatus UNSUPPORTED.
 */
export function createRejectClaimVerification(deps: VerifyClaimDeps) {
  const verifyClaim = createVerifyClaim(deps);

  return function rejectClaimVerification(
    input: RejectClaimVerificationInput
  ): RejectClaimVerificationResult {
    return verifyClaim({
      ...input,
      result: 'FAIL',
    });
  };
}
