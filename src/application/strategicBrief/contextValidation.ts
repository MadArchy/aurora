import { StrategicBriefError } from './errors';
import type { TrustedBriefActorContext } from './trustedContext';
import type {
  EvidenceTenantRef,
  SignalStrategicContext,
  StrategicContextReader,
} from './ports/StrategicContextReader';

export interface GovernedSignalCluster {
  thesisId: string;
  contexts: SignalStrategicContext[];
}

function assertSameTenant(
  ctx: SignalStrategicContext,
  trusted: TrustedBriefActorContext
): void {
  if (ctx.organizationId !== trusted.organizationId || ctx.clientId !== trusted.clientId) {
    throw new StrategicBriefError(
      'TENANT_CONTEXT_INVALID',
      `Signal ${ctx.signalId} does not belong to the trusted tenant.`
    );
  }
}

function assertClearThesis(ctx: SignalStrategicContext): string {
  if (ctx.routingState === 'CONTESTED') {
    throw new StrategicBriefError(
      'ROUTING_CONTEXT_CONTESTED',
      `Signal ${ctx.signalId} is CONTESTED — cannot form an actionable Brief.`
    );
  }
  if (ctx.routingState === 'UNROUTED') {
    throw new StrategicBriefError(
      'ROUTING_CONTEXT_UNROUTED',
      `Signal ${ctx.signalId} is UNROUTED — cannot form an actionable Brief.`
    );
  }
  if (ctx.routingState !== 'CLEAR') {
    throw new StrategicBriefError(
      'ROUTING_CONTEXT_REQUIRED',
      `Signal ${ctx.signalId} has no CLEAR routing context.`
    );
  }
  if (!ctx.governedThesisId?.trim()) {
    throw new StrategicBriefError(
      'ROUTING_NOT_CLEAR',
      `CLEAR signal ${ctx.signalId} is missing governed selected thesis.`
    );
  }
  return ctx.governedThesisId;
}

export function loadGovernedSignalCluster(
  reader: StrategicContextReader,
  signalIds: readonly string[],
  trusted: TrustedBriefActorContext
): GovernedSignalCluster {
  if (!signalIds.length) {
    throw new StrategicBriefError('STRATEGIC_CONTEXT_INVALID', 'signalIds must not be empty.');
  }
  const unique = [...new Set(signalIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length !== signalIds.length) {
    throw new StrategicBriefError('STRATEGIC_CONTEXT_INVALID', 'signalIds must be unique and non-empty.');
  }

  const contexts: SignalStrategicContext[] = [];
  let thesisId: string | undefined;

  for (const signalId of unique) {
    const ctx = reader.getSignalContext(signalId);
    if (!ctx) {
      throw new StrategicBriefError('SIGNAL_NOT_FOUND', `Signal not found: ${signalId}`);
    }
    assertSameTenant(ctx, trusted);
    const governed = assertClearThesis(ctx);
    if (!thesisId) thesisId = governed;
    else if (governed !== thesisId) {
      throw new StrategicBriefError(
        'THESIS_CONTEXT_MISMATCH',
        'Mixed-thesis signal clusters cannot form one Brief.'
      );
    }
    contexts.push(ctx);
  }

  if (!thesisId) {
    throw new StrategicBriefError('ROUTING_NOT_CLEAR', 'No governed thesis resolved.');
  }
  return { thesisId, contexts };
}

export function assertEvidenceTenantOwnership(
  reader: StrategicContextReader,
  evidenceIds: readonly string[],
  trusted: TrustedBriefActorContext
): void {
  for (const evidenceId of evidenceIds) {
    if (!evidenceId.trim()) {
      throw new StrategicBriefError('STRATEGIC_CONTEXT_INVALID', 'evidence ids must be non-empty.');
    }
    const ref: EvidenceTenantRef | undefined = reader.getEvidenceTenant(evidenceId);
    if (!ref) {
      throw new StrategicBriefError(
        'STRATEGIC_CONTEXT_INVALID',
        `Evidence not found: ${evidenceId}`
      );
    }
    if (ref.organizationId !== trusted.organizationId || ref.clientId !== trusted.clientId) {
      throw new StrategicBriefError(
        'TENANT_CONTEXT_INVALID',
        `Evidence ${evidenceId} does not belong to the trusted tenant.`
      );
    }
  }
}

export function assertScoringContextPresent(ctx: SignalStrategicContext): void {
  if (!ctx.scoringVersion?.trim()) {
    throw new StrategicBriefError(
      'STRATEGIC_CONTEXT_INVALID',
      `Signal ${ctx.signalId} is missing scoringVersion.`
    );
  }
}

export function sortedSignalIds(ids: readonly string[]): string[] {
  return [...ids].slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
