import type {
  ClaimContentContext,
  ClaimContentReader,
} from '../../application/claimEvidence';

/** Read-only content source for Claim registration / publication context. */
export interface ClaimContentSource {
  getById(contentId: string): ClaimContentContext | undefined;
}

/**
 * READ ONLY ClaimContentReader adapter.
 * Does not mutate Content or StrategicBrief (SPEC-003 boundary).
 */
export class LocalClaimContentReader implements ClaimContentReader {
  constructor(private readonly source: ClaimContentSource) {}

  getById(
    contentId: string,
    tenant: { organizationId: string; clientId: string }
  ): ClaimContentContext | undefined {
    const content = this.source.getById(contentId);
    if (!content) return undefined;
    if (
      content.organizationId !== tenant.organizationId ||
      content.clientId !== tenant.clientId
    ) {
      return undefined;
    }
    return {
      contentId: content.contentId,
      organizationId: content.organizationId,
      clientId: content.clientId,
      contentHash: content.contentHash,
      strategicBriefId: content.strategicBriefId,
      strategicBriefVersion: content.strategicBriefVersion,
    };
  }
}
