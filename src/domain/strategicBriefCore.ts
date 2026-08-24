import type { OutputFormatRecommendation, PriorityBand, StrategicDisposition } from '../types';
import { isMaterialBriefChange, isMaterialStrategicContentChange, briefMaterialFingerprint } from './briefMaterialityCore';
import {
  evaluateBriefRoutingEligibility,
  type BriefRoutingContextInput,
  type SignalRoutingContextInput,
} from './briefRoutingGateCore';
import {
  briefFail,
  briefOk,
  type BriefDomainResult,
} from './strategicBriefErrors';
import { assertBriefTenantStructure, type BriefTenantEnvelope } from './briefTenantCore';

export {
  briefFail,
  briefOk,
  StrategicBriefDomainError,
  type BriefDomainResult,
  type StrategicBriefDomainErrorCode,
} from './strategicBriefErrors';

/** Brief schema compatibility label — distinct from content `version` and SPEC-002 `scoringVersion`. */
export const BRIEF_SCHEMA_VERSION = 'brief-v1' as const;
export type BriefSchemaVersion = typeof BRIEF_SCHEMA_VERSION;

export const BRIEF_STATUSES = ['DRAFT', 'APPROVED', 'REJECTED', 'SUPERSEDED'] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

/**
 * Governed downstream authorization enum (brief-model.md).
 * Channel/format live on the Brief; this is the action gate, not a content-type copy.
 */
export const STRATEGIC_AUTHORIZED_ACTIONS = [
  'CREATE_CONTENT',
  'CREATE_OPPORTUNITY',
  'CREATE_TASK',
  'RESEARCH_ONLY',
  'NONE',
] as const;
export type StrategicAuthorizedAction = (typeof STRATEGIC_AUTHORIZED_ACTIONS)[number];

export const STRATEGIC_DOWNSTREAM_ACTIONS = [
  'CREATE_CONTENT',
  'CREATE_OPPORTUNITY',
  'CREATE_TASK',
] as const;
export type StrategicDownstreamAction = (typeof STRATEGIC_DOWNSTREAM_ACTIONS)[number];

export type BriefUpstreamRoutingState = 'CLEAR' | 'CONTESTED' | 'UNROUTED';
export type BriefUpstreamRoutingSource = 'AUTO' | 'MANUAL';

export type BriefWhyNow = string | { reason: string; score?: number };

export interface UpstreamRoutingRef {
  routingState: BriefUpstreamRoutingState;
  algorithmVersion?: string;
  routedAt?: string;
  source?: BriefUpstreamRoutingSource;
}

export interface UpstreamScoreRef {
  scoringVersion: string;
  totalScore?: number;
  priorityBand?: PriorityBand;
  scoredAt?: string;
  /** SPEC-002 recommendation snapshot — input only, not authority. */
  recommendedDisposition?: StrategicDisposition;
  recommendedOutputFormat?: OutputFormatRecommendation;
}

export interface SignalContextRef {
  signalId: string;
  scoreSnapshotId?: string;
  routingSnapshotId?: string;
}

/** Advisory audit only — never approval or thesis authority. */
export interface AiAdvisoryRef {
  operation: string;
  aiRunId?: string;
  suggestedAngle?: string;
}

export interface StrategicDecisionSnapshot {
  decisionRationale: string;
  authorizedAction: StrategicAuthorizedAction;
  dispositionDecision: StrategicDisposition;
  formatDecision: OutputFormatRecommendation;
  dispositionOverrideReason?: string;
  formatOverrideReason?: string;
  upstreamRoutingRef: UpstreamRoutingRef;
  upstreamScoreRef: UpstreamScoreRef;
  signalContextRefs: SignalContextRef[];
  aiAdvisoryRefs?: AiAdvisoryRef[];
}

export interface StrategicBrief {
  id: string;
  organizationId: string;
  clientId: string;
  thesisId: string;
  signalIds: string[];
  primaryAudience: string;
  geography: string;
  territory: string;
  framework: string;
  whyNow: BriefWhyNow;
  strategicAngle: string;
  supportingEvidenceIds: string[];
  riskFlags: string[];
  recommendedChannel: string;
  recommendedFormat: string;
  CTA: string;
  status: BriefStatus;
  createdBy: string;
  approvedBy: string | null;
  version: number;
  schemaVersion: BriefSchemaVersion;
  decision: StrategicDecisionSnapshot;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  supersededByBriefId?: string | null;
  supersedesBriefId?: string | null;
  rejectionReason?: string | null;
}

export type BriefHistoryChangeType =
  | 'CREATED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'REVISED'
  | 'OVERRIDDEN';

/** Domain history contract — no repository/storage. */
export interface StrategicBriefHistoryRecord {
  briefId: string;
  version: number;
  status: BriefStatus;
  decision: StrategicDecisionSnapshot;
  organizationId: string;
  clientId: string;
  actorId: string;
  source: 'HUMAN' | 'SYSTEM';
  changeType: BriefHistoryChangeType;
  changedAt: string;
  materialFingerprint: string;
}

export interface StrategicBriefOverrideRecord {
  overrideId: string;
  briefId: string;
  briefVersion: number;
  organizationId: string;
  clientId: string;
  actorId: string;
  reason: string;
  previousState: StrategicBriefMaterialIdentity;
  newState: StrategicBriefMaterialIdentity;
  materialFieldsChanged: string[];
  timestamp: string;
}

/** Storage-neutral material identity — not a cryptographic hash. */
export interface StrategicBriefMaterialIdentity {
  organizationId: string;
  clientId: string;
  thesisId: string;
  signalIds: string[];
  version: number;
  status: BriefStatus;
  fingerprint: string;
}

export interface CreateDraftStrategicBriefInput {
  id: string;
  organizationId: string;
  clientId: string;
  thesisId: string;
  signalIds: string[];
  primaryAudience: string;
  geography: string;
  territory: string;
  framework: string;
  whyNow: BriefWhyNow;
  strategicAngle: string;
  supportingEvidenceIds: string[];
  riskFlags: string[];
  recommendedChannel: string;
  recommendedFormat: string;
  CTA: string;
  createdBy: string;
  decision: StrategicDecisionSnapshot;
  createdAt: string;
  updatedAt?: string;
  version?: number;
  schemaVersion?: BriefSchemaVersion;
  supersedesBriefId?: string;
}

export const BRIEF_STATUS_TRANSITIONS: Record<BriefStatus, readonly BriefStatus[]> = {
  DRAFT: ['APPROVED', 'REJECTED', 'SUPERSEDED'],
  APPROVED: ['SUPERSEDED'],
  REJECTED: ['DRAFT'],
  SUPERSEDED: [],
};

export function canTransitionBriefStatus(from: BriefStatus, to: BriefStatus): boolean {
  return BRIEF_STATUS_TRANSITIONS[from].includes(to);
}

export function isBriefStatus(value: unknown): value is BriefStatus {
  return typeof value === 'string' && (BRIEF_STATUSES as readonly string[]).includes(value);
}

export function isStrategicAuthorizedAction(value: unknown): value is StrategicAuthorizedAction {
  return (
    typeof value === 'string' && (STRATEGIC_AUTHORIZED_ACTIONS as readonly string[]).includes(value)
  );
}

export function isPositiveBriefVersion(version: unknown): version is number {
  return typeof version === 'number' && Number.isInteger(version) && version >= 1;
}

export function nextBriefVersion(current: number): BriefDomainResult<number> {
  if (!isPositiveBriefVersion(current)) {
    return briefFail('INVALID_BRIEF', 'version must be a monotonic integer >= 1');
  }
  return briefOk(current + 1);
}

export function assertMonotonicBriefVersion(
  previous: number,
  next: number
): BriefDomainResult<number> {
  const expected = nextBriefVersion(previous);
  if (!expected.ok) return expected;
  if (next !== expected.value) {
    return briefFail(
      'INVALID_BRIEF',
      `version must be ${expected.value} (monotonic successor of ${previous})`
    );
  }
  return briefOk(next);
}

function failIfEmpty(value: unknown, field: string): string | BriefDomainResult<never> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return briefFail('INVALID_BRIEF', `${field} is required`);
  }
  return value.trim();
}

function uniquePreserveOrder(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function validateIdList(
  ids: unknown,
  field: string,
  options: { min: number; onDuplicate: 'reject' | 'dedupe' }
): BriefDomainResult<string[]> {
  if (!Array.isArray(ids)) {
    return briefFail('INVALID_BRIEF', `${field} must be an array`);
  }
  const trimmed: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      return briefFail('INVALID_BRIEF', `${field} must not contain empty ids`);
    }
    trimmed.push(id.trim());
  }
  if (trimmed.length < options.min) {
    return briefFail('INVALID_BRIEF', `${field} must contain at least ${options.min} id(s)`);
  }
  const unique = uniquePreserveOrder(trimmed);
  if (options.onDuplicate === 'reject' && unique.length !== trimmed.length) {
    return briefFail('INVALID_BRIEF', `${field} must be unique`);
  }
  return briefOk(unique);
}

function validateWhyNow(whyNow: unknown): BriefDomainResult<BriefWhyNow> {
  if (typeof whyNow === 'string') {
    if (whyNow.trim().length === 0) {
      return briefFail('INVALID_BRIEF', 'whyNow is required');
    }
    return briefOk(whyNow.trim());
  }
  if (whyNow && typeof whyNow === 'object' && 'reason' in whyNow) {
    const reason = (whyNow as { reason: unknown }).reason;
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return briefFail('INVALID_BRIEF', 'whyNow.reason is required');
    }
    const score = (whyNow as { score?: unknown }).score;
    if (score !== undefined && typeof score !== 'number') {
      return briefFail('INVALID_BRIEF', 'whyNow.score must be a number when present');
    }
    return briefOk(
      score === undefined ? { reason: reason.trim() } : { reason: reason.trim(), score }
    );
  }
  return briefFail('INVALID_BRIEF', 'whyNow is required');
}

export function validateDecisionSnapshot(
  decision: StrategicDecisionSnapshot | undefined,
  signalIds: readonly string[],
  options?: { requireComplete?: boolean }
): BriefDomainResult<StrategicDecisionSnapshot> {
  if (!decision || typeof decision !== 'object') {
    return briefFail('INVALID_DECISION', 'decision snapshot is required');
  }
  if (!isStrategicAuthorizedAction(decision.authorizedAction)) {
    return briefFail('INVALID_DECISION', 'authorizedAction is invalid');
  }
  const rationale = failIfEmpty(decision.decisionRationale, 'decisionRationale');
  if (typeof rationale !== 'string') return rationale;

  if (typeof decision.dispositionDecision !== 'string' || !decision.dispositionDecision) {
    return briefFail('INVALID_DECISION', 'dispositionDecision is required');
  }
  if (typeof decision.formatDecision !== 'string' || !decision.formatDecision) {
    return briefFail('INVALID_DECISION', 'formatDecision is required');
  }
  if (!decision.upstreamRoutingRef || typeof decision.upstreamRoutingRef !== 'object') {
    return briefFail('INVALID_DECISION', 'upstreamRoutingRef is required');
  }
  const routingState = decision.upstreamRoutingRef.routingState;
  if (routingState !== 'CLEAR' && routingState !== 'CONTESTED' && routingState !== 'UNROUTED') {
    return briefFail('INVALID_DECISION', 'upstreamRoutingRef.routingState is invalid');
  }
  if (!decision.upstreamScoreRef || typeof decision.upstreamScoreRef !== 'object') {
    return briefFail('INVALID_DECISION', 'upstreamScoreRef is required');
  }
  const scoringVersion = failIfEmpty(
    decision.upstreamScoreRef.scoringVersion,
    'upstreamScoreRef.scoringVersion'
  );
  if (typeof scoringVersion !== 'string') return scoringVersion;

  if (!Array.isArray(decision.signalContextRefs)) {
    return briefFail('INVALID_DECISION', 'signalContextRefs must be an array');
  }

  const recDisposition = decision.upstreamScoreRef.recommendedDisposition;
  if (
    recDisposition !== undefined &&
    recDisposition !== decision.dispositionDecision &&
    (!decision.dispositionOverrideReason || decision.dispositionOverrideReason.trim().length === 0)
  ) {
    return briefFail(
      'INVALID_DECISION',
      'dispositionOverrideReason is required when overriding recommendedDisposition'
    );
  }
  const recFormat = decision.upstreamScoreRef.recommendedOutputFormat;
  if (
    recFormat !== undefined &&
    recFormat !== decision.formatDecision &&
    (!decision.formatOverrideReason || decision.formatOverrideReason.trim().length === 0)
  ) {
    return briefFail(
      'INVALID_DECISION',
      'formatOverrideReason is required when overriding recommendedOutputFormat'
    );
  }

  if (options?.requireComplete) {
    const refIds = decision.signalContextRefs.map((r) => r.signalId);
    const missing = signalIds.filter((id) => !refIds.includes(id));
    if (missing.length > 0) {
      return briefFail(
        'INVALID_DECISION',
        'signalContextRefs must cover every signalId'
      );
    }
    const extra = refIds.filter((id) => !signalIds.includes(id));
    if (extra.length > 0) {
      return briefFail('INVALID_DECISION', 'signalContextRefs contain unknown signalId');
    }
    for (const ref of decision.signalContextRefs) {
      if (typeof ref.signalId !== 'string' || ref.signalId.trim().length === 0) {
        return briefFail('INVALID_DECISION', 'signalContextRefs.signalId is required');
      }
    }
  }

  if (decision.aiAdvisoryRefs) {
    for (const ref of decision.aiAdvisoryRefs) {
      if (typeof ref.operation !== 'string' || ref.operation.trim().length === 0) {
        return briefFail('INVALID_DECISION', 'aiAdvisoryRefs.operation is required when present');
      }
    }
  }

  return briefOk({
    ...decision,
    decisionRationale: rationale,
    upstreamScoreRef: { ...decision.upstreamScoreRef, scoringVersion },
  });
}

export function validateStrategicBriefStructure(
  brief: Pick<
    StrategicBrief,
    | 'id'
    | 'organizationId'
    | 'clientId'
    | 'thesisId'
    | 'signalIds'
    | 'primaryAudience'
    | 'geography'
    | 'territory'
    | 'framework'
    | 'whyNow'
    | 'strategicAngle'
    | 'supportingEvidenceIds'
    | 'riskFlags'
    | 'recommendedChannel'
    | 'recommendedFormat'
    | 'CTA'
    | 'status'
    | 'createdBy'
    | 'approvedBy'
    | 'version'
    | 'decision'
  >
): BriefDomainResult<void> {
  const tenant = assertBriefTenantStructure({
    organizationId: brief.organizationId,
    clientId: brief.clientId,
  });
  if (!tenant.ok) return tenant;

  for (const [field, value] of [
    ['id', brief.id],
    ['thesisId', brief.thesisId],
    ['primaryAudience', brief.primaryAudience],
    ['geography', brief.geography],
    ['territory', brief.territory],
    ['framework', brief.framework],
    ['strategicAngle', brief.strategicAngle],
    ['recommendedChannel', brief.recommendedChannel],
    ['recommendedFormat', brief.recommendedFormat],
    ['CTA', brief.CTA],
    ['createdBy', brief.createdBy],
  ] as const) {
    const checked = failIfEmpty(value, field);
    if (typeof checked !== 'string') return checked;
  }

  if (!isBriefStatus(brief.status)) {
    return briefFail('INVALID_BRIEF', 'status is unsupported');
  }
  if (!isPositiveBriefVersion(brief.version)) {
    return briefFail('INVALID_BRIEF', 'version must be a monotonic integer >= 1');
  }

  const signalIds = validateIdList(brief.signalIds, 'signalIds', { min: 1, onDuplicate: 'reject' });
  if (!signalIds.ok) return signalIds;

  const evidence = validateIdList(brief.supportingEvidenceIds, 'supportingEvidenceIds', {
    min: 0,
    onDuplicate: 'dedupe',
  });
  if (!evidence.ok) return evidence;

  const flags = validateIdList(brief.riskFlags, 'riskFlags', { min: 0, onDuplicate: 'dedupe' });
  if (!flags.ok) return flags;

  const whyNow = validateWhyNow(brief.whyNow);
  if (!whyNow.ok) return whyNow;

  const decision = validateDecisionSnapshot(brief.decision, signalIds.value, {
    requireComplete: brief.status === 'APPROVED',
  });
  if (!decision.ok) return decision;

  if (brief.status === 'APPROVED') {
    if (!brief.approvedBy || brief.approvedBy.trim().length === 0) {
      return briefFail('INVALID_BRIEF', 'approvedBy is required when status is APPROVED');
    }
  }

  return briefOk(undefined);
}

export function createDraftStrategicBrief(
  input: CreateDraftStrategicBriefInput
): BriefDomainResult<StrategicBrief> {
  const version = input.version ?? 1;
  const schemaVersion = input.schemaVersion ?? BRIEF_SCHEMA_VERSION;
  if (schemaVersion !== BRIEF_SCHEMA_VERSION) {
    return briefFail('INVALID_BRIEF', 'unsupported schemaVersion');
  }

  const signalIds = validateIdList(input.signalIds, 'signalIds', { min: 1, onDuplicate: 'reject' });
  if (!signalIds.ok) return signalIds;
  const evidence = validateIdList(input.supportingEvidenceIds, 'supportingEvidenceIds', {
    min: 0,
    onDuplicate: 'dedupe',
  });
  if (!evidence.ok) return evidence;
  const flags = validateIdList(input.riskFlags, 'riskFlags', { min: 0, onDuplicate: 'dedupe' });
  if (!flags.ok) return flags;

  const brief: StrategicBrief = {
    id: input.id,
    organizationId: input.organizationId,
    clientId: input.clientId,
    thesisId: input.thesisId,
    signalIds: signalIds.value,
    primaryAudience: input.primaryAudience,
    geography: input.geography,
    territory: input.territory,
    framework: input.framework,
    whyNow: input.whyNow,
    strategicAngle: input.strategicAngle,
    supportingEvidenceIds: evidence.value,
    riskFlags: flags.value,
    recommendedChannel: input.recommendedChannel,
    recommendedFormat: input.recommendedFormat,
    CTA: input.CTA,
    status: 'DRAFT',
    createdBy: input.createdBy,
    approvedBy: null,
    version,
    schemaVersion,
    decision: input.decision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
    approvedAt: null,
    supersededByBriefId: null,
    supersedesBriefId: input.supersedesBriefId ?? null,
    rejectionReason: null,
  };

  const structure = validateStrategicBriefStructure(brief);
  if (!structure.ok) return structure;
  return briefOk(brief);
}

export interface ApproveBriefContext {
  approvedBy: string;
  approvedAt: string;
  routing: BriefRoutingContextInput;
  signalRouting?: readonly SignalRoutingContextInput[];
}

export function approveDraftBrief(
  brief: StrategicBrief,
  context: ApproveBriefContext
): BriefDomainResult<StrategicBrief> {
  if (!canTransitionBriefStatus(brief.status, 'APPROVED')) {
    return briefFail(
      'INVALID_STATE_TRANSITION',
      `illegal transition ${brief.status} -> APPROVED`
    );
  }
  const approvedBy = failIfEmpty(context.approvedBy, 'approvedBy');
  if (typeof approvedBy !== 'string') return approvedBy;
  const approvedAt = failIfEmpty(context.approvedAt, 'approvedAt');
  if (typeof approvedAt !== 'string') return approvedAt;

  const routing = evaluateBriefRoutingEligibility({
    thesisId: brief.thesisId,
    signalIds: brief.signalIds,
    routing: context.routing,
    signalRouting: context.signalRouting,
  });
  if (!routing.ok) return routing;

  const candidate: StrategicBrief = {
    ...brief,
    status: 'APPROVED',
    approvedBy,
    approvedAt,
    updatedAt: approvedAt,
    rejectionReason: null,
  };
  const structure = validateStrategicBriefStructure(candidate);
  if (!structure.ok) return structure;

  const decision = validateDecisionSnapshot(candidate.decision, candidate.signalIds, {
    requireComplete: true,
  });
  if (!decision.ok) return decision;

  return briefOk({ ...candidate, decision: decision.value });
}

export function rejectDraftBrief(
  brief: StrategicBrief,
  params: { rejectionReason: string; rejectedAt: string }
): BriefDomainResult<StrategicBrief> {
  if (!canTransitionBriefStatus(brief.status, 'REJECTED')) {
    return briefFail(
      'INVALID_STATE_TRANSITION',
      `illegal transition ${brief.status} -> REJECTED`
    );
  }
  const reason = failIfEmpty(params.rejectionReason, 'rejectionReason');
  if (typeof reason !== 'string') return reason;
  const rejectedAt = failIfEmpty(params.rejectedAt, 'rejectedAt');
  if (typeof rejectedAt !== 'string') return rejectedAt;

  return briefOk({
    ...brief,
    status: 'REJECTED',
    rejectionReason: reason,
    updatedAt: rejectedAt,
    approvedBy: null,
    approvedAt: null,
  });
}

export function supersedeBrief(
  brief: StrategicBrief,
  params: { supersededByBriefId: string; supersededAt: string }
): BriefDomainResult<StrategicBrief> {
  if (!canTransitionBriefStatus(brief.status, 'SUPERSEDED')) {
    return briefFail(
      'INVALID_STATE_TRANSITION',
      `illegal transition ${brief.status} -> SUPERSEDED`
    );
  }
  const successor = failIfEmpty(params.supersededByBriefId, 'supersededByBriefId');
  if (typeof successor !== 'string') return successor;
  const supersededAt = failIfEmpty(params.supersededAt, 'supersededAt');
  if (typeof supersededAt !== 'string') return supersededAt;

  return briefOk({
    ...brief,
    status: 'SUPERSEDED',
    supersededByBriefId: successor,
    updatedAt: supersededAt,
  });
}

export function reopenRejectedBrief(
  brief: StrategicBrief,
  params: { reopenedAt: string }
): BriefDomainResult<StrategicBrief> {
  if (!canTransitionBriefStatus(brief.status, 'DRAFT')) {
    return briefFail('INVALID_STATE_TRANSITION', `illegal transition ${brief.status} -> DRAFT`);
  }
  const reopenedAt = failIfEmpty(params.reopenedAt, 'reopenedAt');
  if (typeof reopenedAt !== 'string') return reopenedAt;
  return briefOk({
    ...brief,
    status: 'DRAFT',
    rejectionReason: null,
    updatedAt: reopenedAt,
    approvedBy: null,
    approvedAt: null,
  });
}

export function transitionBriefStatus(
  brief: StrategicBrief,
  next: BriefStatus,
  context: {
    now: string;
    actorId?: string;
    approvedBy?: string;
    rejectionReason?: string;
    supersededByBriefId?: string;
    routing?: BriefRoutingContextInput;
    signalRouting?: readonly SignalRoutingContextInput[];
  }
): BriefDomainResult<StrategicBrief> {
  if (next === 'APPROVED') {
    if (!context.approvedBy) {
      return briefFail('INVALID_BRIEF', 'approvedBy is required to approve');
    }
    if (!context.routing) {
      return briefFail('ROUTING_CONTEXT_INVALID', 'routing context is required to approve');
    }
    return approveDraftBrief(brief, {
      approvedBy: context.approvedBy,
      approvedAt: context.now,
      routing: context.routing,
      signalRouting: context.signalRouting,
    });
  }
  if (next === 'REJECTED') {
    return rejectDraftBrief(brief, {
      rejectionReason: context.rejectionReason ?? '',
      rejectedAt: context.now,
    });
  }
  if (next === 'SUPERSEDED') {
    return supersedeBrief(brief, {
      supersededByBriefId: context.supersededByBriefId ?? '',
      supersededAt: context.now,
    });
  }
  if (next === 'DRAFT') {
    return reopenRejectedBrief(brief, { reopenedAt: context.now });
  }
  return briefFail('INVALID_STATE_TRANSITION', `unsupported status ${String(next)}`);
}

export function assertApprovedNotMutatedInPlace(
  previous: StrategicBrief,
  next: StrategicBrief
): BriefDomainResult<void> {
  if (previous.status !== 'APPROVED') return briefOk(undefined);
  if (next.version === previous.version && isMaterialBriefChange(previous, next)) {
    return briefFail(
      'MATERIAL_REVISION_REQUIRED',
      'material change to an APPROVED brief cannot mutate the same revision'
    );
  }
  return briefOk(undefined);
}

export function planMaterialRevisionFromApproved(params: {
  previous: StrategicBrief;
  nextInput: CreateDraftStrategicBriefInput;
  now: string;
}): BriefDomainResult<{ superseded: StrategicBrief; revision: StrategicBrief }> {
  const { previous, now } = params;
  if (previous.status !== 'APPROVED') {
    return briefFail('INVALID_STATE_TRANSITION', 'only APPROVED briefs require supersede revision');
  }
  const expectedVersion = nextBriefVersion(previous.version);
  if (!expectedVersion.ok) return expectedVersion;

  const nextInput: CreateDraftStrategicBriefInput = {
    ...params.nextInput,
    version: params.nextInput.version ?? expectedVersion.value,
    supersedesBriefId: params.nextInput.supersedesBriefId ?? previous.id,
    createdAt: params.nextInput.createdAt || now,
    updatedAt: now,
  };
  const monotonic = assertMonotonicBriefVersion(previous.version, nextInput.version ?? 0);
  if (!monotonic.ok) return monotonic;

  const revision = createDraftStrategicBrief(nextInput);
  if (!revision.ok) return revision;

  if (!isMaterialStrategicContentChange(previous, revision.value)) {
    return briefFail('INVALID_BRIEF', 'non-material change does not create a strategic revision');
  }

  const superseded = supersedeBrief(previous, {
    supersededByBriefId: revision.value.id,
    supersededAt: now,
  });
  if (!superseded.ok) return superseded;
  return briefOk({ superseded: superseded.value, revision: revision.value });
}

export function isCurrentApprovedBrief(brief: StrategicBrief): boolean {
  return brief.status === 'APPROVED' && !brief.supersededByBriefId;
}

export function canAuthorizeStrategicDownstream(brief: StrategicBrief): boolean {
  if (!isCurrentApprovedBrief(brief)) return false;
  const structure = validateStrategicBriefStructure(brief);
  if (!structure.ok) return false;
  if (brief.decision.upstreamRoutingRef.routingState !== 'CLEAR') return false;
  if (brief.decision.authorizedAction === 'NONE') return false;
  const tenant = assertBriefTenantStructure(brief);
  if (!tenant.ok) return false;
  return brief.signalIds.length > 0 && Boolean(brief.thesisId);
}

export function canAuthorizeStrategicAction(
  brief: StrategicBrief,
  action: StrategicDownstreamAction
): boolean {
  if (!canAuthorizeStrategicDownstream(brief)) return false;
  return brief.decision.authorizedAction === action;
}

export function assertBriefActionable(brief: StrategicBrief): BriefDomainResult<void> {
  if (!canAuthorizeStrategicDownstream(brief)) {
    return briefFail(
      'BRIEF_NOT_ACTIONABLE',
      'Brief does not authorize strategic downstream action'
    );
  }
  return briefOk(undefined);
}

export function toMaterialIdentity(brief: StrategicBrief): StrategicBriefMaterialIdentity {
  return {
    organizationId: brief.organizationId,
    clientId: brief.clientId,
    thesisId: brief.thesisId,
    signalIds: [...brief.signalIds],
    version: brief.version,
    status: brief.status,
    fingerprint: briefMaterialFingerprint(brief),
  };
}

export function validateOverrideRecord(
  record: StrategicBriefOverrideRecord
): BriefDomainResult<StrategicBriefOverrideRecord> {
  for (const [field, value] of [
    ['overrideId', record.overrideId],
    ['briefId', record.briefId],
    ['organizationId', record.organizationId],
    ['clientId', record.clientId],
    ['actorId', record.actorId],
    ['reason', record.reason],
    ['timestamp', record.timestamp],
  ] as const) {
    const checked = failIfEmpty(value, field);
    if (typeof checked !== 'string') {
      return briefFail('OVERRIDE_INVALID', `${field} is required`);
    }
  }
  if (!isPositiveBriefVersion(record.briefVersion)) {
    return briefFail('OVERRIDE_INVALID', 'briefVersion must be a monotonic integer >= 1');
  }
  if (!Array.isArray(record.materialFieldsChanged)) {
    return briefFail('OVERRIDE_INVALID', 'materialFieldsChanged is required');
  }
  if (!record.previousState || !record.newState) {
    return briefFail('OVERRIDE_INVALID', 'previousState and newState are required');
  }
  return briefOk(record);
}

/**
 * Human override may change strategic choice. It may not suspend constitutional
 * invariants (tenant, routing eligibility, claim-safety boundary, Brief requirement).
 */
export function assertOverridePreservesInvariants(params: {
  previous: StrategicBrief;
  next: StrategicBrief;
  routing: BriefRoutingContextInput;
  signalRouting?: readonly SignalRoutingContextInput[];
}): BriefDomainResult<void> {
  const tenantPrev: BriefTenantEnvelope = {
    organizationId: params.previous.organizationId,
    clientId: params.previous.clientId,
  };
  const tenantNext: BriefTenantEnvelope = {
    organizationId: params.next.organizationId,
    clientId: params.next.clientId,
  };
  if (
    tenantPrev.organizationId !== tenantNext.organizationId ||
    tenantPrev.clientId !== tenantNext.clientId
  ) {
    return briefFail('OVERRIDE_INVALID', 'override cannot change tenant envelope');
  }

  const nextTenant = assertBriefTenantStructure(tenantNext);
  if (!nextTenant.ok) return briefFail('OVERRIDE_INVALID', 'override cannot ignore tenant');

  const structure = validateStrategicBriefStructure(params.next);
  if (!structure.ok) {
    return briefFail('OVERRIDE_INVALID', 'override cannot remove Brief constitutional fields');
  }

  if (params.next.status === 'APPROVED') {
    const routing = evaluateBriefRoutingEligibility({
      thesisId: params.next.thesisId,
      signalIds: params.next.signalIds,
      routing: params.routing,
      signalRouting: params.signalRouting,
    });
    if (!routing.ok) {
      return briefFail(
        'OVERRIDE_INVALID',
        'override cannot approve CONTESTED or UNROUTED routing context'
      );
    }
    if (!params.next.approvedBy) {
      return briefFail('OVERRIDE_INVALID', 'override cannot infer approval without approvedBy');
    }
  }
  return briefOk(undefined);
}

export function createBriefHistoryRecord(params: {
  brief: StrategicBrief;
  actorId: string;
  source: 'HUMAN' | 'SYSTEM';
  changeType: BriefHistoryChangeType;
  changedAt: string;
}): BriefDomainResult<StrategicBriefHistoryRecord> {
  const actorId = failIfEmpty(params.actorId, 'actorId');
  if (typeof actorId !== 'string') return actorId;
  const changedAt = failIfEmpty(params.changedAt, 'changedAt');
  if (typeof changedAt !== 'string') return changedAt;
  return briefOk({
    briefId: params.brief.id,
    version: params.brief.version,
    status: params.brief.status,
    decision: params.brief.decision,
    organizationId: params.brief.organizationId,
    clientId: params.brief.clientId,
    actorId,
    source: params.source,
    changeType: params.changeType,
    changedAt,
    materialFingerprint: briefMaterialFingerprint(params.brief),
  });
}
