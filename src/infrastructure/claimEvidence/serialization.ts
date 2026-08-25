import {
  CLAIM_SCHEMA_VERSION,
  isClaimKind,
  isClaimStatus,
  type Claim,
} from '../../domain/claimCore';
import type { ClaimEvidenceLink } from '../../domain/claimLinkCore';
import type { ClaimOverrideRecord } from '../../domain/claimOverrideCore';
import {
  CLAIM_SOURCE_TYPES,
  type ClaimSource,
  type ClaimSourceType,
} from '../../domain/claimSourceCore';
import {
  isAuthoritativeVerificationActor,
  VERIFICATION_RESULTS,
  type ClaimVerification,
  type VerificationResult,
} from '../../domain/claimVerificationCore';
import {
  CLAIM_EVIDENCE_SCHEMA_VERSION,
  type ClaimEvidence,
} from '../../domain/evidenceCore';
import type { ClaimHistoryRecord } from '../../application/claimEvidence/ports/ClaimHistoryPort';
import {
  claimLinkMaterialFingerprint,
  claimOverrideMaterialFingerprint,
} from '../../domain/claimMaterialityCore';
import { persistenceError } from './persistenceErrors';

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw persistenceError(`Malformed persisted ${label}.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, field: string, label: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw persistenceError(`Malformed persisted ${label}: ${field} is required.`);
  }
  return value;
}

function requiredNumber(record: Record<string, unknown>, field: string, label: string): number {
  const value = record[field];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw persistenceError(`Malformed persisted ${label}: ${field} is required.`);
  }
  return value;
}

function requiredStringArray(record: Record<string, unknown>, field: string, label: string): string[] {
  const value = record[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw persistenceError(`Malformed persisted ${label}: ${field} is required.`);
  }
  return [...value];
}

export function peekTenant(raw: unknown): { organizationId: string; clientId: string } | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  if (typeof record.organizationId === 'string' && typeof record.clientId === 'string') {
    return { organizationId: record.organizationId, clientId: record.clientId };
  }
  return undefined;
}

export function peekId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const id = (raw as Record<string, unknown>).id;
  return typeof id === 'string' ? id : undefined;
}

export function tenantEntityKey(
  organizationId: string,
  clientId: string,
  id: string
): string {
  return `${organizationId}|${clientId}|${id}`;
}

export function linkLookupKey(
  organizationId: string,
  clientId: string,
  claimId: string,
  evidenceId: string
): string {
  return `${organizationId}|${clientId}|${claimId}|${evidenceId}`;
}

function parseSource(raw: unknown): ClaimSource {
  const record = asRecord(raw, 'ClaimSource');
  const sourceType = record.sourceType;
  if (
    sourceType !== undefined &&
    (typeof sourceType !== 'string' ||
      !(CLAIM_SOURCE_TYPES as readonly string[]).includes(sourceType))
  ) {
    throw persistenceError('Malformed persisted ClaimSource: sourceType is unsupported.');
  }
  const source: ClaimSource = {
    sourceUrl: typeof record.sourceUrl === 'string' ? record.sourceUrl : undefined,
    publisher: typeof record.publisher === 'string' ? record.publisher : undefined,
    sourceType: sourceType as ClaimSourceType | undefined,
    publishedAt: typeof record.publishedAt === 'string' ? record.publishedAt : undefined,
    retrievedAt: typeof record.retrievedAt === 'string' ? record.retrievedAt : undefined,
    jurisdiction: typeof record.jurisdiction === 'string' ? record.jurisdiction : undefined,
    reliabilityNote:
      typeof record.reliabilityNote === 'string' ? record.reliabilityNote : undefined,
    unknownReason: typeof record.unknownReason === 'string' ? record.unknownReason : undefined,
  };
  const hasAny =
    source.sourceUrl ||
    source.publisher ||
    source.sourceType ||
    source.publishedAt ||
    source.retrievedAt ||
    source.jurisdiction ||
    source.reliabilityNote;
  if (!hasAny) {
    throw persistenceError('Malformed persisted ClaimSource: provenance is required.');
  }
  if (source.sourceType === 'UNKNOWN' && !source.unknownReason) {
    throw persistenceError('Malformed persisted ClaimSource: UNKNOWN requires unknownReason.');
  }
  return source;
}

/**
 * Fail-closed Claim parse. Never defaults tenant, status, contentHash, or schemaVersion.
 */
export function parseStoredClaim(raw: unknown): Claim {
  const record = asRecord(raw, 'Claim');
  const schemaVersion = record.schemaVersion;
  if (schemaVersion !== CLAIM_SCHEMA_VERSION) {
    throw persistenceError('Malformed persisted Claim: unsupported schemaVersion.');
  }
  const status = record.status;
  if (!isClaimStatus(status)) {
    throw persistenceError('Malformed persisted Claim: status is unsupported.');
  }
  const kind = record.kind;
  if (!isClaimKind(kind)) {
    throw persistenceError('Malformed persisted Claim: kind is unsupported.');
  }
  const claim: Claim = {
    id: requiredString(record, 'id', 'Claim'),
    organizationId: requiredString(record, 'organizationId', 'Claim'),
    clientId: requiredString(record, 'clientId', 'Claim'),
    contentId: requiredString(record, 'contentId', 'Claim'),
    contentHash: requiredString(record, 'contentHash', 'Claim'),
    text: requiredString(record, 'text', 'Claim'),
    kind,
    status,
    thesisId: typeof record.thesisId === 'string' ? record.thesisId : undefined,
    strategicBriefId:
      typeof record.strategicBriefId === 'string' ? record.strategicBriefId : undefined,
    strategicBriefVersion:
      typeof record.strategicBriefVersion === 'number' &&
      Number.isInteger(record.strategicBriefVersion)
        ? record.strategicBriefVersion
        : undefined,
    createdAt: requiredString(record, 'createdAt', 'Claim'),
    updatedAt: requiredString(record, 'updatedAt', 'Claim'),
    createdBy: requiredString(record, 'createdBy', 'Claim'),
    schemaVersion: CLAIM_SCHEMA_VERSION,
    version: requiredNumber(record, 'version', 'Claim'),
  };
  return cloneJson(claim);
}

export function parseStoredLink(raw: unknown): ClaimEvidenceLink {
  const record = asRecord(raw, 'ClaimEvidenceLink');
  const link: ClaimEvidenceLink = {
    id: requiredString(record, 'id', 'ClaimEvidenceLink'),
    organizationId: requiredString(record, 'organizationId', 'ClaimEvidenceLink'),
    clientId: requiredString(record, 'clientId', 'ClaimEvidenceLink'),
    claimId: requiredString(record, 'claimId', 'ClaimEvidenceLink'),
    evidenceId: requiredString(record, 'evidenceId', 'ClaimEvidenceLink'),
    createdAt: requiredString(record, 'createdAt', 'ClaimEvidenceLink'),
    createdBy: requiredString(record, 'createdBy', 'ClaimEvidenceLink'),
    note: typeof record.note === 'string' ? record.note : undefined,
  };
  return cloneJson(link);
}

export function parseStoredVerification(raw: unknown): ClaimVerification {
  const record = asRecord(raw, 'ClaimVerification');
  const result = record.result;
  if (typeof result !== 'string' || !(VERIFICATION_RESULTS as readonly string[]).includes(result)) {
    throw persistenceError('Malformed persisted ClaimVerification: result is unsupported.');
  }
  const actorType = record.actorType;
  if (typeof actorType !== 'string' || !isAuthoritativeVerificationActor(actorType)) {
    throw persistenceError('Malformed persisted ClaimVerification: actorType is unsupported.');
  }
  const claimStatusAfter = record.claimStatusAfter;
  if (!isClaimStatus(claimStatusAfter)) {
    throw persistenceError('Malformed persisted ClaimVerification: claimStatusAfter is unsupported.');
  }
  const verification: ClaimVerification = {
    id: requiredString(record, 'id', 'ClaimVerification'),
    claimId: requiredString(record, 'claimId', 'ClaimVerification'),
    organizationId: requiredString(record, 'organizationId', 'ClaimVerification'),
    clientId: requiredString(record, 'clientId', 'ClaimVerification'),
    result: result as VerificationResult,
    claimStatusAfter,
    actorType,
    actorId: requiredString(record, 'actorId', 'ClaimVerification'),
    ruleId: requiredString(record, 'ruleId', 'ClaimVerification'),
    ruleVersion: requiredString(record, 'ruleVersion', 'ClaimVerification'),
    evidenceIds: requiredStringArray(record, 'evidenceIds', 'ClaimVerification'),
    summary: requiredString(record, 'summary', 'ClaimVerification'),
    createdAt: requiredString(record, 'createdAt', 'ClaimVerification'),
    contentHash: requiredString(record, 'contentHash', 'ClaimVerification'),
  };
  return cloneJson(verification);
}

export function parseStoredEvidence(raw: unknown): ClaimEvidence {
  const record = asRecord(raw, 'ClaimEvidence');
  if (record.schemaVersion !== CLAIM_EVIDENCE_SCHEMA_VERSION) {
    throw persistenceError('Malformed persisted ClaimEvidence: unsupported schemaVersion.');
  }
  if (typeof record.type !== 'string' || record.type.trim().length === 0) {
    throw persistenceError('Malformed persisted ClaimEvidence: type is required.');
  }
  if (
    typeof record.confidenceScore !== 'number' ||
    Number.isNaN(record.confidenceScore) ||
    record.confidenceScore < 0 ||
    record.confidenceScore > 100
  ) {
    throw persistenceError('Malformed persisted ClaimEvidence: confidenceScore is invalid.');
  }
  const evidence: ClaimEvidence = {
    id: requiredString(record, 'id', 'ClaimEvidence'),
    organizationId: requiredString(record, 'organizationId', 'ClaimEvidence'),
    clientId: requiredString(record, 'clientId', 'ClaimEvidence'),
    title: requiredString(record, 'title', 'ClaimEvidence'),
    type: record.type as ClaimEvidence['type'],
    snippet: requiredString(record, 'snippet', 'ClaimEvidence'),
    source: parseSource(record.source),
    confidenceScore: record.confidenceScore,
    authorityWeight:
      typeof record.authorityWeight === 'number' ? record.authorityWeight : undefined,
    associatedThesesIds: requiredStringArray(record, 'associatedThesesIds', 'ClaimEvidence'),
    supports: Array.isArray(record.supports)
      ? requiredStringArray(record, 'supports', 'ClaimEvidence')
      : undefined,
    createdAt: requiredString(record, 'createdAt', 'ClaimEvidence'),
    schemaVersion: CLAIM_EVIDENCE_SCHEMA_VERSION,
    version: requiredNumber(record, 'version', 'ClaimEvidence'),
  };
  return cloneJson(evidence);
}

const HISTORY_EVENTS: ReadonlySet<ClaimHistoryRecord['event']> = new Set([
  'CLAIM_REGISTERED',
  'CLAIM_EXTRACTED',
  'EVIDENCE_LINKED',
  'EVIDENCE_REQUIRED',
  'RESEARCH_REQUIRED',
  'CLAIM_REVIEWED',
  'CLAIM_VERIFIED',
  'CLAIM_REJECTED',
  'CLAIM_OVERRIDDEN',
  'PUBLICATION_AUTHORIZED',
  'PUBLICATION_DENIED',
]);

export function parseStoredHistory(raw: unknown): ClaimHistoryRecord {
  const record = asRecord(raw, 'ClaimHistory');
  const event = record.event;
  if (typeof event !== 'string' || !HISTORY_EVENTS.has(event as ClaimHistoryRecord['event'])) {
    throw persistenceError('Malformed persisted ClaimHistory: event is unsupported.');
  }
  const entry: ClaimHistoryRecord = {
    id: requiredString(record, 'id', 'ClaimHistory'),
    organizationId: requiredString(record, 'organizationId', 'ClaimHistory'),
    clientId: requiredString(record, 'clientId', 'ClaimHistory'),
    claimId: requiredString(record, 'claimId', 'ClaimHistory'),
    event: event as ClaimHistoryRecord['event'],
    actorId: requiredString(record, 'actorId', 'ClaimHistory'),
    at: requiredString(record, 'at', 'ClaimHistory'),
    beforeStatus:
      record.beforeStatus === undefined
        ? undefined
        : isClaimStatus(record.beforeStatus)
          ? record.beforeStatus
          : (() => {
              throw persistenceError('Malformed persisted ClaimHistory: beforeStatus is unsupported.');
            })(),
    afterStatus:
      record.afterStatus === undefined
        ? undefined
        : isClaimStatus(record.afterStatus)
          ? record.afterStatus
          : (() => {
              throw persistenceError('Malformed persisted ClaimHistory: afterStatus is unsupported.');
            })(),
    evidenceIds: Array.isArray(record.evidenceIds)
      ? requiredStringArray(record, 'evidenceIds', 'ClaimHistory')
      : undefined,
    verificationId:
      typeof record.verificationId === 'string' ? record.verificationId : undefined,
    reason: typeof record.reason === 'string' ? record.reason : undefined,
    contentHash: typeof record.contentHash === 'string' ? record.contentHash : undefined,
    ruleId: typeof record.ruleId === 'string' ? record.ruleId : undefined,
    ruleVersion: typeof record.ruleVersion === 'string' ? record.ruleVersion : undefined,
  };
  return cloneJson(entry);
}

export function parseStoredOverride(raw: unknown): ClaimOverrideRecord {
  const record = asRecord(raw, 'ClaimOverride');
  if (record.actorType !== 'HUMAN') {
    throw persistenceError('Malformed persisted ClaimOverride: actorType must be HUMAN.');
  }
  if (record.nextStatus !== 'OVERRIDDEN') {
    throw persistenceError('Malformed persisted ClaimOverride: nextStatus must be OVERRIDDEN.');
  }
  if (!isClaimStatus(record.previousStatus)) {
    throw persistenceError('Malformed persisted ClaimOverride: previousStatus is unsupported.');
  }
  const override: ClaimOverrideRecord = {
    claimId: requiredString(record, 'claimId', 'ClaimOverride'),
    organizationId: requiredString(record, 'organizationId', 'ClaimOverride'),
    clientId: requiredString(record, 'clientId', 'ClaimOverride'),
    actorType: 'HUMAN',
    actorId: requiredString(record, 'actorId', 'ClaimOverride'),
    reason: requiredString(record, 'reason', 'ClaimOverride'),
    previousStatus: record.previousStatus,
    nextStatus: 'OVERRIDDEN',
    claimVersion: requiredNumber(record, 'claimVersion', 'ClaimOverride'),
    contentVersion:
      typeof record.contentVersion === 'string' ? record.contentVersion : undefined,
    contentHash: requiredString(record, 'contentHash', 'ClaimOverride'),
    createdAt: requiredString(record, 'createdAt', 'ClaimOverride'),
  };
  return cloneJson(override);
}

export function historyIdentity(entry: ClaimHistoryRecord): string {
  return entry.id;
}

export function overrideIdentity(entry: ClaimOverrideRecord): string {
  return claimOverrideMaterialFingerprint(entry);
}

export function linkIdentity(entry: ClaimEvidenceLink): string {
  return claimLinkMaterialFingerprint(entry);
}
