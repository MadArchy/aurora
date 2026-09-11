/**
 * P13 — Registry #17 delivery assembly presentation composite.
 *
 * Mirrors `deliveryHandlers.ts` / `queueCurationInBriefing` toast compatibility.
 * Frozen B4 consumers only. No audit — B4 owns zero assembly audit events.
 */

import { ExecutionDeliveryError } from '../application/executionDelivery';
import {
  addCurationToDelivery,
  discardDraftDelivery,
  ensureDraftDelivery,
  removeDeliveryItemFromDelivery,
  updateDeliveryPackageMetadata,
} from './executionDeliveryConsumer';

export type DeliveryAssemblyPresentationResult =
  | {
      ok: true;
      message: string;
      kind?: 'success' | 'info';
      packageId?: string;
      created?: boolean;
    }
  | { ok: false; message: string; kind?: 'warning' | 'error' | 'info' };

export function runEnsureDraftDeliveryPresentation(intent: {
  requestedClientId: string | null | undefined;
}): DeliveryAssemblyPresentationResult {
  try {
    const result = ensureDraftDelivery({
      requestedClientId: intent.requestedClientId,
    });
    return {
      ok: true,
      message: 'Briefing creado. Añade los ítems curados.',
      kind: 'success',
      packageId: result.package.id,
      created: result.created,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo crear el briefing',
      kind: 'warning',
    };
  }
}

export function runAddCurationToDeliveryPresentation(intent: {
  requestedClientId: string | null | undefined;
  curationEntryId: string;
}): DeliveryAssemblyPresentationResult {
  try {
    const result = addCurationToDelivery({
      requestedClientId: intent.requestedClientId,
      curationEntryId: intent.curationEntryId,
    });
    if (!result.ok) {
      return {
        ok: false,
        message: 'Ese ítem ya está en un briefing.',
        kind: 'info',
      };
    }
    return { ok: true, message: 'Añadido al briefing', kind: 'success', packageId: result.package.id };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo añadir al briefing',
      kind: 'warning',
    };
  }
}

export function runUpdateDeliveryPackageMetadataPresentation(intent: {
  requestedClientId: string | null | undefined;
  packageId: string;
  title: string;
  strategicNote: string;
}): DeliveryAssemblyPresentationResult {
  try {
    const result = updateDeliveryPackageMetadata({
      requestedClientId: intent.requestedClientId,
      packageId: intent.packageId,
      title: intent.title,
      strategicNote: intent.strategicNote,
    });
    if (!result.updated) {
      return {
        ok: false,
        message: 'No se pudo guardar la nota estratégica',
        kind: 'warning',
      };
    }
    return { ok: true, message: 'Nota estratégica guardada', kind: 'success', packageId: intent.packageId };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof ExecutionDeliveryError || error instanceof Error
          ? error.message
          : 'No se pudo guardar la nota estratégica',
      kind: 'warning',
    };
  }
}

export function runRemoveDeliveryItemPresentation(intent: {
  requestedClientId: string | null | undefined;
  packageId: string;
  itemId: string;
}): DeliveryAssemblyPresentationResult {
  try {
    removeDeliveryItemFromDelivery({
      requestedClientId: intent.requestedClientId,
      packageId: intent.packageId,
      itemId: intent.itemId,
    });
    return { ok: true, message: 'Ítem retirado del briefing', kind: 'success' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo retirar el ítem del briefing',
      kind: 'warning',
    };
  }
}

export function runDiscardDraftDeliveryPresentation(intent: {
  requestedClientId: string | null | undefined;
  packageId: string;
}): DeliveryAssemblyPresentationResult {
  try {
    const result = discardDraftDelivery({
      requestedClientId: intent.requestedClientId,
      packageId: intent.packageId,
    });
    if (!result.discarded) {
      return {
        ok: false,
        message: 'No se pudo descartar el borrador',
        kind: 'warning',
      };
    }
    return { ok: true, message: 'Borrador descartado', kind: 'success' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo descartar el borrador',
      kind: 'warning',
    };
  }
}
