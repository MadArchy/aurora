import type { TrustedSignalIntakeContext } from '../trustedContext';

/**
 * Canonical SPEC-001/SPEC-002 consumer seam — Signal Intake invokes, does not own routing/scoring.
 */
export interface PostIngestRoutingPort {
  scoreAndRouteAfterIngest(input: {
    signalId: string;
    trusted: TrustedSignalIntakeContext;
  }): void;
}
