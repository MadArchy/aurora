import type { Claim } from '../../domain/claimCore';
import { ClaimEvidenceError } from './errors';
import type { ClaimExtractionProposal } from './ports/ClaimExtractorPort';
import type { ClaimExtractorPort } from './ports/ClaimExtractorPort';
import type { ClaimContentReader } from './ports/ClaimContentReader';
import type { ClaimHistoryPort } from './ports/ClaimHistoryPort';
import type { ClaimRepository } from './ports/ClaimRepository';
import {
  createRegisterClaim,
  type RegisterClaimResult,
} from './RegisterClaim';
import {
  assertNoTenantSpoof,
  assertTrustedClaimActor,
  type TrustedClaimActorContext,
} from './trustedContext';

export interface ExtractClaimsInput {
  trusted: TrustedClaimActorContext;
  contentId: string;
  body: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** When true, register DETECTED claims via RegisterClaim. */
  persist?: boolean;
  /** Stable id prefix for registered claims. */
  claimIdPrefix?: string;
}

export interface ExtractClaimsResult {
  proposals: ClaimExtractionProposal[];
  registered: RegisterClaimResult[];
  /** Runtime AI adapter is deferred — extractor port only. */
  runtimeExtractor: 'PORT_ONLY';
}

export interface ExtractClaimsDeps {
  claims: ClaimRepository;
  history: ClaimHistoryPort;
  content: ClaimContentReader;
  extractor: ClaimExtractorPort;
}

/**
 * Advisory extraction. Does NOT verify. Does NOT call providers directly.
 * RUNTIME EXTRACTOR = DEFERRED (port + test double only in Phase 2).
 */
export function createExtractClaims(deps: ExtractClaimsDeps) {
  const registerClaim = createRegisterClaim(deps);

  return function extractClaims(input: ExtractClaimsInput): ExtractClaimsResult {
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

    const proposals = deps.extractor.extract({
      tenant,
      contentId: contentCtx.contentId,
      contentHash: contentCtx.contentHash,
      body: input.body,
    });

    const registered: RegisterClaimResult[] = [];
    const persist = input.persist === true;
    if (persist) {
      const prefix = input.claimIdPrefix ?? `claim_${contentCtx.contentId}`;
      proposals.forEach((proposal, index) => {
        registered.push(
          registerClaim({
            trusted: input.trusted,
            claimId: `${prefix}_${index + 1}`,
            contentId: contentCtx.contentId,
            text: proposal.text,
            kind: proposal.kind,
            persist: true,
          })
        );
      });
    }

    return {
      proposals,
      registered,
      runtimeExtractor: 'PORT_ONLY',
    };
  };
}

export type { Claim, ClaimExtractionProposal };
