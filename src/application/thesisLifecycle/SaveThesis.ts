import type { PositioningThesis, ThesisEditableFields } from '../../types';
import { assertThesisReadyForReview } from '../../domain/thesisModelCore';
import {
  planThesisSave,
  type ThesisSaveIntent,
} from '../../domain/thesisRevisionCore';
import { ThesisLifecycleError } from './errors';
import type { ThesisRepository } from './ports/ThesisRepository';
import {
  assertNoThesisSpoof,
  assertTrustedThesisContext,
  requireAdminRole,
  type TrustedThesisLifecycleContext,
} from './trustedContext';

export interface SaveThesisInput {
  trusted: TrustedThesisLifecycleContext;
  /** Explicit thesis id — required for multi-thesis (new or existing). */
  thesisId: string;
  intent: ThesisSaveIntent;
  fields: ThesisEditableFields;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedClientApprovalStatus?: string;
}

export interface SaveThesisResult {
  thesis: PositioningThesis;
  toast: string;
  notifyClient: boolean;
  intent: ThesisSaveIntent;
}

export interface SaveThesisDeps {
  theses: ThesisRepository;
}

/**
 * CR-1 #11 — SaveThesis (draft | submit_review).
 * Domain: planThesisSave + assertThesisReadyForReview.
 */
export function createSaveThesis(deps: SaveThesisDeps) {
  return function saveThesis(input: SaveThesisInput): SaveThesisResult {
    assertTrustedThesisContext(input.trusted);
    requireAdminRole(input.trusted);
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
    if (!input.fields?.title?.trim() || !input.fields?.expertIdentity?.trim()) {
      throw new ThesisLifecycleError(
        'INVALID_INPUT',
        'Título e identidad objetivo son obligatorios.'
      );
    }
    if (input.intent !== 'draft' && input.intent !== 'submit_review') {
      throw new ThesisLifecycleError('INVALID_INPUT', 'intent must be draft or submit_review.');
    }

    const existing = deps.theses.getById(input.trusted.clientId, thesisId);
    if (existing) {
      if (existing.organizationId !== input.trusted.organizationId) {
        throw new ThesisLifecycleError(
          'TENANT_CONTEXT_INVALID',
          'Thesis organization does not match trusted session.'
        );
      }
      if (existing.clientId !== input.trusted.clientId) {
        throw new ThesisLifecycleError(
          'TENANT_CONTEXT_INVALID',
          'Thesis does not belong to the trusted client.'
        );
      }
    }

    if (input.intent === 'submit_review') {
      const candidate: PositioningThesis = {
        id: thesisId,
        organizationId: input.trusted.organizationId,
        clientId: input.trusted.clientId,
        ...input.fields,
        status: existing?.status || 'DRAFT',
        clientApprovalStatus: existing?.clientApprovalStatus || 'PENDING',
        createdAt: existing?.createdAt || input.trusted.now,
        createdBy: existing?.createdBy || input.trusted.actorId,
        updatedAt: input.trusted.now,
        updatedBy: input.trusted.actorId,
      };
      const readiness = assertThesisReadyForReview(candidate);
      if (!readiness.ready) {
        const preview = readiness.blockers.slice(0, 4).join(' · ');
        throw new ThesisLifecycleError(
          'NOT_READY_FOR_REVIEW',
          `Estructura ${readiness.score}/100. Completa: ${preview}`
        );
      }
    }

    const plan = planThesisSave(
      existing,
      input.fields,
      input.trusted.actorId,
      input.trusted.now,
      input.intent
    );

    const thesis: PositioningThesis =
      plan.keepActive && existing
        ? {
            ...existing,
            pendingRevision: plan.pendingRevision,
            clientApprovalStatus: plan.clientApprovalStatus,
            status: plan.status,
            updatedAt: input.trusted.now,
            updatedBy: input.trusted.actorId,
          }
        : {
            id: thesisId,
            organizationId: input.trusted.organizationId,
            clientId: input.trusted.clientId,
            ...input.fields,
            status: plan.status,
            clientApprovalStatus: plan.clientApprovalStatus,
            pendingRevision: plan.pendingRevision,
            createdAt: existing?.createdAt || input.trusted.now,
            createdBy: existing?.createdBy || input.trusted.actorId,
            updatedAt: input.trusted.now,
            updatedBy: input.trusted.actorId,
          };

    try {
      deps.theses.save(thesis);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save thesis.';
      if (/quota|límite|limit/i.test(message)) {
        throw new ThesisLifecycleError('QUOTA_EXCEEDED', message);
      }
      throw new ThesisLifecycleError('PERSISTENCE_ERROR', message);
    }

    return {
      thesis,
      toast: plan.toast,
      notifyClient: plan.notifyClient,
      intent: input.intent,
    };
  };
}
