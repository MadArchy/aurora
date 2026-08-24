import type {
  AiAdvisoryRef,
  BriefWhyNow,
  StrategicAuthorizedAction,
  StrategicBrief,
  StrategicDecisionSnapshot,
} from '../../domain/strategicBriefCore';
import {
  createBriefHistoryRecord,
  createDraftStrategicBrief,
} from '../../domain/strategicBriefCore';
import type { OutputFormatRecommendation, StrategicDisposition } from '../../types';
import {
  assertEvidenceTenantOwnership,
  assertScoringContextPresent,
  loadGovernedSignalCluster,
  sortedSignalIds,
} from './contextValidation';
import { StrategicBriefError } from './errors';
import { unwrapDomain } from './mapDomainError';
import { commitGovernedWriteUnit } from './commitWriteUnit';
import type { StrategicBriefHistoryPort } from './ports/StrategicBriefHistoryPort';
import type { StrategicBriefRepository } from './ports/StrategicBriefRepository';
import type { SignalStrategicContext, StrategicContextReader } from './ports/StrategicContextReader';
import {
  assertNoTenantSpoof,
  assertTrustedBriefActor,
  type TrustedBriefActorContext,
} from './trustedContext';

export interface CreateStrategicBriefInput {
  trusted: TrustedBriefActorContext;
  briefId: string;
  signalIds: string[];
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedThesisId?: string;
  primaryAudience: string;
  geography: string;
  territory: string;
  framework: string;
  whyNow?: BriefWhyNow;
  strategicAngle: string;
  supportingEvidenceIds: string[];
  riskFlags: string[];
  recommendedChannel: string;
  recommendedFormat: string;
  CTA: string;
  authorizedAction: StrategicAuthorizedAction;
  decisionRationale: string;
  dispositionDecision?: StrategicDisposition;
  formatDecision?: OutputFormatRecommendation;
  dispositionOverrideReason?: string;
  formatOverrideReason?: string;
  aiAdvisoryRefs?: AiAdvisoryRef[];
}

export interface CreateStrategicBriefResult {
  brief: StrategicBrief;
  created: boolean;
  writeUnitCommitted: boolean;
}

export interface CreateStrategicBriefDeps {
  briefs: StrategicBriefRepository;
  history: StrategicBriefHistoryPort;
  context: StrategicContextReader;
}

function whyNowKey(value: BriefWhyNow | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value : JSON.stringify({ reason: value.reason, score: value.score ?? null });
}

function resolveWhyNow(
  input: CreateStrategicBriefInput,
  contexts: SignalStrategicContext[]
): BriefWhyNow {
  if (input.whyNow !== undefined) return input.whyNow;
  const keys = contexts.map((c) => whyNowKey(c.whyNow));
  const unique = new Set(keys.filter((k) => k !== undefined));
  if (unique.size === 1 && contexts[0].whyNow !== undefined) {
    return contexts[0].whyNow;
  }
  throw new StrategicBriefError(
    'STRATEGIC_CONTEXT_INVALID',
    'whyNow must be provided when upstream whyNow values are missing or disagree.'
  );
}

function uniqueOrUndefined<T>(values: Array<T | undefined>): T | undefined {
  const present = values.filter((v): v is T => v !== undefined);
  if (present.length === 0) return undefined;
  const first = present[0];
  if (present.every((v) => v === first)) return first;
  return undefined;
}

function buildDecisionSnapshot(
  input: CreateStrategicBriefInput,
  contexts: SignalStrategicContext[]
): StrategicDecisionSnapshot {
  const upstreamDispositionRec = uniqueOrUndefined(contexts.map((c) => c.recommendedDisposition));
  const upstreamFormatRec = uniqueOrUndefined(contexts.map((c) => c.recommendedOutputFormat));
  const dispositionDecision = input.dispositionDecision ?? upstreamDispositionRec;
  const formatDecision = input.formatDecision ?? upstreamFormatRec;
  if (!dispositionDecision || !formatDecision) {
    throw new StrategicBriefError(
      'STRATEGIC_CONTEXT_INVALID',
      'dispositionDecision and formatDecision must be explicit when upstream recommendations disagree or are missing.'
    );
  }

  const sharedScoringVersion = uniqueOrUndefined(contexts.map((c) => c.scoringVersion));
  const sharedTotalScore = uniqueOrUndefined(contexts.map((c) => c.totalScore));
  const sharedPriorityBand = uniqueOrUndefined(contexts.map((c) => c.priorityBand));
  if (!sharedScoringVersion) {
    throw new StrategicBriefError(
      'STRATEGIC_CONTEXT_INVALID',
      'All signals must share a scoringVersion for the Brief snapshot.'
    );
  }

  return {
    decisionRationale: input.decisionRationale,
    authorizedAction: input.authorizedAction,
    dispositionDecision,
    formatDecision,
    dispositionOverrideReason: input.dispositionOverrideReason,
    formatOverrideReason: input.formatOverrideReason,
    upstreamRoutingRef: {
      routingState: 'CLEAR',
      algorithmVersion: uniqueOrUndefined(contexts.map((c) => c.routingAlgorithmVersion)),
      routedAt: uniqueOrUndefined(contexts.map((c) => c.routedAt)),
      source: uniqueOrUndefined(contexts.map((c) => c.routingSource)),
    },
    upstreamScoreRef: {
      scoringVersion: sharedScoringVersion,
      totalScore: sharedTotalScore,
      priorityBand: sharedPriorityBand,
      scoredAt: uniqueOrUndefined(contexts.map((c) => c.scoredAt)),
      recommendedDisposition: upstreamDispositionRec,
      recommendedOutputFormat: upstreamFormatRec,
    },
    signalContextRefs: contexts.map((c) => ({
      signalId: c.signalId,
      scoreSnapshotId: c.scoreSnapshotId,
      routingSnapshotId: c.routingSnapshotId,
    })),
    aiAdvisoryRefs: input.aiAdvisoryRefs,
  };
}

export function createCreateStrategicBrief(deps: CreateStrategicBriefDeps) {
  return function createStrategicBrief(input: CreateStrategicBriefInput): CreateStrategicBriefResult {
    assertTrustedBriefActor(input.trusted);
    assertNoTenantSpoof(input);
    if (!input.briefId?.trim()) {
      throw new StrategicBriefError('STRATEGIC_CONTEXT_INVALID', 'briefId is required.');
    }

    const cluster = loadGovernedSignalCluster(deps.context, input.signalIds, input.trusted);
    cluster.contexts.forEach(assertScoringContextPresent);
    assertEvidenceTenantOwnership(deps.context, input.supportingEvidenceIds, input.trusted);

    if (input.claimedThesisId && input.claimedThesisId !== cluster.thesisId) {
      throw new StrategicBriefError(
        'THESIS_CONTEXT_MISMATCH',
        'Caller-supplied thesisId does not match governed CLEAR selected thesis.'
      );
    }

    const existing = deps.briefs.findCurrentByScope({
      organizationId: input.trusted.organizationId,
      clientId: input.trusted.clientId,
      thesisId: cluster.thesisId,
      signalIds: sortedSignalIds(cluster.contexts.map((c) => c.signalId)),
    });
    if (existing && existing.status === 'DRAFT') {
      return { brief: existing, created: false, writeUnitCommitted: false };
    }
    if (existing && existing.status === 'APPROVED') {
      throw new StrategicBriefError(
        'BRIEF_STATE_INVALID',
        'An APPROVED Brief already exists for this scope — revise instead of creating a duplicate.'
      );
    }

    const decision = buildDecisionSnapshot(input, cluster.contexts);
    const brief = unwrapDomain(
      createDraftStrategicBrief({
        id: input.briefId.trim(),
        organizationId: input.trusted.organizationId,
        clientId: input.trusted.clientId,
        thesisId: cluster.thesisId,
        signalIds: cluster.contexts.map((c) => c.signalId),
        primaryAudience: input.primaryAudience,
        geography: input.geography,
        territory: input.territory,
        framework: input.framework,
        whyNow: resolveWhyNow(input, cluster.contexts),
        strategicAngle: input.strategicAngle,
        supportingEvidenceIds: input.supportingEvidenceIds,
        riskFlags: input.riskFlags,
        recommendedChannel: input.recommendedChannel,
        recommendedFormat: input.recommendedFormat,
        CTA: input.CTA,
        createdBy: input.trusted.actorId,
        createdAt: input.trusted.now,
        decision,
      })
    );

    const history = unwrapDomain(
      createBriefHistoryRecord({
        brief,
        actorId: input.trusted.actorId,
        source: 'HUMAN',
        changeType: 'CREATED',
        changedAt: input.trusted.now,
      })
    );

    commitGovernedWriteUnit(deps.briefs, deps.history, { briefs: [brief], history: [history] });
    return { brief, created: true, writeUnitCommitted: true };
  };
}
