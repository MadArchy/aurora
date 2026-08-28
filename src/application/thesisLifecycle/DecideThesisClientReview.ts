import type { PositioningThesis } from '../../types';
import {
  approveThesisByClient,
  rejectThesisByClient,
} from '../../domain/thesisRevisionCore';
import { ThesisLifecycleError } from './errors';
import type { ThesisRepository } from './ports/ThesisRepository';
import {
  assertNoThesisSpoof,
  assertTrustedThesisContext,
  requireClientRole,
  type TrustedThesisLifecycleContext,
} from './trustedContext';

export type ThesisClientReviewDecision = 'approve' | 'request_changes';

export interface DecideThesisClientReviewInput {
  trusted: TrustedThesisLifecycleContext;
  /** Explicit thesis id — required. */
  thesisId: string;
  decision: ThesisClientReviewDecision;
  feedback?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedClientApprovalStatus?: string;
}

export interface DecideThesisClientReviewResult {
  thesis: PositioningThesis;
  decision: ThesisClientReviewDecision;
  appliedRevision: boolean;
  awaitsManagerActivation: boolean;
}

export interface DecideThesisClientReviewDeps {
  theses: ThesisRepository;
}

/**
 * CR-1 #13 — DecideThesisClientReview (approve | request_changes).
 * Domain: approveThesisByClient / rejectThesisByClient.
 */
export function createDecideThesisClientReview(deps: DecideThesisClientReviewDeps) {
  return function decideThesisClientReview(
    input: DecideThesisClientReviewInput
  ): DecideThesisClientReviewResult {
    assertTrustedThesisContext(input.trusted);
    requireClientRole(input.trusted);
    assertNoThesisSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
      claimedStatus: input.claimedStatus,
      claimedClientApprovalStatus: input.claimedClientApprovalStatus,
    });

    const thesisId = input.thesisId?.trim();
    if (!thesisId) {
      throw new ThesisLifecycleError('INVALID_INPUT', 'thesisId is required (no positional thesis).');
    }
    if (input.decision !== 'approve' && input.decision !== 'request_changes') {
      throw new ThesisLifecycleError(
        'INVALID_INPUT',
        'decision must be approve or request_changes.'
      );
    }

    const existing = deps.theses.getById(input.trusted.clientId, thesisId);
    if (!existing) {
      throw new ThesisLifecycleError('THESIS_NOT_FOUND', 'Tesis no encontrada.');
    }
    if (existing.organizationId !== input.trusted.organizationId) {
      throw new ThesisLifecycleError(
        'TENANT_CONTEXT_INVALID',
        'Thesis organization does not match trusted session.'
      );
    }
    if (existing.clientId !== input.trusted.clientId) {
      throw new ThesisLifecycleError(
        'TENANT_CONTEXT_INVALID',
        'Thesis does not belong to the authenticated client.'
      );
    }

    let thesis: PositioningThesis;
    let appliedRevision = false;
    let awaitsManagerActivation = false;

    try {
      if (input.decision === 'approve') {
        const result = approveThesisByClient(
          {
            ...existing,
            updatedAt: input.trusted.now,
            updatedBy: input.trusted.actorId,
          },
          input.trusted.actorId,
          input.trusted.now
        );
        thesis = result.thesis;
        appliedRevision = result.appliedRevision;
        awaitsManagerActivation = result.awaitsManagerActivation;
      } else {
        thesis = rejectThesisByClient(
          {
            ...existing,
            updatedAt: input.trusted.now,
            updatedBy: input.trusted.actorId,
          },
          input.feedback,
          input.trusted.actorId,
          input.trusted.now
        );
      }
    } catch (err) {
      throw new ThesisLifecycleError(
        'INVALID_TRANSITION',
        err instanceof Error ? err.message : 'Invalid thesis client review transition.'
      );
    }

    try {
      deps.theses.save(thesis);
    } catch (err) {
      throw new ThesisLifecycleError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to persist thesis review.'
      );
    }

    return {
      thesis,
      decision: input.decision,
      appliedRevision,
      awaitsManagerActivation,
    };
  };
}
