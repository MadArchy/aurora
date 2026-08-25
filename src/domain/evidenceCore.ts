/**
 * SPEC-006 Phase 1 — Evidence entity (adapts EvidenceVaultItem contract).
 * Legacy `verified: boolean` is NOT Verification authority.
 */

import type { EvidenceType } from '../types';
import { claimFail, claimOk, type ClaimDomainResult } from './claimEvidenceErrors';
import {
  claimSourceFingerprint,
  createClaimSource,
  type ClaimSource,
  type CreateClaimSourceInput,
} from './claimSourceCore';
import {
  assertClaimTenantStructure,
  type ClaimTenantEnvelope,
} from './claimTenantCore';

export const CLAIM_EVIDENCE_SCHEMA_VERSION = 'evidence-v1' as const;

export interface ClaimEvidence {
  id: string;
  organizationId: string;
  clientId: string;
  title: string;
  type: EvidenceType;
  snippet: string;
  source: ClaimSource;
  confidenceScore: number;
  authorityWeight?: number;
  associatedThesesIds: string[];
  supports?: string[];
  createdAt: string;
  schemaVersion: typeof CLAIM_EVIDENCE_SCHEMA_VERSION;
  version: number;
}

export interface CreateClaimEvidenceInput {
  id: string;
  organizationId: string;
  clientId: string;
  title: string;
  type: EvidenceType;
  snippet: string;
  source: CreateClaimSourceInput | ClaimSource;
  confidenceScore: number;
  authorityWeight?: number;
  associatedThesesIds?: string[];
  supports?: string[];
  createdAt: string;
  version?: number;
}

function nonEmpty(value: unknown, field: string): ClaimDomainResult<string> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return claimFail('INVALID_EVIDENCE', `${field} is required`);
  }
  return claimOk(value.trim());
}

export function createClaimEvidence(
  input: CreateClaimEvidenceInput
): ClaimDomainResult<ClaimEvidence> {
  const tenant = assertClaimTenantStructure({
    organizationId: input.organizationId,
    clientId: input.clientId,
  });
  if (!tenant.ok) {
    return claimFail('INVALID_EVIDENCE', tenant.error.message);
  }

  const id = nonEmpty(input.id, 'id');
  if (!id.ok) return id;
  const title = nonEmpty(input.title, 'title');
  if (!title.ok) return title;
  const snippet = nonEmpty(input.snippet, 'snippet');
  if (!snippet.ok) return snippet;
  const createdAt = nonEmpty(input.createdAt, 'createdAt');
  if (!createdAt.ok) return createdAt;

  if (typeof input.type !== 'string' || input.type.trim().length === 0) {
    return claimFail('INVALID_EVIDENCE', 'type is required');
  }

  if (
    typeof input.confidenceScore !== 'number' ||
    Number.isNaN(input.confidenceScore) ||
    input.confidenceScore < 0 ||
    input.confidenceScore > 100
  ) {
    return claimFail('INVALID_EVIDENCE', 'confidenceScore must be 0–100');
  }

  if (
    input.authorityWeight !== undefined &&
    (typeof input.authorityWeight !== 'number' ||
      Number.isNaN(input.authorityWeight) ||
      input.authorityWeight < 0 ||
      input.authorityWeight > 100)
  ) {
    return claimFail('INVALID_EVIDENCE', 'authorityWeight must be 0–100 when set');
  }

  const sourceResult = createClaimSource(input.source);
  if (!sourceResult.ok) return sourceResult;

  const associatedThesesIds = (input.associatedThesesIds ?? [])
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean);

  const supports = input.supports
    ?.map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);

  const version = input.version ?? 1;
  if (!Number.isInteger(version) || version < 1) {
    return claimFail('INVALID_EVIDENCE', 'version must be a positive integer');
  }

  return claimOk({
    id: id.value,
    organizationId: tenant.value.organizationId,
    clientId: tenant.value.clientId,
    title: title.value,
    type: input.type,
    snippet: snippet.value,
    source: sourceResult.value,
    confidenceScore: input.confidenceScore,
    authorityWeight: input.authorityWeight,
    associatedThesesIds,
    supports: supports?.length ? supports : undefined,
    createdAt: createdAt.value,
    schemaVersion: CLAIM_EVIDENCE_SCHEMA_VERSION,
    version,
  });
}

export function evidenceTenantOf(evidence: ClaimEvidence): ClaimTenantEnvelope {
  return {
    organizationId: evidence.organizationId,
    clientId: evidence.clientId,
  };
}

export function claimEvidenceFingerprint(evidence: ClaimEvidence): string {
  return [
    evidence.id,
    evidence.organizationId,
    evidence.clientId,
    evidence.title,
    evidence.type,
    evidence.snippet,
    claimSourceFingerprint(evidence.source),
    String(evidence.confidenceScore),
    String(evidence.authorityWeight ?? ''),
    [...evidence.associatedThesesIds].sort().join(','),
    [...(evidence.supports ?? [])].sort().join(','),
    String(evidence.version),
  ].join('::');
}
