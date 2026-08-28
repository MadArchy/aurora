import type { ContentItem, ContentStatus } from '../../types';
import {
  assertContentPipelineTransition,
  mapLegacyContentStatus,
  resolvePipelineStepsToTarget,
} from '../../domain/contentPipeline';
import { assertClaimSafeTransition } from '../../domain/claimSafetyGateCore';
import {
  classifyContentMutationAuthorization,
} from './contentMutationAuthorization';
import { ExecutionDeliveryError } from './errors';
import type {
  ContentDraftFields,
  ContentPublicationGatePort,
  ContentRepository,
  ContentStrategicBriefGatePort,
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
  /** Forbidden — Brief reference is authoritative on the ContentItem. */
  claimedStrategicBriefId?: string;
  /** Forbidden — caller cannot declare generic/strategic classification. */
  claimedContentMutationClass?: string;
}

export interface SaveContentDraftResult {
  content: ContentItem;
  advanced: boolean;
}

export interface SaveContentDraftDeps {
  contents: ContentRepository;
  publicationGate: ContentPublicationGatePort;
  /** SPEC-003 AuthorizeStrategicDownstream consumption — not owned here. */
  strategicBriefGate: ContentStrategicBriefGatePort;
}

export {
  classifyContentMutationAuthorization,
  contentHasAuthoritativeGenericProof,
  contentHasStrategicProvenance,
  contentRequiresStrategicBriefAuthorization,
  type ContentMutationAuthorizationClass,
} from './contentMutationAuthorization';

/**
 * CR-1 #31 — SaveContentDraft.
 * Persists editable draft fields; preserves strategic refs from authoritative content.
 * Mutation class: STRATEGIC_GOVERNED | GENERIC_PROVEN | LEGACY_AMBIGUOUS (fail-closed).
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
      claimedStrategicBriefId: input.claimedStrategicBriefId,
    });
    if (input.claimedContentMutationClass !== undefined) {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Caller-supplied content mutation classification is not accepted as authority.'
      );
    }

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

    const mutationClass = classifyContentMutationAuthorization(existing);

    if (mutationClass === 'LEGACY_AMBIGUOUS') {
      // Readable; not mutable via SaveContentDraft. No Brief invention / no auto-generic.
      throw new ExecutionDeliveryError(
        'CONTENT_AUTHORIZATION_AMBIGUOUS',
        'Content authorization class is LEGACY_AMBIGUOUS: mutation denied until governed strategic or proven generic origin is established from authoritative repository data (thesisId alone is insufficient).'
      );
    }

    // STRATEGIC_GOVERNED: SPEC-003 Brief gate BEFORE any draft persist.
    if (mutationClass === 'STRATEGIC_GOVERNED') {
      const briefId = existing.strategicBriefId?.trim();
      if (!briefId) {
        throw new ExecutionDeliveryError(
          'STRATEGIC_BRIEF_GATE_DENIED',
          'Strategic content requires an authoritative strategicBriefId (thesisId is not Brief authority).'
        );
      }
      const briefAuth = deps.strategicBriefGate.authorize({
        organizationId: input.trusted.organizationId,
        clientId: input.trusted.clientId,
        actorId: input.trusted.actorId,
        actorRole: input.trusted.actorRole === 'CLIENT' ? 'CLIENT' : 'ADMIN',
        now: input.trusted.now,
        briefId,
      });
      if (!briefAuth.authorized) {
        throw new ExecutionDeliveryError(
          'STRATEGIC_BRIEF_GATE_DENIED',
          briefAuth.denialReason ||
            `Strategic Brief does not authorize content update (${briefAuth.denialCode || 'DENIED'}).`
        );
      }
    }
    // GENERIC_PROVEN: Brief not required (currently unrepresentable in ContentItem schema).

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
