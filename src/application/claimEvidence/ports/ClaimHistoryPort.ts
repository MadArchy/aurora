import type { ClaimStatus } from '../../../domain/claimCore';

export interface ClaimHistoryRecord {
  id: string;
  organizationId: string;
  clientId: string;
  claimId: string;
  event:
    | 'CLAIM_REGISTERED'
    | 'CLAIM_EXTRACTED'
    | 'EVIDENCE_LINKED'
    | 'EVIDENCE_REQUIRED'
    | 'RESEARCH_REQUIRED'
    | 'CLAIM_REVIEWED'
    | 'CLAIM_VERIFIED'
    | 'CLAIM_REJECTED'
    | 'CLAIM_OVERRIDDEN'
    | 'PUBLICATION_AUTHORIZED'
    | 'PUBLICATION_DENIED';
  actorId: string;
  at: string;
  beforeStatus?: ClaimStatus;
  afterStatus?: ClaimStatus;
  evidenceIds?: string[];
  verificationId?: string;
  reason?: string;
  contentHash?: string;
  ruleId?: string;
  ruleVersion?: string;
}

export interface ClaimHistoryPort {
  append(record: ClaimHistoryRecord): void;
  appendOverride?(record: import('../../../domain/claimOverrideCore').ClaimOverrideRecord): void;
}
