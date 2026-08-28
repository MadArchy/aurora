import type { ContentItem, ContentStatus } from '../../types';
import {
  assertContentPipelineTransition,
  mapLegacyContentStatus,
  resolvePipelineStepsToTarget,
} from '../../domain/contentPipeline';
import { assertClaimSafeTransition } from '../../domain/claimSafetyGateCore';
import { ExecutionDeliveryError } from './errors';
import type {
  ContentDraftFields,
  ContentPublicationGatePort,
  ContentRepository,
} from './ports/ContentRepository';
import {
  assertNoExecutionSpoof,
  assertTrustedExecutionContext,
  requireAdminRole,
  type TrustedExecutionDeliveryContext,
} from './trustedContext';

export interface SaveContentDraftInput {
  trusted: TrustedExecutionDeliveryContext;
  contentId: string;
  fields: ContentDraftFields;
  /**
   * Intent to advance lifecycle after draft persist — not caller authority.
   * Application reloads content and applies Domain + SPEC-006 gate when gated.
   */
  requestedTargetStatus?: ContentStatus;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedPipelineStatus?: string;
  claimedPublicationState?: string;
  claimedClaimSafetyVerdict?: string;
}

export interface SaveContentDraftResult {
  content: ContentItem;
  advanced: boolean;
}

export interface SaveContentDraftDeps {
  contents: ContentRepository;
  publicationGate: ContentPublicationGatePort;
}

/**
 * CR-1 #31 — SaveContentDraft.
 * Persists editable draft fields; preserves strategic refs from authoritative content.
 * Gated advances consume SPEC-006 AuthorizePublication — do not own claim safety.
 */
export function createSaveContentDraft(deps: SaveContentDraftDeps) {
  return function saveContentDraft(input: SaveContentDraftInput): SaveContentDraftResult {
    assertTrustedExecutionContext(input.trusted);
    requireAdminRole(input.trusted);
    assertNoExecutionSpoof({
      trusted: input.trusted,
      claimedOrganizationId: input.claimedOrganizationId,
      claimedClientId: input.claimedClientId,
      claimedStatus: input.claimedStatus,
      claimedPipelineStatus: input.claimedPipelineStatus,
      claimedPublicationState: input.claimedPublicationState,
      claimedClaimSafetyVerdict: input.claimedClaimSafetyVerdict,
    });

    const contentId = input.contentId?.trim();
    if (!contentId) {
      throw new ExecutionDeliveryError('INVALID_INPUT', 'contentId is required.');
    }

    const existing = deps.contents.getById(contentId);
    if (!existing) {
      throw new ExecutionDeliveryError('CONTENT_NOT_FOUND', 'Contenido no encontrado.');
    }
    if (existing.organizationId !== input.trusted.organizationId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Content organization does not match trusted session.'
      );
    }
    if (existing.clientId !== input.trusted.clientId) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Content does not belong to the trusted client.'
      );
    }
    if (!existing.thesisId?.trim()) {
      throw new ExecutionDeliveryError(
        'INVALID_INPUT',
        'Content must reference an authoritative thesisId (existing product rule).'
      );
    }

    let content = deps.contents.saveDraft(contentId, input.fields, input.trusted.now);

    let advanced = false;
    if (input.requestedTargetStatus && input.requestedTargetStatus !== content.status) {
      const canonical = deps.publicationGate.authorize({
        contentId: content.id,
        organizationId: content.organizationId,
        clientId: content.clientId,
        targetStatus: input.requestedTargetStatus,
        actorId: input.trusted.actorId,
        actorRole: input.trusted.actorRole === 'CLIENT' ? 'CLIENT' : 'ADMIN',
        now: input.trusted.now,
      });
      const gate = assertClaimSafeTransition(content.status, input.requestedTargetStatus, content.claimSafety, {
        canonical: {
          allowed: canonical.allowed,
          reason: canonical.reason,
          reasonCode: canonical.reasonCode,
        },
      });
      if (!gate.allowed) {
        throw new ExecutionDeliveryError(
          'PUBLICATION_GATE_DENIED',
          gate.reason || 'Claim publication gate blocks advancement.'
        );
      }

      const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
      const target = mapLegacyContentStatus(input.requestedTargetStatus);
      if (current !== target) {
        try {
          const steps = resolvePipelineStepsToTarget(current, target);
          for (const step of steps) {
            assertContentPipelineTransition(
              content.pipelineStatus || mapLegacyContentStatus(content.status),
              step,
              'ADMIN'
            );
            content = deps.contents.transitionPipeline({
              contentId,
              next: step,
              actor: { uid: input.trusted.actorId, role: 'ADMIN' },
            });
          }
          advanced = true;
        } catch (err) {
          throw new ExecutionDeliveryError(
            'INVALID_TRANSITION',
            err instanceof Error ? err.message : 'Content pipeline transition denied.'
          );
        }
      }
    }

    return { content, advanced };
  };
}
