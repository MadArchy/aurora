import type { EvidenceReader } from '../../application/claimEvidence';
import { createClaimEvidence } from '../../domain/evidenceCore';
import { createClaimSource } from '../../domain/claimSourceCore';
import type { ClaimEvidence } from '../../domain/evidenceCore';
import type { ClaimEvidenceLink } from '../../domain/claimLinkCore';
import type { EvidenceVaultItem } from '../../types';
import type { LocalClaimEvidenceStore } from './LocalClaimEvidenceStore';
import { persistenceError } from './persistenceErrors';

/**
 * Legacy Evidence Vault source. Adapter maps provenance only.
 * `verified: boolean` is NEVER Verification / publication authority.
 */
export interface EvidenceVaultSource {
  getById(evidenceId: string): EvidenceVaultItem | undefined;
}

/**
 * EvidenceReader: local canonical ClaimEvidence first, then vault adaptation.
 * Cross-tenant vault items return undefined (controlled not-found).
 * Does not auto-verify from vault presence or verified flag.
 */
export class LocalEvidenceVaultAdapter implements EvidenceReader {
  constructor(
    private readonly store: LocalClaimEvidenceStore,
    private readonly vault: EvidenceVaultSource
  ) {}

  getById(
    evidenceId: string,
    tenant: { organizationId: string; clientId: string }
  ): ClaimEvidence | undefined {
    const local = this.store.getEvidenceById(evidenceId, tenant);
    if (local) return local;

    const item = this.vault.getById(evidenceId);
    if (!item) return undefined;
    if (item.organizationId !== tenant.organizationId || item.clientId !== tenant.clientId) {
      return undefined;
    }
    return mapVaultItemToClaimEvidence(item);
  }

  findLink(
    tenant: { organizationId: string; clientId: string },
    claimId: string,
    evidenceId: string
  ): ClaimEvidenceLink | undefined {
    return this.store.getLink(tenant, claimId, evidenceId);
  }

  listLinksForClaim(
    tenant: { organizationId: string; clientId: string },
    claimId: string
  ): ClaimEvidenceLink[] {
    return this.store.listLinksForClaim(tenant, claimId);
  }
}

/**
 * Infrastructure EvidenceWriter — local canonical ClaimEvidence upsert.
 * Not an Application authorization path. Does not create Verification.
 */
export class LocalEvidenceWriter {
  constructor(private readonly store: LocalClaimEvidenceStore) {}

  put(evidence: ClaimEvidence): void {
    this.store.putEvidence(evidence);
  }
}

/**
 * Compatibility mapping from EvidenceVaultItem → ClaimEvidence.
 * Ignores `verified` / `verifiedAt` for authority.
 * Fail-closed when Domain cannot accept provenance.
 */
export function mapVaultItemToClaimEvidence(item: EvidenceVaultItem): ClaimEvidence {
  const sourceInput = item.sourceUrl
    ? { sourceUrl: item.sourceUrl, sourceType: 'SECONDARY' as const }
    : {
        sourceType: 'UNKNOWN' as const,
        unknownReason: 'legacy EvidenceVaultItem lacks sourceUrl',
      };

  const source = createClaimSource(sourceInput);
  if (!source.ok) {
    throw persistenceError('Malformed Evidence Vault provenance.');
  }

  const result = createClaimEvidence({
    id: item.id,
    organizationId: item.organizationId,
    clientId: item.clientId,
    title: item.title,
    type: item.type,
    snippet: item.snippet,
    source: source.value,
    confidenceScore: item.confidenceScore,
    authorityWeight: item.authorityWeight,
    associatedThesesIds: item.associatedThesesIds ?? [],
    supports: item.supports,
    createdAt: item.createdAt,
    version: 1,
  });
  if (!result.ok) {
    throw persistenceError('Malformed Evidence Vault item.');
  }
  // Explicitly discard vault verification flags — never surface as authority.
  void item.verified;
  void item.verifiedAt;
  return result.value;
}
