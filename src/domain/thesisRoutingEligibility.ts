import type { PositioningThesis, ThesisStatus } from '../types';

/** Statuses that never participate in production strategic routing. */
export const STRATEGIC_ROUTING_EXCLUDED_STATUSES: readonly ThesisStatus[] = [
  'DRAFT',
  'UNDER_REVIEW',
  'PAUSED',
  'ARCHIVED',
  'LEGACY',
] as const;

/**
 * Production strategic routing eligibility (SPEC-001).
 * Only ACTIVE theses are eligible.
 */
export function isThesisEligibleForStrategicRouting(
  thesis: Pick<PositioningThesis, 'status'>
): boolean {
  return thesis.status === 'ACTIVE';
}

/**
 * Pure filter — does not mutate input. Order of eligible theses is preserved.
 */
export function filterEligibleThesesForStrategicRouting(
  theses: readonly PositioningThesis[]
): PositioningThesis[] {
  return theses.filter(isThesisEligibleForStrategicRouting);
}
