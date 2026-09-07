/**
 * SPEC-010 · P1 parity — manager notification after successful #19 acknowledgement.
 *
 * Presentation-only compatibility: mirrors `deliveryHandlers.ts` post-ack notifyManager
 * body composition. Not part of the frozen Application command.
 */

import { notifyManager } from '../../services/notifications';

export function composeBriefingAcknowledgedManagerBody(
  packageTitle: string,
  clientDisplayName: string,
  note?: string
): string {
  const trimmed = note?.trim();
  if (trimmed) {
    return `«${packageTitle}» — ${clientDisplayName}: ${trimmed}`;
  }
  return `«${packageTitle}» marcado como leído por ${clientDisplayName || 'el cliente'}.`;
}

/** Best-effort manager notification after canonical acknowledgement succeeds. */
export function notifyManagerBriefingAcknowledged(
  clientId: string,
  packageTitle: string,
  clientDisplayName: string,
  clientAckNote?: string
): void {
  notifyManager(clientId, {
    type: 'BRIEFING',
    title: 'Briefing visto por el cliente',
    body: composeBriefingAcknowledgedManagerBody(packageTitle, clientDisplayName, clientAckNote),
    href: 'ws-deliver',
  });
}
