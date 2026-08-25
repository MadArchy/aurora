import type { ClaimHistoryPort, ClaimHistoryRecord } from '../../application/claimEvidence';
import type { ClaimOverrideRecord } from '../../domain/claimOverrideCore';
import type { LocalClaimEvidenceStore } from './LocalClaimEvidenceStore';

/**
 * Append-only history adapter.
 * Production API: append / appendOverride only. No update/replace/delete.
 */
export class LocalClaimHistoryAdapter implements ClaimHistoryPort {
  constructor(private readonly store: LocalClaimEvidenceStore) {}

  append(entry: ClaimHistoryRecord): void {
    this.store.appendHistory(entry);
  }

  appendOverride(entry: ClaimOverrideRecord): void {
    this.store.appendOverride(entry);
  }
}
