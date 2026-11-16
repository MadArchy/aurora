/**
 * Presentation adapter for content pipeline actions (QA → Ready → Publish).
 * React / seam call this; authority stays in contentPipelineCommands + domain gates.
 */

import { dbService } from './db';
import { runContentPipelineAction } from '../controllers/contentPipelineCommands';
import type { ContentPipelineAction } from '../domain/contentPublishCore';
import { createContentDraft as createContentDraftConsumer } from './executionDeliveryConsumer';
import type { CreateContentDraftIntent } from '../application/executionDelivery';
import { ExecutionDeliveryError } from '../application/executionDelivery';

/** Minimal host shape — avoids importing UI modules into services (cycle risk). */
type PipelineHost = {
  showToast(message: string, type?: 'success' | 'warning' | 'info' | 'error'): void;
  render(): void;
  requireTenant(requested?: string | null):
    | { ok: true; clientId: string; organizationId: string; actorId: string; actorRole: 'ADMIN' | 'CLIENT' }
    | { ok: false; reason: 'CLIENT_SCOPE_VIOLATION'; message: string };
};

export type ContentPipelinePresentationResult =
  | { ok: true; message: string; contentId?: string }
  | { ok: false; message: string };

export function runContentPipelinePresentation(intent: {
  requestedClientId: string | null | undefined;
  contentId: string;
  action: ContentPipelineAction;
}): ContentPipelinePresentationResult {
  const clientId = intent.requestedClientId?.trim();
  if (!clientId) return { ok: false, message: 'Cliente no resuelto' };

  const content = dbService.getContentById(intent.contentId);
  if (!content || content.clientId !== clientId) {
    return { ok: false, message: 'Contenido no encontrado para este cliente.' };
  }

  let lastMessage = '';
  let failed = false;
  const host: PipelineHost = {
    showToast(message, type) {
      lastMessage = message;
      if (type === 'warning' || type === 'error') failed = true;
    },
    render() {},
    requireTenant(requested) {
      const req = requested?.trim();
      if (req && req !== clientId) {
        return { ok: false as const, reason: 'CLIENT_SCOPE_VIOLATION', message: 'Cliente no autorizado' };
      }
      return {
        ok: true as const,
        clientId,
        organizationId: content.organizationId,
        actorId: 'seam',
        actorRole: 'ADMIN' as const,
      };
    },
  };

  const ok = runContentPipelineAction(host, intent.contentId, intent.action);
  if (!ok || failed) {
    return { ok: false, message: lastMessage || 'No se pudo avanzar el pipeline' };
  }
  return { ok: true, message: lastMessage || 'Pipeline actualizado' };
}

export async function createContentDraftPresentation(intent: {
  requestedClientId: string | null | undefined;
  draftIntent: CreateContentDraftIntent;
}): Promise<ContentPipelinePresentationResult> {
  try {
    const result = await createContentDraftConsumer({
      requestedClientId: intent.requestedClientId,
      intent: intent.draftIntent,
    });
    return {
      ok: true,
      message: 'Borrador generado',
      contentId: result.content.id,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof ExecutionDeliveryError || err instanceof Error
          ? err.message
          : 'No se pudo generar el borrador',
    };
  }
}
