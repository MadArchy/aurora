/**
 * SPEC-010 · P2 parity — manager notification after successful #13 client review.
 *
 * Presentation-only compatibility: mirrors `clientPortalHandlers.ts` post-review
 * notifyManager body composition. Not part of the frozen Application command.
 */

import { notifyManager } from '../../services/notifications';

/** Best-effort manager notification after client approves and awaits activation. */
export function notifyManagerThesisClientApproved(clientId: string, thesisTitle: string): void {
  notifyManager(clientId, {
    type: 'THESIS',
    title: 'Tesis aprobada por el cliente',
    body: `«${thesisTitle}» — puedes activarla en Identidad.`,
    href: 'ws-positioning',
  });
}

/** Best-effort manager notification after client requests thesis changes. */
export function notifyManagerThesisChangesRequested(
  clientId: string,
  thesisTitle: string,
  feedback?: string
): void {
  const trimmed = feedback?.trim();
  notifyManager(clientId, {
    type: 'THESIS',
    title: 'Cambios solicitados en la tesis',
    body: trimmed
      ? `«${thesisTitle}»: ${trimmed.slice(0, 120)}`
      : `El cliente pidió ajustes en «${thesisTitle}».`,
    href: 'ws-positioning',
  });
}
