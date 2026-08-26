/**
 * SPEC-007 Phase 1 — OpportunityCandidate aggregate (Stage A intelligence, pure).
 * Non-executable. No CREATE_OPPORTUNITY / materialization authority.
 */

import { oppFail, oppOk, type OpportunityDomainResult } from './opportunityScoutErrors';
import {
  assertOpportunityTenantStructure,
  type OpportunityTenantEnvelope,
} from './opportunityTenantCore';
import type { OpportunityScore } from './opportunityScoreCore';

export const OPPORTUNITY_CANDIDATE_SCHEMA_VERSION = 'opportunity-candidate-v1' as const;

export const OPPORTUNITY_TYPES = [
  'CONFERENCE_KEYNOTE',
  'PANEL',
  'PODCAST_GUEST',
  'JOURNAL_CALL',
  'AWARD_NOMINATION',
  'PUBLIC_COMMENT',
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const CANDIDATE_STATUSES = [
  'DETECTED',
  'UNDER_EVALUATION',
  'SCORED',
  'RECOMMENDED',
  'HELD',
  'DISCARDED',
  'SUPERSEDED',
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_STATUS_TRANSITIONS: Record<
  CandidateStatus,
  readonly CandidateStatus[]
> = {
  DETECTED: ['UNDER_EVALUATION', 'DISCARDED', 'SUPERSEDED'],
  UNDER_EVALUATION: ['SCORED', 'HELD', 'DISCARDED', 'SUPERSEDED'],
  SCORED: ['RECOMMENDED', 'HELD', 'DISCARDED', 'UNDER_EVALUATION', 'SUPERSEDED'],
  RECOMMENDED: ['HELD', 'DISCARDED', 'SUPERSEDED'],
  HELD: ['UNDER_EVALUATION', 'DISCARDED', 'SUPERSEDED'],
  DISCARDED: [],
  SUPERSEDED: [],
};

export type ThesisEvaluationStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';

export type RecommendedNextStep =
  | 'CONTINUE_RESEARCH'
  | 'DRAFT_BRIEF'
  | 'HOLD'
  | 'DISCARD';

export interface StrategicScoreRefSnapshot {
  scoringVersion: string;
  totalScore?: number;
  priorityBand?: string;
}

export interface ThesisEvaluation {
  thesisId: string;
  routingState?: string;
  strategicScoreRef?: StrategicScoreRefSnapshot;
  fitNotes: string;
  evaluationStatus: ThesisEvaluationStatus;
}

export interface OpportunityCandidate {
  id: string;
  organizationId: string;
  clientId: string;
  title: string;
  summary: string;
  whyNow: string;
  opportunityType: OpportunityType;
  sourceRefs: string[];
  signalIds: string[];
  thesisEvaluations: ThesisEvaluation[];
  status: CandidateStatus;
  latestScore: OpportunityScore | null;
  riskFlags: string[];
  recommendedNextStep: RecommendedNextStep;
  schemaVersion: typeof OPPORTUNITY_CANDIDATE_SCHEMA_VERSION;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateOpportunityCandidateInput extends OpportunityTenantEnvelope {
  id: string;
  title: string;
  summary: string;
  whyNow: string;
  opportunityType: OpportunityType;
  sourceRefs: string[];
  signalIds?: string[];
  thesisEvaluations: ThesisEvaluation[];
  status?: CandidateStatus;
  latestScore?: OpportunityScore | null;
  riskFlags: string[];
  recommendedNextStep: RecommendedNextStep;
  version?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function isOpportunityType(value: unknown): value is OpportunityType {
  return typeof value === 'string' && (OPPORTUNITY_TYPES as readonly string[]).includes(value);
}

export function isCandidateStatus(value: unknown): value is CandidateStatus {
  return typeof value === 'string' && (CANDIDATE_STATUSES as readonly string[]).includes(value);
}

function validateThesisEvaluations(
  evaluations: ThesisEvaluation[]
): OpportunityDomainResult<ThesisEvaluation[]> {
  if (!Array.isArray(evaluations) || evaluations.length === 0) {
    return oppFail(
      'INVALID_CANDIDATE',
      'thesisEvaluations required (explicit multi-thesis; no implicit winner)'
    );
  }
  const seen = new Set<string>();
  const normalized: ThesisEvaluation[] = [];
  for (const ev of evaluations) {
    if (!ev || typeof ev !== 'object') {
      return oppFail('INVALID_CANDIDATE', 'thesisEvaluation entry malformed');
    }
    const thesisId = nonEmpty(ev.thesisId);
    if (!thesisId) {
      return oppFail('INVALID_CANDIDATE', 'thesisEvaluation.thesisId required');
    }
    if (seen.has(thesisId)) {
      return oppFail('DUPLICATE_THESIS_EVALUATION', `duplicate thesisId=${thesisId}`);
    }
    seen.add(thesisId);
    if (!nonEmpty(ev.fitNotes)) {
      return oppFail('INVALID_CANDIDATE', `fitNotes required for thesisId=${thesisId}`);
    }
    if (
      ev.evaluationStatus !== 'ELIGIBLE' &&
      ev.evaluationStatus !== 'INELIGIBLE' &&
      ev.evaluationStatus !== 'UNKNOWN'
    ) {
      return oppFail(
        'INVALID_CANDIDATE',
        `invalid evaluationStatus for thesisId=${thesisId}`
      );
    }
    if (ev.strategicScoreRef) {
      if (!nonEmpty(ev.strategicScoreRef.scoringVersion)) {
        return oppFail(
          'INVALID_CANDIDATE',
          `strategicScoreRef.scoringVersion required for thesisId=${thesisId}`
        );
      }
    }
    normalized.push({
      thesisId,
      routingState: ev.routingState,
      strategicScoreRef: ev.strategicScoreRef
        ? { ...ev.strategicScoreRef }
        : undefined,
      fitNotes: ev.fitNotes.trim(),
      evaluationStatus: ev.evaluationStatus,
    });
  }
  return oppOk(normalized);
}

/**
 * Construct Stage A OpportunityCandidate. Does not materialize Opportunity.
 */
export function createOpportunityCandidate(
  input: CreateOpportunityCandidateInput
): OpportunityDomainResult<OpportunityCandidate> {
  const tenant = assertOpportunityTenantStructure(input);
  if (!tenant.ok) return tenant;

  const id = nonEmpty(input.id);
  const title = nonEmpty(input.title);
  const summary = nonEmpty(input.summary);
  const whyNow = nonEmpty(input.whyNow);
  const createdAt = nonEmpty(input.createdAt);
  const updatedAt = nonEmpty(input.updatedAt);
  const createdBy = nonEmpty(input.createdBy);
  if (!id || !title || !summary || !whyNow || !createdAt || !updatedAt || !createdBy) {
    return oppFail(
      'INVALID_CANDIDATE',
      'id, title, summary, whyNow, createdAt, updatedAt, createdBy are required'
    );
  }
  if (!isOpportunityType(input.opportunityType)) {
    return oppFail('INVALID_CANDIDATE', 'invalid opportunityType');
  }
  if (!Array.isArray(input.sourceRefs) || input.sourceRefs.length === 0) {
    return oppFail('INVALID_CANDIDATE', 'sourceRefs required');
  }
  for (const ref of input.sourceRefs) {
    if (!nonEmpty(ref)) {
      return oppFail('INVALID_CANDIDATE', 'sourceRefs must be non-empty strings');
    }
  }
  const signalIds = input.signalIds ?? [];
  if (!Array.isArray(signalIds)) {
    return oppFail('INVALID_CANDIDATE', 'signalIds must be an array');
  }
  for (const sid of signalIds) {
    if (!nonEmpty(sid)) {
      return oppFail('INVALID_CANDIDATE', 'signalIds must be non-empty strings');
    }
  }
  if (!Array.isArray(input.riskFlags)) {
    return oppFail('INVALID_CANDIDATE', 'riskFlags must be an array');
  }
  for (const flag of input.riskFlags) {
    if (!nonEmpty(flag)) {
      return oppFail('INVALID_CANDIDATE', 'riskFlags must be non-empty strings');
    }
  }

  const steps: RecommendedNextStep[] = [
    'CONTINUE_RESEARCH',
    'DRAFT_BRIEF',
    'HOLD',
    'DISCARD',
  ];
  if (!steps.includes(input.recommendedNextStep)) {
    return oppFail('INVALID_CANDIDATE', 'invalid recommendedNextStep');
  }

  const status = input.status ?? 'DETECTED';
  if (!isCandidateStatus(status)) {
    return oppFail('INVALID_CANDIDATE', 'invalid candidate status');
  }

  const evaluations = validateThesisEvaluations(input.thesisEvaluations);
  if (!evaluations.ok) return evaluations;

  const version = input.version ?? 1;
  if (!Number.isInteger(version) || version < 1) {
    return oppFail('INVALID_CANDIDATE', 'version must be integer >= 1');
  }

  const latestScore: OpportunityScore | null = input.latestScore ?? null;
  if (latestScore) {
    if (
      latestScore.organizationId !== tenant.value.organizationId ||
      latestScore.clientId !== tenant.value.clientId
    ) {
      return oppFail('TENANT_MISMATCH', 'latestScore tenant mismatch');
    }
    if (latestScore.candidateId !== id) {
      return oppFail('INVALID_CANDIDATE', 'latestScore.candidateId mismatch');
    }
  }

  return oppOk({
    id,
    organizationId: tenant.value.organizationId,
    clientId: tenant.value.clientId,
    title,
    summary,
    whyNow,
    opportunityType: input.opportunityType,
    sourceRefs: [...input.sourceRefs],
    signalIds: [...signalIds],
    thesisEvaluations: evaluations.value,
    status,
    latestScore,
    riskFlags: [...input.riskFlags],
    recommendedNextStep: input.recommendedNextStep,
    schemaVersion: OPPORTUNITY_CANDIDATE_SCHEMA_VERSION,
    version,
    createdAt,
    updatedAt,
    createdBy,
  });
}

export function canTransitionCandidateStatus(
  from: CandidateStatus,
  to: CandidateStatus
): boolean {
  return (CANDIDATE_STATUS_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function transitionCandidateStatus(
  candidate: OpportunityCandidate,
  to: CandidateStatus,
  updatedAt: string
): OpportunityDomainResult<OpportunityCandidate> {
  if (!canTransitionCandidateStatus(candidate.status, to)) {
    return oppFail(
      'INVALID_TRANSITION',
      `candidate cannot transition ${candidate.status} → ${to}`
    );
  }
  const at = nonEmpty(updatedAt);
  if (!at) return oppFail('INVALID_CANDIDATE', 'updatedAt required');
  return oppOk({ ...candidate, status: to, updatedAt: at });
}

/**
 * Attach a computed score. RECOMMENDED status still does not authorize materialization.
 */
export function attachOpportunityScore(
  candidate: OpportunityCandidate,
  score: OpportunityScore,
  updatedAt: string
): OpportunityDomainResult<OpportunityCandidate> {
  if (
    score.organizationId !== candidate.organizationId ||
    score.clientId !== candidate.clientId
  ) {
    return oppFail('TENANT_MISMATCH', 'score tenant mismatch');
  }
  if (score.candidateId !== candidate.id) {
    return oppFail('INVALID_SCORE', 'score.candidateId mismatch');
  }
  const at = nonEmpty(updatedAt);
  if (!at) return oppFail('INVALID_CANDIDATE', 'updatedAt required');
  let nextStatus = candidate.status;
  if (candidate.status === 'UNDER_EVALUATION' || candidate.status === 'DETECTED') {
    nextStatus = 'SCORED';
  }
  return oppOk({
    ...candidate,
    latestScore: score,
    status: nextStatus,
    updatedAt: at,
  });
}
