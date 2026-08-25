/**
 * SPEC-006 Phase 1 — Source value object (evidence provenance).
 * Not a news-source intelligence subsystem.
 */

import { claimFail, claimOk, type ClaimDomainResult } from './claimEvidenceErrors';

export const CLAIM_SOURCE_TYPES = [
  'PRIMARY',
  'SECONDARY',
  'INTERNAL',
  'UNKNOWN',
] as const;
export type ClaimSourceType = (typeof CLAIM_SOURCE_TYPES)[number];

/** Minimal Source metadata (claim-model.md). Tenant inherited via Evidence. */
export interface ClaimSource {
  sourceUrl?: string;
  publisher?: string;
  sourceType?: ClaimSourceType;
  publishedAt?: string;
  retrievedAt?: string;
  jurisdiction?: string;
  reliabilityNote?: string;
  /** Required when sourceType is UNKNOWN — explains missing provenance. */
  unknownReason?: string;
}

export interface CreateClaimSourceInput {
  sourceUrl?: string;
  publisher?: string;
  sourceType?: ClaimSourceType;
  publishedAt?: string;
  retrievedAt?: string;
  jurisdiction?: string;
  reliabilityNote?: string;
  unknownReason?: string;
}

function optionalTrimmed(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function createClaimSource(
  input: CreateClaimSourceInput = {}
): ClaimDomainResult<ClaimSource> {
  const sourceType = input.sourceType;
  if (sourceType !== undefined && !CLAIM_SOURCE_TYPES.includes(sourceType)) {
    return claimFail('INVALID_SOURCE', 'sourceType is not a canonical ClaimSourceType');
  }

  const source: ClaimSource = {
    sourceUrl: optionalTrimmed(input.sourceUrl),
    publisher: optionalTrimmed(input.publisher),
    sourceType,
    publishedAt: optionalTrimmed(input.publishedAt),
    retrievedAt: optionalTrimmed(input.retrievedAt),
    jurisdiction: optionalTrimmed(input.jurisdiction),
    reliabilityNote: optionalTrimmed(input.reliabilityNote),
    unknownReason: optionalTrimmed(input.unknownReason),
  };

  if (source.sourceType === 'UNKNOWN' && !source.unknownReason) {
    return claimFail(
      'INVALID_SOURCE',
      'UNKNOWN sourceType requires unknownReason'
    );
  }

  const hasAny =
    source.sourceUrl ||
    source.publisher ||
    source.sourceType ||
    source.publishedAt ||
    source.retrievedAt ||
    source.jurisdiction ||
    source.reliabilityNote;

  if (!hasAny) {
    return claimFail(
      'INVALID_SOURCE',
      'Source must include at least one provenance field (or UNKNOWN with reason)'
    );
  }

  return claimOk(source);
}

/** Stable fingerprint for materiality (order-independent field set). */
export function claimSourceFingerprint(source: ClaimSource): string {
  return [
    source.sourceType ?? '',
    source.sourceUrl ?? '',
    source.publisher ?? '',
    source.publishedAt ?? '',
    source.retrievedAt ?? '',
    source.jurisdiction ?? '',
    source.reliabilityNote ?? '',
    source.unknownReason ?? '',
  ].join('|');
}
