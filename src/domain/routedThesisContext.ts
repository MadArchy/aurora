import type { PositioningThesis, Signal } from '../types';

/**
 * Resolve strategic thesis context from a Signal's governed routing result.
 * Never invents primary / first-thesis attribution.
 */
export type RoutedThesisResolution =
  | { status: 'CLEAR'; thesisId: string }
  | { status: 'CONTESTED' }
  | { status: 'UNROUTED' }
  | { status: 'NO_SIGNAL' };

export function resolveRoutedThesisFromSignal(
  signal: Signal | undefined | null
): RoutedThesisResolution {
  if (!signal) return { status: 'NO_SIGNAL' };

  const state = signal.routingDecision?.routingState;

  if (state === 'CONTESTED') return { status: 'CONTESTED' };
  if (state === 'UNROUTED') return { status: 'UNROUTED' };

  if (state === 'CLEAR') {
    // Compatibility thesisId mirrors selectedThesisId when CLEAR (Phase 2–3).
    if (signal.thesisId) return { status: 'CLEAR', thesisId: signal.thesisId };
    return { status: 'UNROUTED' };
  }

  // Legacy signals without routingState: thesisId implies prior attribution.
  if (signal.thesisId) return { status: 'CLEAR', thesisId: signal.thesisId };

  return { status: 'UNROUTED' };
}

/** Lookup helper — returns undefined when id missing or not in list. */
export function findThesisById(
  theses: PositioningThesis[],
  thesisId: string | undefined
): PositioningThesis | undefined {
  if (!thesisId) return undefined;
  return theses.find((t) => t.id === thesisId);
}

export type StrategicThesisLookupError =
  | 'CONTESTED'
  | 'UNROUTED'
  | 'NO_SIGNAL'
  | 'THESIS_NOT_FOUND';

/**
 * Resolve a PositioningThesis for a signal-specific strategic/advisory operation.
 * Fail-closed on CONTESTED / UNROUTED — never falls back to first ACTIVE.
 */
export function resolveThesisForSignalOperation(
  signal: Signal | undefined | null,
  theses: PositioningThesis[]
):
  | { ok: true; thesis: PositioningThesis }
  | { ok: false; error: StrategicThesisLookupError } {
  const routed = resolveRoutedThesisFromSignal(signal);
  if (routed.status === 'NO_SIGNAL') return { ok: false, error: 'NO_SIGNAL' };
  if (routed.status === 'CONTESTED') return { ok: false, error: 'CONTESTED' };
  if (routed.status === 'UNROUTED') return { ok: false, error: 'UNROUTED' };
  const thesis = findThesisById(theses, routed.thesisId);
  if (!thesis) return { ok: false, error: 'THESIS_NOT_FOUND' };
  return { ok: true, thesis };
}
