import { authorizeContentPublicationGate } from '../composition/claimEvidence/contentClaimPublicationGate';
import { assertClaimSafeTransition } from '../domain/claimSafetyGateCore';
import { mapLegacyContentStatus, resolvePipelineStepsToTarget } from '../domain/contentPipeline';
import type { ContentItem, ContentStatus, UserRole } from '../types';
import { aiService } from './ai';
import { dbService } from './db';

export interface DeliveryContentActor {
  uid: string;
  role: UserRole;
}

/**
 * Persists AI-generated delivery content then advances pipeline when SPEC-006 allows.
 * No UI toasts — caller owns presentation feedback.
 */
export function saveDeliveryGeneratedContent(
  content: ContentItem,
  targetStatus: ContentStatus,
  actor: DeliveryContentActor,
  comment?: string
): boolean {
  const thesis = dbService.getThesesByClient(content.clientId).find((t) => t.id === content.thesisId);
  if (!thesis) return false;

  const claimSafety = aiService.reviewDraftClaims(content.body, thesis);
  const now = new Date().toISOString();

  dbService.saveContent({
    ...content,
    claimSafety,
    status: 'AI_GENERATED',
    createdAt: content.createdAt || now,
    updatedAt: now,
    strategicBriefId: content.strategicBriefId,
    strategicBriefVersion: content.strategicBriefVersion,
    signalIds: content.signalIds,
    supportingEvidenceIds: content.supportingEvidenceIds,
  });

  const canonical = authorizeContentPublicationGate({
    contentId: content.id,
    organizationId: content.organizationId,
    clientId: content.clientId,
    targetStatus,
    actorId: actor.uid,
    actorRole: actor.role,
    now,
  });

  const gate = assertClaimSafeTransition(content.status, targetStatus, claimSafety, {
    canonical: {
      allowed: canonical.allowed,
      reason: canonical.reason,
      reasonCode: canonical.reasonCode,
    },
  });
  if (!gate.allowed) return false;

  const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
  const target = mapLegacyContentStatus(targetStatus);
  if (current === target) return true;

  const steps = resolvePipelineStepsToTarget(current, target);
  const pipelineActor = {
    uid: actor.uid,
    role: actor.role === 'CLIENT' ? ('CLIENT' as const) : actor.role === 'ADMIN' ? ('ADMIN' as const) : ('SYSTEM' as const),
  };
  for (const step of steps) {
    dbService.transitionContentPipeline(content.id, step, pipelineActor, comment);
  }
  return true;
}
