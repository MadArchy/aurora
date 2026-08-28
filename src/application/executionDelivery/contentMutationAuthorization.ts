import type { ContentItem } from '../../types';

/**
 * Application-level mutation authorization class for SaveContentDraft.
 * Not persisted — derived from authoritative stored ContentItem fields only.
 * CR-1 WS5 classification remediation R2 (P1 fail-closed).
 */
export type ContentMutationAuthorizationClass =
  | 'STRATEGIC_GOVERNED'
  | 'GENERIC_PROVEN'
  | 'LEGACY_AMBIGUOUS';

/**
 * Repository-supported strategic provenance (SPEC-003 traceability).
 * thesisId alone is never strategic-origin proof.
 */
export function contentHasStrategicProvenance(content: ContentItem): boolean {
  if (content.strategicBriefId?.trim()) return true;
  if (content.signalIds && content.signalIds.length > 0) return true;
  if (content.supportingEvidenceIds && content.supportingEvidenceIds.length > 0) return true;
  return false;
}

/**
 * Authoritative proof that content is standalone/manual/non-strategic.
 *
 * ContentItem currently has no repository field that explicitly marks generic
 * origin (no contentOriginType / isGeneric / equivalent). Absence of strategic
 * refs is NOT generic proof.
 *
 * Result: GENERIC_PROVEN is currently UNREPRESENTABLE in stored data.
 */
export function contentHasAuthoritativeGenericProof(_content: ContentItem): boolean {
  void _content;
  return false;
}

/**
 * Classify mutation authorization from authoritative ContentItem only.
 * Caller DTO / thesisId alone cannot establish GENERIC or STRATEGIC.
 */
export function classifyContentMutationAuthorization(
  content: ContentItem
): ContentMutationAuthorizationClass {
  if (contentHasStrategicProvenance(content)) {
    return 'STRATEGIC_GOVERNED';
  }
  if (contentHasAuthoritativeGenericProof(content)) {
    return 'GENERIC_PROVEN';
  }
  return 'LEGACY_AMBIGUOUS';
}

/** @deprecated Prefer classifyContentMutationAuthorization — kept for call-site clarity. */
export function contentRequiresStrategicBriefAuthorization(content: ContentItem): boolean {
  return classifyContentMutationAuthorization(content) === 'STRATEGIC_GOVERNED';
}
