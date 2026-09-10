/**
 * P10 — Curation #14 decide presentation composite.
 *
 * Mirrors `handleCurationFormSubmit` in `curationHandlers.ts`:
 * DecideCuration → optional discardSignalForCurationComposite on DISCARD →
 * CURATION_DECIDED audit → optional addCurationToDelivery queue → success message.
 *
 * Lives under `services/` (P9 pattern). Not an Application boundary.
 * #15/#16/#17 UI remain legacy; queue calls frozen #17 consumer as legacy compat only.
 */

import { ExecutionDeliveryError } from '../application/executionDelivery';
import { SignalIntakeError } from '../application/signalIntake';
import type { CurationDestination } from '../types';
import { auditService } from './audit';
import { authService } from './auth';
import {
  addCurationToDelivery,
  decideCuration,
} from './executionDeliveryConsumer';
import { discardSignalForCurationComposite } from './signalIntakeConsumer';

const DISCARD_PARTIAL_FAILURE_MESSAGE =
  'La decisión de curación se guardó, pero no se pudo descartar la señal vinculada.';

export type CurationDecideCompositeResult =
  | { ok: true; message: string; queued?: boolean; kind: 'success' | 'warning' }
  | { ok: false; message: string };

function queueCurationInBriefing(curationId: string, requestedClientId: string): boolean {
  const result = addCurationToDelivery({
    requestedClientId,
    curationEntryId: curationId,
  });
  return result.ok;
}

export function runCurationDecidePresentation(intent: {
  requestedClientId: string | null | undefined;
  curationEntryId: string;
  destination: CurationDestination;
  rationale: string;
}): CurationDecideCompositeResult {
  const { curationEntryId, destination, rationale } = intent;
  const requestedClientId = intent.requestedClientId;

  let entry;
  try {
    entry = decideCuration({
      requestedClientId,
      curationEntryId,
      destination,
      rationale,
    }).entry;
  } catch (error) {
    if (error instanceof ExecutionDeliveryError && error.code === 'CURATION_NOT_FOUND') {
      try {
        auditService.log(
          authService.getCurrentUser(),
          'CURATION_DECIDED',
          'CurationEntry',
          curationEntryId,
          { destination, rationale }
        );
      } catch {
        // Best-effort presentation compatibility.
      }
      return {
        ok: true,
        message: 'Destino confirmado. Añádelo al briefing cuando quieras.',
        queued: false,
        kind: 'success',
      };
    }
    return {
      ok: false,
      message:
        error instanceof ExecutionDeliveryError || error instanceof Error
          ? error.message
          : 'No se pudo decidir la curación',
    };
  }

  if (entry.signalId && destination === 'DISCARD') {
    try {
      discardSignalForCurationComposite({
        requestedClientId: entry.clientId,
        signalId: entry.signalId,
        reason: rationale,
      });
    } catch (error) {
      if (error instanceof SignalIntakeError && error.code === 'SIGNAL_NOT_FOUND') {
        // Legacy-compatible success continuation after successful #14 DISCARD.
      } else {
        try {
          auditService.log(
            authService.getCurrentUser(),
            'CURATION_DECIDED',
            'CurationEntry',
            curationEntryId,
            { destination, rationale }
          );
        } catch {
          // Best-effort presentation compatibility.
        }
        return {
          ok: true,
          message: DISCARD_PARTIAL_FAILURE_MESSAGE,
          kind: 'warning',
        };
      }
    }
  }

  try {
    auditService.log(
      authService.getCurrentUser(),
      'CURATION_DECIDED',
      'CurationEntry',
      curationEntryId,
      { destination, rationale }
    );
  } catch {
    // Best-effort presentation compatibility.
  }

  const queueClientId =
    (typeof requestedClientId === 'string' && requestedClientId.trim()) || entry.clientId;
  const queued =
    destination !== 'DISCARD'
      ? queueCurationInBriefing(curationEntryId, queueClientId)
      : false;

  const message =
    destination === 'DISCARD'
      ? 'Ítem descartado con justificación'
      : queued
        ? 'Destino confirmado y añadido al briefing'
        : 'Destino confirmado. Añádelo al briefing cuando quieras.';

  return { ok: true, message, queued, kind: 'success' };
}
