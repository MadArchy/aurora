import type { StrategicBrief, StrategicBriefOverrideRecord } from '../../domain/strategicBriefCore';
import {
  assertOverridePreservesInvariants,
  createBriefHistoryRecord,
  toMaterialIdentity,
  validateOverrideRecord,
} from '../../domain/strategicBriefCore';
import { listMaterialBriefFieldChanges } from '../../domain/briefMaterialityCore';
import { StrategicBriefError } from './errors';
import { unwrapDomain } from './mapDomainError';
import { commitGovernedWriteUnit } from './commitWriteUnit';
import { loadGovernedSignalCluster } from './contextValidation';
import type { StrategicBriefHistoryPort } from './ports/StrategicBriefHistoryPort';
import type { StrategicBriefRepository } from './ports/StrategicBriefRepository';
import type { StrategicContextReader } from './ports/StrategicContextReader';
import {
  createReviseStrategicBrief,
  type ReviseStrategicBriefFields,
} from './ReviseStrategicBrief';
import {
  assertNoTenantSpoof,
  assertTrustedBriefActor,
  type TrustedBriefActorContext,
} from './trustedContext';

export interface OverrideStrategicBriefInput {
  trusted: TrustedBriefActorContext;
  briefId: string;
  reason: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  fields: ReviseStrategicBriefFields;
}

export interface OverrideStrategicBriefResult {
  brief: StrategicBrief;
  superseded?: StrategicBrief;
  audit: StrategicBriefOverrideRecord;
  writeUnitCommitted: boolean;
}

export interface OverrideStrategicBriefDeps {
  briefs: StrategicBriefRepository;
  history: StrategicBriefHistoryPort;
  context: StrategicContextReader;
}

export function createOverrideStrategicBrief(deps: OverrideStrategicBriefDeps) {
  const revise = createReviseStrategicBrief(deps);

  return function overrideStrategicBrief(input: OverrideStrategicBriefInput): OverrideStrategicBriefResult {
    assertTrustedBriefActor(input.trusted);
    assertNoTenantSpoof(input);
    if (!input.reason?.trim()) {
      throw new StrategicBriefError('OVERRIDE_INVALID', 'Override reason is required.');
    }

    const previous = deps.briefs.getById(input.briefId, {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    });
    if (!previous) {
      throw new StrategicBriefError('BRIEF_NOT_FOUND', `Brief not found: ${input.briefId}`);
    }

    const cluster = loadGovernedSignalCluster(deps.context, previous.signalIds, input.trusted);
    const revised = revise({
      trusted: input.trusted,
      briefId: input.briefId,
      fields: input.fields,
      persist: false,
    });

    if (!revised.revised) {
      throw new StrategicBriefError('OVERRIDE_INVALID', 'Override requires a material strategic change.');
    }

    unwrapDomain(
      assertOverridePreservesInvariants({
        previous,
        next: revised.brief,
        routing: { routingState: 'CLEAR', governedThesisId: cluster.thesisId },
        signalRouting: cluster.contexts.map((c) => ({
          signalId: c.signalId,
          routingState: 'CLEAR' as const,
          governedThesisId: cluster.thesisId,
        })),
      })
    );

    if (revised.brief.status === 'APPROVED') {
      throw new StrategicBriefError(
        'OVERRIDE_INVALID',
        'Override cannot set APPROVED — explicit ApproveStrategicBrief is required.'
      );
    }

    const materialFieldsChanged = listMaterialBriefFieldChanges(previous, revised.brief);
    const audit = unwrapDomain(
      validateOverrideRecord({
        overrideId: `ovr_${previous.id}_v${previous.version}_${input.trusted.now.replace(/[:.]/g, '')}`,
        briefId: previous.id,
        briefVersion: previous.version,
        organizationId: previous.organizationId,
        clientId: previous.clientId,
        actorId: input.trusted.actorId,
        reason: input.reason.trim(),
        previousState: toMaterialIdentity(previous),
        newState: toMaterialIdentity(revised.brief),
        materialFieldsChanged,
        timestamp: input.trusted.now,
      })
    );

    const overrideHistory = unwrapDomain(
      createBriefHistoryRecord({
        brief: revised.brief,
        actorId: input.trusted.actorId,
        source: 'HUMAN',
        changeType: 'OVERRIDDEN',
        changedAt: input.trusted.now,
      })
    );

    commitGovernedWriteUnit(deps.briefs, deps.history, {
      briefs: revised.superseded ? [revised.superseded, revised.brief] : [revised.brief],
      history: [overrideHistory],
      overrideAudit: audit,
    });

    return {
      brief: revised.brief,
      superseded: revised.superseded,
      audit,
      writeUnitCommitted: true,
    };
  };
}
