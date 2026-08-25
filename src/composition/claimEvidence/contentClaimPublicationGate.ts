import type { ClaimPublicationDecision } from '../../domain/claimGateCore';
import type { UserRole } from '../../types';
import { ClaimEvidenceError } from '../../application/claimEvidence';
import { composeClaimEvidence } from './composeClaimEvidence';
import {
  createLocalClaimEvidenceStore,
  type LocalClaimEvidenceStore,
} from '../../infrastructure/claimEvidence';
import { dbService } from '../../services/db';
import { simpleContentHash } from '../../lib/simpleContentHash';

let runtimeStore: LocalClaimEvidenceStore | undefined;

/**
 * Single composition root for SPEC-006 consumers.
 * Adapters only — UI/main must not open postura_claim_* keys directly.
 */
export function getClaimEvidenceRuntime(store?: LocalClaimEvidenceStore) {
  const resolved = store ?? (runtimeStore ??= createLocalClaimEvidenceStore());
  return composeClaimEvidence({
    store: resolved,
    content: {
      getById(contentId: string) {
        const content = dbService.getContentById(contentId);
        if (!content) return undefined;
        return {
          contentId: content.id,
          organizationId: content.organizationId,
          clientId: content.clientId,
          contentHash: simpleContentHash(content.body),
          strategicBriefId: content.strategicBriefId,
          strategicBriefVersion: content.strategicBriefVersion,
        };
      },
    },
    vault: {
      getById: (evidenceId: string) => dbService.getEvidenceById(evidenceId),
    },
  });
}

/** Test helper — reset singleton store between suites. */
export function resetClaimEvidenceRuntimeForTest(): void {
  runtimeStore = undefined;
}

export interface ContentClaimGateInput {
  contentId: string;
  organizationId: string;
  clientId: string;
  targetStatus: string;
  actorId: string;
  actorRole: UserRole;
  now: string;
  /** Never set from browser payload. */
  softwareAuthority?: boolean;
  store?: LocalClaimEvidenceStore;
}

export interface ContentClaimGateResult {
  allowed: boolean;
  reason?: string;
  reasonCode?: string;
  decision?: ClaimPublicationDecision;
}

/**
 * Canonical publication gate for content consumers.
 * Loads current Claims/Verifications via Application AuthorizePublication.
 * Fail-closed on errors. Does not read ContentItem.claimSafety.
 */
export function authorizeContentPublicationGate(
  input: ContentClaimGateInput
): ContentClaimGateResult {
  try {
    const runtime = getClaimEvidenceRuntime(input.store);
    const result = runtime.authorize({
      trusted: {
        actorId: input.actorId,
        actorRole: input.actorRole,
        organizationId: input.organizationId,
        clientId: input.clientId,
        now: input.now,
        softwareAuthority: input.softwareAuthority === true ? true : undefined,
      },
      contentId: input.contentId,
      targetContentStatus: input.targetStatus,
    });
    return {
      allowed: result.decision.allowed,
      reason: result.decision.summary,
      reasonCode: result.decision.reasonCode,
      decision: result.decision,
    };
  } catch (err) {
    if (err instanceof ClaimEvidenceError) {
      return {
        allowed: false,
        reason: err.message,
        reasonCode: err.code,
      };
    }
    return {
      allowed: false,
      reason: 'Claim publication authorization failed.',
      reasonCode: 'PERSISTENCE_ERROR',
    };
  }
}
