/**
 * P9 — Radar #21 send-to-curation presentation composite.
 *
 * Mirrors `handleSendToCurationClick` in `radarHandlers.ts`:
 * authoritative signal reload → optional frozen ScoreAndRouteSignal when unscored →
 * AddSignalToCuration → MarkSignalSaved → SIGNAL_TO_CURATION audit.
 *
 * Lives under `services/` (like `articleReviewOpen`) so React UI stays free of
 * direct dbService imports. Not an Application boundary.
 * Advisor AddAdviceActionToCuration is out of scope.
 */

import { authService } from './auth';
import { auditService } from './audit';
import { dbService } from './db';
import { addSignalToCuration } from './executionDeliveryConsumer';
import { markSignalSaved } from './signalIntakeConsumer';
import { createStrategicSignalRoutingUseCases } from '../composition/strategicSignalRouting/composeStrategicSignalRouting';
import { ExecutionDeliveryError } from '../application/executionDelivery';
import { SignalIntakeError } from '../application/signalIntake';
import { StrategicRoutingError } from '../application/strategicSignalRouting';

export type RadarSendToCurationCompositeResult =
  | { ok: true; message: string; alreadyInCuration?: boolean; preScored?: boolean }
  | { ok: false; message: string };

export function runRadarSendToCurationComposite(intent: {
  requestedClientId: string | null | undefined;
  signalId: string;
}): RadarSendToCurationCompositeResult {
  const signalId = intent.signalId?.trim();
  if (!signalId) {
    return { ok: false, message: 'Señal no resuelta' };
  }

  const signal = dbService.getSignalById(signalId);
  if (!signal) {
    return { ok: false, message: 'Señal no encontrada.' };
  }

  const clientId =
    (typeof intent.requestedClientId === 'string' && intent.requestedClientId.trim()) ||
    signal.clientId;
  if (!clientId) {
    return { ok: false, message: 'Cliente no resuelto' };
  }

  if (dbService.isSignalInCuration(clientId, signalId)) {
    return {
      ok: true,
      message: 'Esta señal ya está en la mesa de curación.',
      alreadyInCuration: true,
    };
  }

  let preScored = false;
  if (signal.relevanceScore === undefined) {
    const organizationId =
      dbService.getClientById(clientId)?.organizationId?.trim() ||
      authService.getCurrentUser()?.organizationId?.trim() ||
      null;
    if (organizationId) {
      try {
        createStrategicSignalRoutingUseCases().scoreAndRouteSignal({
          signalId,
          clientId,
          organizationId,
        });
        preScored = true;
      } catch (error) {
        if (!(error instanceof StrategicRoutingError && error.code === 'SIGNAL_NOT_FOUND')) {
          return {
            ok: false,
            message:
              error instanceof Error ? error.message : 'No se pudo puntuar la señal',
          };
        }
      }
    }
  }

  try {
    addSignalToCuration({ requestedClientId: clientId, signalId });
  } catch (error) {
    if (error instanceof ExecutionDeliveryError && error.code === 'CURATION_ALREADY_EXISTS') {
      return {
        ok: true,
        message: 'Esta señal ya está en la mesa de curación.',
        alreadyInCuration: true,
        preScored,
      };
    }
    return {
      ok: false,
      message:
        error instanceof ExecutionDeliveryError || error instanceof Error
          ? error.message
          : 'No se pudo enviar a curación',
    };
  }

  try {
    markSignalSaved({ requestedClientId: clientId, signalId });
  } catch (error) {
    if (error instanceof SignalIntakeError && error.code === 'SIGNAL_NOT_FOUND') {
      // #21a already persisted — A2 presentation continues to audit/toast.
    } else {
      return {
        ok: false,
        message:
          error instanceof SignalIntakeError || error instanceof Error
            ? error.message
            : 'No se pudo marcar la señal como guardada',
      };
    }
  }

  try {
    auditService.log(authService.getCurrentUser(), 'SIGNAL_TO_CURATION', 'Signal', signalId, {
      clientId,
    });
  } catch {
    // Best-effort presentation compatibility — curation already persisted.
  }

  return { ok: true, message: 'Enviada a curación', preScored };
}
