import type { ClaimKind } from '../../../domain/claimCore';
import type { ClaimTenantScope } from './ClaimRepository';

/**
 * Advisory claim extraction only — NEVER authoritative Verification.
 * Runtime AI adapter is DEFERRED (no new SPEC-005 AiOperation in Phase 2).
 * Tests use doubles; production wiring is future work.
 */
export interface ClaimExtractionProposal {
  text: string;
  kind: ClaimKind;
  /** Advisory confidence — not Verification. */
  confidence?: number;
  rationaleSummary?: string;
}

export interface ClaimExtractorPort {
  extract(input: {
    tenant: ClaimTenantScope;
    contentId: string;
    contentHash: string;
    body: string;
  }): ClaimExtractionProposal[];
}
