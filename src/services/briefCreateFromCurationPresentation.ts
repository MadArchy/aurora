/**
 * P12 — Strategic Brief create-from-curation presentation composite.
 *
 * Mirrors `.btn-create-strategic-brief` in `curationHandlers.ts`:
 * CR-2 consumer → exact legacy toast compatibility.
 *
 * Lives under `services/` (P10/P11 pattern). Not an Application boundary.
 * No audit — CR-2 owns zero React audit events.
 */

import type { CurationDestination } from '../types';
import { createBriefFromCurationEntry } from './strategicBriefConsumer';

export type BriefCreateFromCurationCompositeResult =
  | { ok: true; message: string; briefId: string }
  | { ok: false; message: string; kind?: 'warning' | 'error' };

export function runBriefCreateFromCurationPresentation(intent: {
  curationEntryId: string;
  destination: CurationDestination;
}): BriefCreateFromCurationCompositeResult {
  try {
    const { brief } = createBriefFromCurationEntry({
      curationEntryId: intent.curationEntryId,
      destination: intent.destination,
    });
    return {
      ok: true,
      message: `Strategic Brief DRAFT created (${brief.id}).`,
      briefId: brief.id,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not create Strategic Brief.',
      kind: 'warning',
    };
  }
}
