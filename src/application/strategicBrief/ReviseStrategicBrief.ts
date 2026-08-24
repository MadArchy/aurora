import type {
  BriefWhyNow,
  StrategicAuthorizedAction,
  StrategicBrief,
  StrategicDecisionSnapshot,
} from '../../domain/strategicBriefCore';
import {
  createBriefHistoryRecord,
  createDraftStrategicBrief,
  planMaterialRevisionFromApproved,
} from '../../domain/strategicBriefCore';
import { isMaterialStrategicContentChange } from '../../domain/briefMaterialityCore';
import type { OutputFormatRecommendation, StrategicDisposition } from '../../types';
import { StrategicBriefError } from './errors';
import { unwrapDomain } from './mapDomainError';
import { commitGovernedWriteUnit } from './commitWriteUnit';
import {
  assertEvidenceTenantOwnership,
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

export interface ReviseStrategicBriefFields {
  signalIds?: string[];
  primaryAudience?: string;
  geography?: string;
  territory?: string;
  framework?: string;
  whyNow?: BriefWhyNow;
  strategicAngle?: string;
  supportingEvidenceIds?: string[];
  riskFlags?: string[];
  recommendedChannel?: string;
  recommendedFormat?: string;
  CTA?: string;
  authorizedAction?: StrategicAuthorizedAction;
  decisionRationale?: string;
  dispositionDecision?: StrategicDisposition;
  formatDecision?: OutputFormatRecommendation;
  dispositionOverrideReason?: string;
  formatOverrideReason?: string;
}

export interface ReviseStrategicBriefInput {
  trusted: TrustedBriefActorContext;
  briefId: string;
  revisionId?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  fields: ReviseStrategicBriefFields;
  /** When false, return planned briefs without committing a write unit (used by Override). */
  persist?: boolean;
}

export interface ReviseStrategicBriefResult {
  brief: StrategicBrief;
  superseded?: StrategicBrief;
  revised: boolean;
  writeUnitCommitted: boolean;
}

export interface ReviseStrategicBriefDeps {
  briefs: StrategicBriefRepository;
  history: StrategicBriefHistoryPort;
  context: StrategicContextReader;
}

function mergeDecision(previous: StrategicBrief, fields: ReviseStrategicBriefFields): StrategicDecisionSnapshot {
  return {
    ...previous.decision,
    authorizedAction: fields.authorizedAction ?? previous.decision.authorizedAction,
    decisionRationale: fields.decisionRationale ?? previous.decision.decisionRationale,
    dispositionDecision: fields.dispositionDecision ?? previous.decision.dispositionDecision,
    formatDecision: fields.formatDecision ?? previous.decision.formatDecision,
    dispositionOverrideReason:
      fields.dispositionOverrideReason ?? previous.decision.dispositionOverrideReason,
    formatOverrideReason: fields.formatOverrideReason ?? previous.decision.formatOverrideReason,
  };
}

export function createReviseStrategicBrief(deps: ReviseStrategicBriefDeps) {
  return function reviseStrategicBrief(input: ReviseStrategicBriefInput): ReviseStrategicBriefResult {
    assertTrustedBriefActor(input.trusted);
    assertNoTenantSpoof(input);

    const previous = deps.briefs.getById(input.briefId, {
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
    });
    if (!previous) {
      throw new StrategicBriefError('BRIEF_NOT_FOUND', `Brief not found: ${input.briefId}`);
    }
    if (
      previous.organizationId !== input.trusted.organizationId ||
      previous.clientId !== input.trusted.clientId
    ) {
      throw new StrategicBriefError('TENANT_CONTEXT_INVALID', 'Brief tenant does not match trusted context.');
    }

    const signalIds = input.fields.signalIds ?? previous.signalIds;
    const evidenceIds = input.fields.supportingEvidenceIds ?? previous.supportingEvidenceIds;
    const cluster = loadGovernedSignalCluster(deps.context, signalIds, input.trusted);
    cluster.contexts.forEach(assertScoringContextPresent);
    assertEvidenceTenantOwnership(deps.context, evidenceIds, input.trusted);

    const nextDraft = unwrapDomain(
      createDraftStrategicBrief({
        id: previous.id,
        organizationId: previous.organizationId,
        clientId: previous.clientId,
        thesisId: cluster.thesisId,
        signalIds: cluster.contexts.map((c) => c.signalId),
        primaryAudience: input.fields.primaryAudience ?? previous.primaryAudience,
        geography: input.fields.geography ?? previous.geography,
        territory: input.fields.territory ?? previous.territory,
        framework: input.fields.framework ?? previous.framework,
        whyNow: input.fields.whyNow ?? previous.whyNow,
        strategicAngle: input.fields.strategicAngle ?? previous.strategicAngle,
        supportingEvidenceIds: evidenceIds,
        riskFlags: input.fields.riskFlags ?? previous.riskFlags,
        recommendedChannel: input.fields.recommendedChannel ?? previous.recommendedChannel,
        recommendedFormat: input.fields.recommendedFormat ?? previous.recommendedFormat,
        CTA: input.fields.CTA ?? previous.CTA,
        createdBy: previous.createdBy,
        createdAt: previous.createdAt,
        updatedAt: input.trusted.now,
        version: previous.version,
        decision: mergeDecision(previous, input.fields),
        supersedesBriefId: previous.supersedesBriefId ?? undefined,
      })
    );

    if (!isMaterialStrategicContentChange(previous, nextDraft)) {
      return { brief: previous, revised: false, writeUnitCommitted: false };
    }

    if (previous.status === 'DRAFT') {
      const updated: StrategicBrief = { ...nextDraft, status: 'DRAFT', version: previous.version };
      if (input.persist === false) {
        return { brief: updated, revised: true, writeUnitCommitted: false };
      }
      const history = unwrapDomain(
        createBriefHistoryRecord({
          brief: updated,
          actorId: input.trusted.actorId,
          source: 'HUMAN',
          changeType: 'REVISED',
          changedAt: input.trusted.now,
        })
      );
      commitGovernedWriteUnit(deps.briefs, deps.history, { briefs: [updated], history: [history] });
      return { brief: updated, revised: true, writeUnitCommitted: true };
    }

    if (previous.status !== 'APPROVED') {
      throw new StrategicBriefError(
        'BRIEF_STATE_INVALID',
        `Cannot revise Brief in status ${previous.status}.`
      );
    }

    const revisionId = input.revisionId?.trim() || `${previous.id}__v${previous.version + 1}`;
    const planned = unwrapDomain(
      planMaterialRevisionFromApproved({
        previous,
        now: input.trusted.now,
        nextInput: {
          id: revisionId,
          organizationId: previous.organizationId,
          clientId: previous.clientId,
          thesisId: cluster.thesisId,
          signalIds: cluster.contexts.map((c) => c.signalId),
          primaryAudience: nextDraft.primaryAudience,
          geography: nextDraft.geography,
          territory: nextDraft.territory,
          framework: nextDraft.framework,
          whyNow: nextDraft.whyNow,
          strategicAngle: nextDraft.strategicAngle,
          supportingEvidenceIds: nextDraft.supportingEvidenceIds,
          riskFlags: nextDraft.riskFlags,
          recommendedChannel: nextDraft.recommendedChannel,
          recommendedFormat: nextDraft.recommendedFormat,
          CTA: nextDraft.CTA,
          createdBy: input.trusted.actorId,
          createdAt: input.trusted.now,
          decision: nextDraft.decision,
          supersedesBriefId: previous.id,
        },
      })
    );

    const supersededHistory = unwrapDomain(
      createBriefHistoryRecord({
        brief: planned.superseded,
        actorId: input.trusted.actorId,
        source: 'HUMAN',
        changeType: 'SUPERSEDED',
        changedAt: input.trusted.now,
      })
    );
    const revisionHistory = unwrapDomain(
      createBriefHistoryRecord({
        brief: planned.revision,
        actorId: input.trusted.actorId,
        source: 'HUMAN',
        changeType: 'REVISED',
        changedAt: input.trusted.now,
      })
    );
    if (input.persist === false) {
      return {
        brief: planned.revision,
        superseded: planned.superseded,
        revised: true,
        writeUnitCommitted: false,
      };
    }
    commitGovernedWriteUnit(deps.briefs, deps.history, {
      briefs: [planned.superseded, planned.revision],
      history: [supersededHistory, revisionHistory],
    });
    return {
      brief: planned.revision,
      superseded: planned.superseded,
      revised: true,
      writeUnitCommitted: true,
    };
  };
}
