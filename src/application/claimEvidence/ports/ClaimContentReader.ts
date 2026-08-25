import type { ClaimTenantScope } from './ClaimRepository';

/** Content context for claim registration / publication — read-only. */
export interface ClaimContentContext {
  contentId: string;
  organizationId: string;
  clientId: string;
  contentHash: string;
  strategicBriefId?: string;
  strategicBriefVersion?: number;
}

export interface ClaimContentReader {
  getById(contentId: string, tenant: ClaimTenantScope): ClaimContentContext | undefined;
}
