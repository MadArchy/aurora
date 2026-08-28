import type { PositioningThesis } from '../../types';
import { activateThesisByManager } from '../../domain/thesisRevisionCore';
import { ThesisLifecycleError } from './errors';
import type { ThesisRepository } from './ports/ThesisRepository';
import {
  assertNoThesisSpoof,
  assertTrustedThesisContext,
  requireAdminRole,
  type TrustedThesisLifecycleContext,
} from './trustedContext';

export interface ActivateThesisInput {
  trusted: TrustedThesisLifecycleContext;
  /** Explicit thesis id — required. */
  thesisId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedClientApprovalStatus?: string;
}

export interface ActivateThesisResult {
  thesis: PositioningThesis;
}

export interface ActivateThesisDeps {
  theses: ThesisRepository;
}

/**
 * CR-1 #12 — ActivateThesis (manager).
 * Domain: activateThesisByManager / canActivateThesis.
 */
export function createActivateThesis(deps: ActivateThesisDeps) {
  return function activateThesis(input: ActivateThesisInput): ActivateThesisResult {
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
        'Thesis does not belong to the trusted client.'
      );
    }

    let thesis: PositioningThesis;
    try {
      thesis = activateThesisByManager(
        {
          ...existing,
          updatedAt: input.trusted.now,
          updatedBy: input.trusted.actorId,
        },
        input.trusted.actorId,
        input.trusted.now
      );
    } catch (err) {
      throw new ThesisLifecycleError(
        'INVALID_TRANSITION',
        err instanceof Error ? err.message : 'No se puede activar la tesis.'
      );
    }

    try {
      deps.theses.save(thesis);
    } catch (err) {
      throw new ThesisLifecycleError(
        'PERSISTENCE_ERROR',
        err instanceof Error ? err.message : 'Failed to persist thesis activation.'
      );
    }

    return { thesis };
  };
}
