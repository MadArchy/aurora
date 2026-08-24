import {
  approveDraftBrief,
  createBriefHistoryRecord,
  type StrategicBrief,
} from '../../domain/strategicBriefCore';
import { StrategicBriefError } from './errors';
import { unwrapDomain } from './mapDomainError';
import { commitGovernedWriteUnit } from './commitWriteUnit';
import {
  assertScoringContextPresent,
  loadGovernedSignalCluster,
} from './contextValidation';
import type { StrategicBriefHistoryPort } from './ports/StrategicBriefHistoryPort';
import type { StrategicBriefRepository } from './ports/StrategicBriefRepository';
import type { StrategicContextReader } from './ports/StrategicContextReader';
import {
  assertNoTenantSpoof,
  assertTrustedBriefActor,
  type TrustedBriefActorContext,
} from './trustedContext';

export interface ApproveStrategicBriefInput {
  trusted: TrustedBriefActorContext;
  briefId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  /** Ignored — approval identity comes from trusted actor. */
  approvedBy?: string;
}

export interface ApproveStrategicBriefResult {
  brief: StrategicBrief;
  alreadyApproved: boolean;
  writeUnitCommitted: boolean;
}

export interface ApproveStrategicBriefDeps {
  briefs: StrategicBriefRepository;
  history: StrategicBriefHistoryPort;
  context: StrategicContextReader;
}

function loadOwnedBrief(
  deps: ApproveStrategicBriefDeps,
  input: ApproveStrategicBriefInput
): StrategicBrief {
  const brief = deps.briefs.getById(input.briefId, {
    organizationId: input.trusted.organizationId,
    clientId: input.trusted.clientId,
  });
  if (!brief) {
    throw new StrategicBriefError('BRIEF_NOT_FOUND', `Brief not found: ${input.briefId}`);
  }
  if (
    brief.organizationId !== input.trusted.organizationId ||
    brief.clientId !== input.trusted.clientId
  ) {
    throw new StrategicBriefError(
      'TENANT_CONTEXT_INVALID',
      'Brief tenant does not match trusted context.'
    );
  }
  return brief;
}

/**
 * Re-reads live SPEC-001 routing. Scoring snapshot is not overwritten
 * (scoringVersion drift policy is Phase 3). Stale routing fails closed.
 */
export function createApproveStrategicBrief(deps: ApproveStrategicBriefDeps) {
  return function approveStrategicBrief(input: ApproveStrategicBriefInput): ApproveStrategicBriefResult {
    assertTrustedBriefActor(input.trusted);
    assertNoTenantSpoof(input);

    const current = loadOwnedBrief(deps, input);
    const cluster = loadGovernedSignalCluster(deps.context, current.signalIds, input.trusted);
    cluster.contexts.forEach(assertScoringContextPresent);
    if (cluster.thesisId !== current.thesisId) {
      throw new StrategicBriefError(
        'THESIS_CONTEXT_MISMATCH',
        'Live governed thesis no longer matches Brief thesisId — revise before approval.'
      );
    }

    if (current.status === 'APPROVED' && !current.supersededByBriefId) {
      return { brief: current, alreadyApproved: true, writeUnitCommitted: false };
    }

    const approved = unwrapDomain(
      approveDraftBrief(current, {
        approvedBy: input.trusted.actorId,
        approvedAt: input.trusted.now,
        routing: { routingState: 'CLEAR', governedThesisId: cluster.thesisId },
        signalRouting: cluster.contexts.map((c) => ({
          signalId: c.signalId,
          routingState: 'CLEAR' as const,
          governedThesisId: cluster.thesisId,
        })),
      })
    );

    const history = unwrapDomain(
      createBriefHistoryRecord({
        brief: approved,
        actorId: input.trusted.actorId,
        source: 'HUMAN',
        changeType: 'APPROVED',
        changedAt: input.trusted.now,
      })
    );
    commitGovernedWriteUnit(deps.briefs, deps.history, { briefs: [approved], history: [history] });
    return { brief: approved, alreadyApproved: false, writeUnitCommitted: true };
  };
}
