import type { OutputFormatRecommendation, PriorityBand, StrategicDisposition } from '../../../types';
import type { BriefUpstreamRoutingSource, BriefUpstreamRoutingState, BriefWhyNow } from '../../../domain/strategicBriefCore';

/** Governed SPEC-001/002 projection — not a raw Signal document. */
export interface SignalStrategicContext {
  organizationId: string;
  clientId: string;
  signalId: string;
  routingState: BriefUpstreamRoutingState;
  /** Authoritative SPEC-001 selected thesis when CLEAR. Never legacy signal.thesisId. */
  governedThesisId?: string;
  routingAlgorithmVersion?: string;
  routingSource?: BriefUpstreamRoutingSource;
  routedAt?: string;
  scoringVersion?: string;
  totalScore?: number;
  priorityBand?: PriorityBand;
  scoredAt?: string;
  scoreSnapshotId?: string;
  routingSnapshotId?: string;
  recommendedDisposition?: StrategicDisposition;
  recommendedOutputFormat?: OutputFormatRecommendation;
  whyNow?: BriefWhyNow;
  scoreRationale?: string;
  evidenceIds?: string[];
}

export interface EvidenceTenantRef {
  evidenceId: string;
  organizationId: string;
  clientId: string;
}

/**
 * Read-only upstream context. Must not expose routing/score mutation ports.
 */
export interface StrategicContextReader {
  getSignalContext(signalId: string): SignalStrategicContext | undefined;
  getEvidenceTenant(evidenceId: string): EvidenceTenantRef | undefined;
}
