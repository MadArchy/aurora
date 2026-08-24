import {
  createBriefHistoryRecord,
  rejectDraftBrief,
  type StrategicBrief,
} from '../../domain/strategicBriefCore';
import { StrategicBriefError } from './errors';
import { unwrapDomain } from './mapDomainError';
import { commitGovernedWriteUnit } from './commitWriteUnit';
import type { StrategicBriefHistoryPort } from './ports/StrategicBriefHistoryPort';
import type { StrategicBriefRepository } from './ports/StrategicBriefRepository';
import {
  assertNoTenantSpoof,
  assertTrustedBriefActor,
  type TrustedBriefActorContext,
} from './trustedContext';

export interface RejectStrategicBriefInput {
  trusted: TrustedBriefActorContext;
  briefId: string;
  rejectionReason: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface RejectStrategicBriefResult {
  brief: StrategicBrief;
  alreadyRejected: boolean;
  writeUnitCommitted: boolean;
}

export interface RejectStrategicBriefDeps {
  briefs: StrategicBriefRepository;
  history: StrategicBriefHistoryPort;
}

export function createRejectStrategicBrief(deps: RejectStrategicBriefDeps) {
  return function rejectStrategicBrief(input: RejectStrategicBriefInput): RejectStrategicBriefResult {
    assertTrustedBriefActor(input.trusted);
    assertNoTenantSpoof(input);

    const current = deps.briefs.getById(input.briefId, {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    });
    if (!current) {
      throw new StrategicBriefError('BRIEF_NOT_FOUND', `Brief not found: ${input.briefId}`);
    }
    if (
      current.organizationId !== input.trusted.organizationId ||
      current.clientId !== input.trusted.clientId
    ) {
      throw new StrategicBriefError('TENANT_CONTEXT_INVALID', 'Brief tenant does not match trusted context.');
    }

    if (current.status === 'REJECTED') {
      return { brief: current, alreadyRejected: true, writeUnitCommitted: false };
    }

    const rejected = unwrapDomain(
      rejectDraftBrief(current, {
        rejectionReason: input.rejectionReason,
        rejectedAt: input.trusted.now,
      })
    );
    const history = unwrapDomain(
      createBriefHistoryRecord({
        brief: rejected,
        actorId: input.trusted.actorId,
        source: 'HUMAN',
        changeType: 'REJECTED',
        changedAt: input.trusted.now,
      })
    );
    commitGovernedWriteUnit(deps.briefs, deps.history, { briefs: [rejected], history: [history] });
    return { brief: rejected, alreadyRejected: false, writeUnitCommitted: true };
  };
}
