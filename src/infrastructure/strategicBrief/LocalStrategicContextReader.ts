import type {
  EvidenceTenantRef,
  SignalStrategicContext,
  StrategicContextReader,
} from '../../application/strategicBrief';
import type { BriefUpstreamRoutingSource, BriefUpstreamRoutingState } from '../../domain/strategicBriefCore';
import type { EvidenceVaultItem, Signal } from '../../types';

export interface StrategicBriefContextSource {
  getSignalById(signalId: string): Signal | undefined;
  getEvidenceById(evidenceId: string): Pick<EvidenceVaultItem, 'id' | 'organizationId' | 'clientId'> | undefined;
}

type RoutingDecisionProjection = NonNullable<Signal['routingDecision']> & {
  selectedThesisId?: string;
};

function readRoutingState(signal: Signal): BriefUpstreamRoutingState {
  const state = signal.routingDecision?.routingState;
  if (state === 'CLEAR' || state === 'CONTESTED' || state === 'UNROUTED') return state;
  return 'UNROUTED';
}

/**
 * Authoritative SPEC-001 selected thesis when routingState is CLEAR.
 *
 * Frozen SPEC-001 persist writes selectedThesisId onto routingDecision when present,
 * and mirrors the CLEAR projection on Signal.thesisId. That companion is used only
 * after routingState === CLEAR. CONTESTED / UNROUTED / missing routingState ignore
 * top-level thesisId (no legacy fallback).
 *
 * Never uses first-active or index-zero thesis selection, score-ranked winners,
 * or missing-routing-state compatibility attribution.
 */
function readGovernedThesisId(signal: Signal, routingState: BriefUpstreamRoutingState): string | undefined {
  if (routingState !== 'CLEAR') return undefined;
  const decision = signal.routingDecision as RoutingDecisionProjection | undefined;
  const fromDecision = decision?.selectedThesisId?.trim();
  if (fromDecision) return fromDecision;
  const fromClearProjection = signal.thesisId?.trim();
  return fromClearProjection || undefined;
}

function readRoutingSource(signal: Signal): BriefUpstreamRoutingSource | undefined {
  const source = signal.routingDecision?.source;
  if (source === 'AUTO' || source === 'MANUAL') return source;
  return undefined;
}

/**
 * Read-only SPEC-001 / SPEC-002 projection adapter.
 * Does not reroute, rescore, repair CONTESTED/UNROUTED, or write Signal fields.
 */
export class LocalStrategicContextReader implements StrategicContextReader {
  constructor(private readonly source: StrategicBriefContextSource) {}

  getSignalContext(signalId: string): SignalStrategicContext | undefined {
    const signal = this.source.getSignalById(signalId);
    if (!signal) return undefined;

    const governedRoutingState = readRoutingState(signal);
    const whyNow = signal.whyNow
      ? { reason: signal.whyNow.reason, score: signal.whyNow.score }
      : undefined;

    return {
      organizationId: signal.organizationId,
      clientId: signal.clientId ?? '',
      signalId: signal.id,
      routingState: governedRoutingState,
      governedThesisId: readGovernedThesisId(signal, governedRoutingState),
      routingAlgorithmVersion: signal.routingDecision?.algorithmVersion,
      routingSource: readRoutingSource(signal),
      routedAt: signal.routingDecision?.routedAt,
      scoringVersion: signal.scoringVersion,
      totalScore: signal.relevanceScore,
      priorityBand: signal.priorityBand,
      scoredAt: signal.scoredAt,
      recommendedDisposition: signal.recommendedDisposition,
      recommendedOutputFormat: signal.recommendedOutputFormat,
      whyNow,
      scoreRationale: signal.scoreRationale,
    };
  }

  getEvidenceTenant(evidenceId: string): EvidenceTenantRef | undefined {
    const item = this.source.getEvidenceById(evidenceId);
    if (!item) return undefined;
    return {
      evidenceId: item.id,
      organizationId: item.organizationId,
      clientId: item.clientId,
    };
  }
}
