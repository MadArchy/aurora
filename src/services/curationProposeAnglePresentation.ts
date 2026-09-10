/**
 * P11 — Curation #15 propose-angle presentation composite.
 *
 * Mirrors `handleProposeAngleClick` in `curationHandlers.ts`:
 * ProposeAngle consumer → exact legacy toast compatibility.
 *
 * Lives under `services/` (P10 pattern). Not an Application boundary.
 * No audit — B5 frozen #15 authority owns zero audit events.
 */

import { proposeAngle } from './executionDeliveryConsumer';
import { THESIS_NOT_RESOLVED_MESSAGE } from '../ui/legacy/handlers/curationHandlers';

export type ProposeAngleCompositeResult =
  | { ok: true; message: string; kind: 'success' }
  | { ok: false; message: string; kind: 'warning' | 'error'; silent?: boolean };

export async function runCurationProposeAnglePresentation(intent: {
  requestedClientId: string | null | undefined;
  curationEntryId: string;
}): Promise<ProposeAngleCompositeResult> {
  try {
    const result = await proposeAngle({
      requestedClientId: intent.requestedClientId,
      curationEntryId: intent.curationEntryId,
    });
    if (!result.ok) {
      if (result.compat === 'CURATION_NOT_FOUND') {
        return { ok: false, message: '', kind: 'warning', silent: true };
      }
      if (result.compat === 'THESIS_NOT_RESOLVED') {
        return { ok: false, message: THESIS_NOT_RESOLVED_MESSAGE, kind: 'warning' };
      }
      return { ok: false, message: 'No se pudo proponer el ángulo', kind: 'warning' };
    }
    return {
      ok: true,
      message: result.usedLiveModel
        ? 'Ángulo propuesto con modelo'
        : 'Ángulo propuesto con reglas locales',
      kind: 'success',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo proponer el ángulo',
      kind: 'warning',
    };
  }
}
