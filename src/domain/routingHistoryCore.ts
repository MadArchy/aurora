import type {
  MaterialRoutingDecision,
  SignalRoutingSource,
  SignalRoutingState,
} from './thesisRoutingCore';

/** Neutral actor for AUTO routing history. */
export const ROUTING_SYSTEM_ACTOR_ID = 'SYSTEM' as const;

/**
 * Material snapshot used for history comparison and audit entries.
 * Rationale / routedAt are intentionally excluded from materiality.
 */
export interface RoutingHistoryMaterialSnapshot {
  routingState: SignalRoutingState;
  selectedThesisId?: string;
  source: SignalRoutingSource;
  algorithmVersion: string;
}

/**
 * Bounded history entry for a material routing transition.
 * Physical storage is infrastructure-owned; this type is storage-neutral.
 *
 * Forbidden: raw AI output, API keys, Authorization headers, full Signal copies.
 */
export interface SignalRoutingHistoryEntry {
  id: string;
  organizationId: string;
  clientId: string;
  signalId: string;
  previous: RoutingHistoryMaterialSnapshot;
  next: RoutingHistoryMaterialSnapshot;
  /** SYSTEM for AUTO; trusted manager actorId for MANUAL. */
  actorId: string;
  changedAt: string;
  /** Optional explainability note — not a materiality field. */
  rationale?: string;
}

export function toRoutingHistorySnapshot(
  decision: MaterialRoutingDecision
): RoutingHistoryMaterialSnapshot {
  return {
    routingState: decision.routingState,
    selectedThesisId: decision.selectedThesisId,
    source: decision.source,
    algorithmVersion: decision.algorithmVersion,
  };
}

/**
 * Material change = any of routingState | selectedThesisId | source | algorithmVersion.
 * Timestamp-only / rationale-only changes are NOT material.
 *
 * First assignment (no previous): returns false — no history noise on INITIAL.
 */
export function isMaterialRoutingChange(
  previous: RoutingHistoryMaterialSnapshot | null | undefined,
  next: RoutingHistoryMaterialSnapshot
): boolean {
  if (!previous) return false;
  return (
    previous.routingState !== next.routingState ||
    (previous.selectedThesisId ?? '') !== (next.selectedThesisId ?? '') ||
    previous.source !== next.source ||
    previous.algorithmVersion !== next.algorithmVersion
  );
}

export function createRoutingHistoryEntry(params: {
  organizationId: string;
  clientId: string;
  signalId: string;
  previous: RoutingHistoryMaterialSnapshot;
  next: RoutingHistoryMaterialSnapshot;
  actorId: string;
  changedAt: string;
  rationale?: string;
}): SignalRoutingHistoryEntry {
  const id = `rh_${params.signalId}_${params.changedAt.replace(/[:.]/g, '')}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  return {
    id,
    organizationId: params.organizationId,
    clientId: params.clientId,
    signalId: params.signalId,
    previous: params.previous,
    next: params.next,
    actorId: params.actorId,
    changedAt: params.changedAt,
    rationale: params.rationale,
  };
}
