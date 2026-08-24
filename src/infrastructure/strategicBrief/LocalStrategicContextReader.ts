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

function readRoutingState(signal: Signal): BriefUpstreamRoutingState {
  const state = signal.routingDecision?.routingState;
  if (state === 'CLEAR' || state === 'CONTESTED' || state === 'UNROUTED') return state;
  return 'UNROUTED';
}

/**
 * Authoritative SPEC-001 selected thesis when routingState is CLEAR.
 *
 * Exclusive source: routingDecision.selectedThesisId.
 * CLEAR without that field returns no governed thesis (Application fail-closed).
 * CONTESTED / UNROUTED return none. Never infers from compatibility projection,
 * thesisScores, or first/primary thesis selection.
 */
function readGovernedThesisId(signal: Signal, routingState: BriefUpstreamRoutingState): string | undefined {
  if (routingState !== 'CLEAR') return undefined;
  const selected = signal.routingDecision?.selectedThesisId?.trim();
  return selected || undefined;
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
