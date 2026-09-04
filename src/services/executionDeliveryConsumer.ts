/**
 * CR-1 Workstream 5 — Execution Delivery consumer facade.
 *
 * #18 SendDeliveryPackage · #28 TransitionClientTask · #31 SaveContentDraft · #32 ReviewClientArticle
 * SPEC-006 gate is consumed, not owned. No SPEC-008 learning. No providers.
 */

import type { ContentStatus, ContentType, CurationDestination } from '../types';
import {
  ExecutionDeliveryError,
  type AddAdviceActionToCurationResult,
  type AddCurationToDeliveryResult,
  type AddSignalToCurationResult,
  type ClientArticleReviewDecision,
  type ClientTaskTransitionIntent,
  type DecideCurationResult,
  type DiscardDraftDeliveryResult,
  type EnsureDraftDeliveryResult,
  type RemoveDeliveryItemFromDeliveryResult,
  type ReviewClientArticleResult,
  type SaveContentDraftResult,
  type SendDeliveryPackageResult,
  type TransitionClientTaskResult,
  type UpdateDeliveryPackageMetadataResult,
} from '../application/executionDelivery';
import { composeExecutionDelivery } from '../composition/executionDelivery/composeExecutionDelivery';
import { requireTenantScope } from '../controllers/trustedTenant';
import { authService } from './auth';
import { auditService } from './audit';
import { dbService } from './db';

type ExecutionDeliveryUseCases = ReturnType<typeof composeExecutionDelivery>;

let useCases: ExecutionDeliveryUseCases = composeExecutionDelivery();

export function resetExecutionDeliveryConsumerForTest(next?: ExecutionDeliveryUseCases): void {
  useCases = next ?? composeExecutionDelivery();
}

function mapError(err: unknown, fallback: string): never {
  if (err instanceof ExecutionDeliveryError) throw err;
  throw new ExecutionDeliveryError(
    'PERSISTENCE_ERROR',
    err instanceof Error ? err.message : fallback
  );
}

function gate(requestedClientId: string | null | undefined) {
  const decision = requireTenantScope(requestedClientId, {
    getCurrentUser: () => authService.getCurrentUser(),
    getClientById: (id) => dbService.getClientById(id),
  });
  if (!decision.ok) {
    throw new ExecutionDeliveryError('ACTOR_NOT_AUTHORIZED', decision.message);
  }
  return decision;
}

function trustedFrom(g: ReturnType<typeof gate>) {
  return {
    actorId: g.actorId,
    actorRole: g.actorRole,
    organizationId: g.organizationId,
    clientId: g.clientId,
    now: new Date().toISOString(),
  };
}

/** Registry #18 — delivery orchestration by package id (authoritative reload). */
export async function sendDeliveryPackage(intent: {
  requestedClientId: string | null | undefined;
  packageId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): Promise<SendDeliveryPackageResult> {
  const g = gate(intent.requestedClientId);
  try {
    const result = await useCases.sendDeliveryPackage({
      trusted: trustedFrom(g),
      packageId: intent.packageId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
    auditService.log(authService.getCurrentUser(), 'DELIVERY_SENT', 'DeliveryPackage', result.packageId, {
      clientId: result.clientId,
      items: result.itemCount,
      createdTasks: result.createdTasks,
    });
    return result;
  } catch (err) {
    mapError(err, 'No se pudo enviar el briefing');
  }
}

/** Registry #21a — signal-backed add to curation (authoritative Signal reload). No composite audit. */
export function addSignalToCuration(intent: {
  requestedClientId: string | null | undefined;
  signalId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): AddSignalToCurationResult {
  const g = gate(intent.requestedClientId);
  try {
    return useCases.addSignalToCuration({
      trusted: trustedFrom(g),
      signalId: intent.signalId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo enviar a curación');
  }
}

/** Registry #21a advisor — advice-backed add to curation (authoritative Advice reload). No composite audit. */
export function addAdviceActionToCuration(intent: {
  requestedClientId: string | null | undefined;
  adviceActionId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): AddAdviceActionToCurationResult {
  const g = gate(intent.requestedClientId);
  try {
    return useCases.addAdviceActionToCuration({
      trusted: trustedFrom(g),
      adviceActionId: intent.adviceActionId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo enviar a curación');
  }
}

/** Registry #14 — curation decision (authoritative CurationEntry reload). No composite audit. */
export function decideCuration(intent: {
  requestedClientId: string | null | undefined;
  curationEntryId: string;
  destination: CurationDestination;
  rationale: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): DecideCurationResult {
  const g = gate(intent.requestedClientId);
  try {
    return useCases.decideCuration({
      trusted: trustedFrom(g),
      curationEntryId: intent.curationEntryId,
      destination: intent.destination,
      rationale: intent.rationale,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo decidir la curación');
  }
}

/** Registry #17 — ensure/open client draft briefing. No composite audit. */
export function ensureDraftDelivery(intent: {
  requestedClientId: string | null | undefined;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): EnsureDraftDeliveryResult {
  const g = gate(intent.requestedClientId);
  try {
    return useCases.ensureDraftDelivery({
      trusted: trustedFrom(g),
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo crear el briefing');
  }
}

/** Registry #17 — add decided curation to draft briefing (A2 attach-after-item). No composite audit. */
export function addCurationToDelivery(intent: {
  requestedClientId: string | null | undefined;
  curationEntryId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): AddCurationToDeliveryResult {
  const g = gate(intent.requestedClientId);
  try {
    return useCases.addCurationToDelivery({
      trusted: trustedFrom(g),
      curationEntryId: intent.curationEntryId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo añadir al briefing');
  }
}

/** Registry #17 — update draft briefing metadata. No composite audit. */
export function updateDeliveryPackageMetadata(intent: {
  requestedClientId: string | null | undefined;
  packageId: string;
  title: string;
  strategicNote: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): UpdateDeliveryPackageMetadataResult {
  const g = gate(intent.requestedClientId);
  try {
    return useCases.updateDeliveryPackageMetadata({
      trusted: trustedFrom(g),
      packageId: intent.packageId,
      title: intent.title,
      strategicNote: intent.strategicNote,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo guardar la nota estratégica');
  }
}

/** Registry #17 — remove item from draft briefing (R1 detach→remove). No composite audit. */
export function removeDeliveryItemFromDelivery(intent: {
  requestedClientId: string | null | undefined;
  packageId: string;
  itemId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): RemoveDeliveryItemFromDeliveryResult {
  const g = gate(intent.requestedClientId);
  try {
    return useCases.removeDeliveryItemFromDelivery({
      trusted: trustedFrom(g),
      packageId: intent.packageId,
      itemId: intent.itemId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo retirar el ítem del briefing');
  }
}

/** Registry #17 — discard draft briefing. No composite audit. */
export function discardDraftDelivery(intent: {
  requestedClientId: string | null | undefined;
  packageId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}): DiscardDraftDeliveryResult {
  const g = gate(intent.requestedClientId);
  try {
    return useCases.discardDraftDelivery({
      trusted: trustedFrom(g),
      packageId: intent.packageId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo descartar el borrador');
  }
}

/** Registry #28 */
export function transitionClientTask(intent: {
  requestedClientId: string | null | undefined;
  taskId: string;
  intent: ClientTaskTransitionIntent;
  evidenceUrl?: string;
  clientNotes?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
}): TransitionClientTaskResult {
  const g = gate(intent.requestedClientId);
  try {
    const result = useCases.transitionClientTask({
      trusted: trustedFrom(g),
      taskId: intent.taskId,
      intent: intent.intent,
      evidenceUrl: intent.evidenceUrl,
      clientNotes: intent.clientNotes,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedStatus: intent.claimedStatus,
    });
    auditService.log(authService.getCurrentUser(), 'TRANSITION_CLIENT_TASK', 'Task', result.task.id, {
      intent: result.intent,
      status: result.task.status,
    });
    return result;
  } catch (err) {
    mapError(err, 'No se pudo actualizar la tarea');
  }
}

/** Registry #31 */
export function saveContentDraft(intent: {
  requestedClientId: string | null | undefined;
  contentId: string;
  fields: {
    title?: string;
    body?: string;
    type?: ContentType;
    targetPlatform?: 'LinkedIn' | 'YouTube' | 'PersonalWebsite' | 'Substack' | 'LegalJournal';
    teleprompterScript?: string;
    managerNotes?: string;
    claimSafety?: import('../types').ClaimSafetyVerdictRecord;
  };
  requestedTargetStatus?: ContentStatus;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedPipelineStatus?: string;
  claimedPublicationState?: string;
  claimedClaimSafetyVerdict?: string;
  claimedStrategicBriefId?: string;
  claimedContentMutationClass?: string;
}): SaveContentDraftResult {
  const g = gate(intent.requestedClientId);
  try {
    const result = useCases.saveContentDraft({
      trusted: trustedFrom(g),
      contentId: intent.contentId,
      fields: intent.fields,
      requestedTargetStatus: intent.requestedTargetStatus,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedStatus: intent.claimedStatus,
      claimedPipelineStatus: intent.claimedPipelineStatus,
      claimedPublicationState: intent.claimedPublicationState,
      claimedClaimSafetyVerdict: intent.claimedClaimSafetyVerdict,
      claimedStrategicBriefId: intent.claimedStrategicBriefId,
      claimedContentMutationClass: intent.claimedContentMutationClass,
    });
    auditService.log(authService.getCurrentUser(), 'EDIT_CONTENT', 'ContentItem', result.content.id, {
      advanced: result.advanced,
    });
    return result;
  } catch (err) {
    mapError(err, 'No se pudo guardar el borrador');
  }
}

/** Registry #32 */
export function reviewClientArticle(intent: {
  requestedClientId: string | null | undefined;
  contentId: string;
  decision: ClientArticleReviewDecision;
  title?: string;
  body?: string;
  reason?: string;
  taskId?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedPipelineStatus?: string;
  claimedPublicationState?: string;
  claimedClaimSafetyVerdict?: string;
}): ReviewClientArticleResult {
  const g = gate(intent.requestedClientId);
  try {
    const result = useCases.reviewClientArticle({
      trusted: trustedFrom(g),
      contentId: intent.contentId,
      decision: intent.decision,
      title: intent.title,
      body: intent.body,
      reason: intent.reason,
      taskId: intent.taskId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedStatus: intent.claimedStatus,
      claimedPipelineStatus: intent.claimedPipelineStatus,
      claimedPublicationState: intent.claimedPublicationState,
      claimedClaimSafetyVerdict: intent.claimedClaimSafetyVerdict,
    });
    auditService.log(
      authService.getCurrentUser(),
      'REVIEW_CLIENT_ARTICLE',
      'ContentItem',
      result.content.id,
      { decision: result.decision }
    );
    return result;
  } catch (err) {
    mapError(err, 'No se pudo registrar la revisión del artículo');
  }
}
