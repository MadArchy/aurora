import { authService } from '../services/auth';
import { dbService } from '../services/db';
import { aiService } from '../services/ai';
import { auditService } from '../services/audit';
import { notifyClient, notifyManager } from '../services/notifications';
import { authorizeContentPublicationGate } from '../composition/claimEvidence/contentClaimPublicationGate';
import { mapLegacyContentStatus, resolvePipelineStepsToTarget, syncLegacyStatusFromPipeline } from '../domain/contentPipeline';
import {
  pipelineActionTarget,
  PIPELINE_ACTION_LABELS,
  type ContentPipelineAction,
} from '../domain/contentPublishCore';
import { assertClaimSafeTransition } from '../domain/claimSafetyGateCore';
import type { StrategicDownstreamAction } from '../domain/strategicBriefCore';
import {
  formatPlannedAuthorizationDenial,
  requirePlannedAuthorization,
} from '../services/strategicPlanConsumer';
import { getStrategicBrief } from '../services/strategicBriefConsumer';
import { reviewClientArticle, sendDeliveryPackage } from '../services/executionDeliveryConsumer';
import { ExecutionDeliveryError } from '../application/executionDelivery';
import type { ContentStatus, ContentPipelineStatus } from '../types';
import type { ContentPipelineHost } from '../ui/legacy/legacyAppHost';

/**
 * Strategic downstream gate: SPEC-003 Brief + SPEC-004 StrategicPlan.
 * CurationEntry / DeliveryPackage / caller snapshots are not Plan authority.
 */
export function gateStrategicDownstream(
  clientId: string,
  briefId: string | undefined,
  action: StrategicDownstreamAction
):
  | {
      ok: true;
      briefId: string;
      version?: number;
      thesisId: string;
      signalIds: string[];
      evidenceIds: string[];
      planId: string;
      planItemId: string;
    }
  | { ok: false; message: string } {
  const planned = requirePlannedAuthorization({
    clientId,
    briefId,
    requestedAction: action,
  });
  if (!planned.authorized || !planned.planId || !planned.planItemId || !planned.thesisId) {
    return { ok: false, message: formatPlannedAuthorizationDenial(planned) };
  }
  const brief = getStrategicBrief(planned.briefId, clientId);
  if (!brief) {
    return {
      ok: false,
      message: 'Strategic Brief required — create and approve a Brief for this signal first.',
    };
  }
  return {
    ok: true,
    briefId: brief.id,
    version: planned.briefVersion ?? brief.version,
    thesisId: planned.thesisId,
    signalIds: planned.signalIds ?? [...brief.signalIds],
    evidenceIds: planned.evidenceIds ?? [...brief.supportingEvidenceIds],
    planId: planned.planId,
    planItemId: planned.planItemId,
  };
}

export async function sendDelivery(host: ContentPipelineHost, packageId: string) {
  const pkg = dbService.getDeliveryById(packageId);
  const clientId = pkg?.clientId;
  if (!pkg || !clientId) {
    throw new Error('Briefing no encontrado.');
  }
  const grant = host.requireTenant(clientId);
  if (!grant.ok) {
    throw new Error(grant.message);
  }

  const result = await sendDeliveryPackage({
    requestedClientId: grant.clientId,
    packageId,
  });

  const notified = notifyClient(clientId, {
    type: 'BRIEFING',
    title: 'Nuevo briefing de tu Brand Manager',
    body: `${pkg.title} · ${pkg.items.length} ítem(s)`,
    href: 'client-home',
  });
  if (!notified) {
    host.showToast('Briefing enviado. El cliente no tiene cuenta vinculada para avisos.', 'info');
  }

  host.showToast(
    `Briefing enviado. ${result.createdTasks ? `${result.createdTasks} tarea(s) creada(s).` : 'Sin tareas nuevas.'}`,
    'success'
  );
  host.render();
}

export function pipelineActor(): { uid: string; role: 'ADMIN' | 'CLIENT' | 'SYSTEM' } {
  const user = authService.getCurrentUser();
  return {
    uid: user?.uid || 'system',
    role: user?.role === 'CLIENT' ? 'CLIENT' : user?.role === 'ADMIN' ? 'ADMIN' : 'SYSTEM',
  };
}

/** Avanza el pipeline de contenido hasta una etapa concreta. */
export function advanceContentPipelineTarget(
  host: ContentPipelineHost,
  contentId: string,
  target: ContentPipelineStatus,
  comment?: string
): boolean {
  const content = dbService.getContentById(contentId);
  if (!content) return false;
  const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
  if (current === target) return true;
  try {
    const steps = resolvePipelineStepsToTarget(current, target);
    const actor = pipelineActor();
    for (const step of steps) {
      dbService.transitionContentPipeline(contentId, step, actor, comment);
    }
    return true;
  } catch (err) {
    host.showToast(err instanceof Error ? err.message : 'Transición de contenido no permitida', 'warning');
    return false;
  }
}

/** Sincroniza pipelineStatus + legacy status mediante transiciones válidas. */
export function syncContentToPipelineStatus(
  host: ContentPipelineHost,
  contentId: string,
  legacyStatus: ContentStatus,
  comment?: string,
  options?: {
    reviewAcknowledged?: boolean;
    requireReviewAck?: boolean;
    claimSafetyOverride?: import('../types').ClaimSafetyVerdictRecord;
  }
): boolean {
  const content = dbService.getContentById(contentId);
  if (!content) return false;

  const user = authService.getCurrentUser();
  if (!user) {
    host.showToast('Sesión requerida para avanzar contenido.', 'warning');
    return false;
  }

  // Compatibility projection may be refreshed by callers; never used as authority.
  void options?.claimSafetyOverride;
  void options?.reviewAcknowledged;
  void options?.requireReviewAck;
  void content.claimSafety;

  const canonical = authorizeContentPublicationGate({
    contentId: content.id,
    organizationId: content.organizationId,
    clientId: content.clientId,
    targetStatus: legacyStatus,
    actorId: user.uid,
    actorRole: user.role,
    now: new Date().toISOString(),
  });

  const gate = assertClaimSafeTransition(content.status, legacyStatus, content.claimSafety, {
    canonical: {
      allowed: canonical.allowed,
      reason: canonical.reason,
      reasonCode: canonical.reasonCode,
    },
  });
  if (!gate.allowed) {
    host.showToast(gate.reason || 'Claim publication gate blocks advancement', 'warning');
    return false;
  }

  const current = content.pipelineStatus || mapLegacyContentStatus(content.status);
  const target = mapLegacyContentStatus(legacyStatus);
  if (current === target) return true;
  try {
    const steps = resolvePipelineStepsToTarget(current, target);
    const actor = pipelineActor();
    for (const step of steps) {
      dbService.transitionContentPipeline(contentId, step, actor, comment);
    }
    return true;
  } catch (err) {
    host.showToast(err instanceof Error ? err.message : 'Transición de contenido no permitida', 'warning');
    return false;
  }
}

/**
 * Persists draft (non-gated) then advances only if AuthorizePublication allows.
 * ContentItem.claimSafety is COMPATIBILITY_ONLY advisory projection.
 * SPEC-003 strategicBriefId / version / evidence refs on content are preserved.
 */
export function saveContentWithClaimGate(
  host: ContentPipelineHost,
  content: import('../types').ContentItem,
  targetStatus: ContentStatus,
  comment?: string
): boolean {
  const thesis = dbService.getThesesByClient(content.clientId).find((t) => t.id === content.thesisId);
  if (!thesis) {
    host.showToast('No se encontró la tesis asociada al contenido.', 'warning');
    return false;
  }
  // Advisory projection for UI — not publication authority.
  const claimSafety = aiService.reviewDraftClaims(content.body, thesis);
  const now = new Date().toISOString();

  // Non-gated draft persist first (preserves Brief traceability fields on content).
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

  // Authorize BEFORE gated side effect.
  return syncContentToPipelineStatus(host, content.id, targetStatus, comment, {
    claimSafetyOverride: claimSafety,
  });
}

export function toastExecErr(host: ContentPipelineHost, error: unknown, fallback: string): void {
  host.showToast(
    error instanceof ExecutionDeliveryError || error instanceof Error ? error.message : fallback,
    'warning'
  );
}

/** Aprueba un artículo del cliente y completa la tarea vinculada. */
export function approveClientArticle(
  host: ContentPipelineHost,
  contentId: string,
  taskId?: string,
  draft?: { title?: string; body?: string }
): boolean {
  const content = dbService.getContentById(contentId);
  if (!content || !authService.getCurrentUser()) return false;
  try {
    reviewClientArticle({
      requestedClientId: content.clientId,
      contentId,
      decision: 'approve',
      taskId,
      title: draft?.title,
      body: draft?.body,
    });
  } catch (error) {
    toastExecErr(host, error, 'No se pudo aprobar el artículo');
    return false;
  }
  notifyManager(content.clientId, {
    type: 'CONTENT_REVIEW',
    title: 'Artículo aprobado por el cliente',
    body: `«${content.title}» está listo para finalizar.`,
    href: 'ws-production',
  });
  host.showToast('Artículo aprobado y enviado al manager', 'success');
  host.render();
  return true;
}

export function rejectClientArticle(
  host: ContentPipelineHost,
  contentId: string,
  reason: string,
  taskId?: string
): boolean {
  const content = dbService.getContentById(contentId);
  if (!content || !authService.getCurrentUser() || !reason.trim()) return false;
  try {
    reviewClientArticle({
      requestedClientId: content.clientId,
      contentId,
      decision: 'request_changes',
      reason: reason.trim(),
      taskId,
    });
  } catch (error) {
    toastExecErr(host, error, 'No se pudo rechazar el artículo');
    return false;
  }
  notifyManager(content.clientId, {
    type: 'CONTENT_REVIEW',
    title: 'Artículo rechazado por el cliente',
    body: reason.trim(),
    href: 'ws-production',
  });
  host.showToast('Rechazo enviado con tu motivo', 'info');
  host.render();
  return true;
}

/** Ejecuta una acción del pipeline canónico (finalizar → QA → listo → publicar). */
export function runContentPipelineAction(
  host: ContentPipelineHost,
  contentId: string,
  action: ContentPipelineAction
): boolean {
  const content = dbService.getContentById(contentId);
  if (!content) return false;

  const targetPipeline = pipelineActionTarget(action);
  const targetLegacy = syncLegacyStatusFromPipeline(targetPipeline);

  if (action === 'mark_ready' || action === 'publish') {
    const user = authService.getCurrentUser();
    if (!user) {
      host.showToast('Sesión requerida para avanzar contenido.', 'warning');
      return false;
    }
    const canonical = authorizeContentPublicationGate({
      contentId: content.id,
      organizationId: content.organizationId,
      clientId: content.clientId,
      targetStatus: targetLegacy,
      actorId: user.uid,
      actorRole: user.role,
      now: new Date().toISOString(),
    });
    const gate = assertClaimSafeTransition(content.status, targetLegacy, content.claimSafety, {
      canonical: {
        allowed: canonical.allowed,
        reason: canonical.reason,
        reasonCode: canonical.reasonCode,
      },
    });
    if (!gate.allowed) {
      host.showToast(gate.reason || 'Claim publication gate blocks advancement', 'warning');
      return false;
    }
  }

  const comment = PIPELINE_ACTION_LABELS[action];
  if (!advanceContentPipelineTarget(host, contentId, targetPipeline, comment)) {
    return false;
  }

  const user = authService.getCurrentUser();
  if (action === 'publish') {
    auditService.log(user, 'CONTENT_PUBLISHED', 'ContentItem', contentId, { title: content.title });
    notifyClient(content.clientId, {
      type: 'CONTENT_REVIEW',
      title: 'Contenido publicado',
      body: `«${content.title}» ya está en tu biblioteca.`,
      href: 'client-content',
      targetId: contentId,
    });
    host.showToast('Contenido publicado', 'success');
  } else {
    host.showToast(comment, 'success');
  }
  host.render();
  return true;
}
