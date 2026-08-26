/**
 * SPEC-007 Phase 1 — Materiality / supersession / version + history intents (pure).
 * History = AUDIT_ONLY; never current authority. No persistence.
 */

import type { OpportunityCandidate } from './opportunityCandidateCore';
import type { MaterializedOpportunity } from './opportunityCore';
import type { OpportunityScore } from './opportunityScoreCore';
import { oppFail, oppOk, type OpportunityDomainResult } from './opportunityScoutErrors';

function uniqueSorted(ids: readonly string[]): string[] {
  return [...new Set(ids)].slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export interface CandidateMaterialSnapshot {
  organizationId: string;
  clientId: string;
  title: string;
  summary: string;
  whyNow: string;
  opportunityType: string;
  sourceRefs: string[];
  signalIds: string[];
  thesisEvaluations: Array<{
    thesisId: string;
    fitNotes: string;
    evaluationStatus: string;
    strategicScoreRef?: { scoringVersion: string; totalScore?: number; priorityBand?: string };
  }>;
  status: string;
  riskFlags: string[];
  recommendedNextStep: string;
  scoreModelVersion: string | null;
  scoreTotal: number | null;
}

export function toCandidateMaterialSnapshot(
  candidate: OpportunityCandidate
): CandidateMaterialSnapshot {
  return {
    organizationId: candidate.organizationId,
    clientId: candidate.clientId,
    title: candidate.title,
    summary: candidate.summary,
    whyNow: candidate.whyNow,
    opportunityType: candidate.opportunityType,
    sourceRefs: uniqueSorted(candidate.sourceRefs),
    signalIds: uniqueSorted(candidate.signalIds),
    thesisEvaluations: [...candidate.thesisEvaluations]
      .map((ev) => ({
        thesisId: ev.thesisId,
        fitNotes: ev.fitNotes,
        evaluationStatus: ev.evaluationStatus,
        strategicScoreRef: ev.strategicScoreRef
          ? { ...ev.strategicScoreRef }
          : undefined,
      }))
      .sort((a, b) => (a.thesisId < b.thesisId ? -1 : a.thesisId > b.thesisId ? 1 : 0)),
    status: candidate.status,
    riskFlags: uniqueSorted(candidate.riskFlags),
    recommendedNextStep: candidate.recommendedNextStep,
    scoreModelVersion: candidate.latestScore?.scoringModelVersion ?? null,
    scoreTotal: candidate.latestScore?.totalScore ?? null,
  };
}

export function candidateMaterialFingerprint(candidate: OpportunityCandidate): string {
  return JSON.stringify(toCandidateMaterialSnapshot(candidate));
}

export function isCandidateMateriallyEqual(
  a: OpportunityCandidate,
  b: OpportunityCandidate
): boolean {
  return candidateMaterialFingerprint(a) === candidateMaterialFingerprint(b);
}

export interface OpportunityMaterialSnapshot {
  organizationId: string;
  clientId: string;
  thesisId: string;
  candidateId: string | null;
  strategicBriefId: string;
  strategicBriefVersion: number;
  strategicPlanId: string;
  strategicPlanVersion: number;
  planItemId: string;
  title: string;
  organization: string;
  type: string;
  deadline: string | null;
  description: string;
  fitRationale: string;
  status: string;
  checklist: Array<{ id: string; label: string; done: boolean }>;
}

export function toOpportunityMaterialSnapshot(
  opportunity: MaterializedOpportunity
): OpportunityMaterialSnapshot {
  return {
    organizationId: opportunity.organizationId,
    clientId: opportunity.clientId,
    thesisId: opportunity.thesisId,
    candidateId: opportunity.candidateId,
    strategicBriefId: opportunity.strategicBriefId,
    strategicBriefVersion: opportunity.strategicBriefVersion,
    strategicPlanId: opportunity.strategicPlanId,
    strategicPlanVersion: opportunity.strategicPlanVersion,
    planItemId: opportunity.planItemId,
    title: opportunity.title,
    organization: opportunity.organization,
    type: opportunity.type,
    deadline: opportunity.deadline,
    description: opportunity.description,
    fitRationale: opportunity.fitRationale,
    status: opportunity.status,
    checklist: [...opportunity.submissionChecklist]
      .map((c) => ({ id: c.id, label: c.label, done: c.done }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
}

export function opportunityMaterialFingerprint(
  opportunity: MaterializedOpportunity
): string {
  return JSON.stringify(toOpportunityMaterialSnapshot(opportunity));
}

/**
 * Material change at same id+version requires supersession/revision — no silent overwrite.
 */
export function assertMaterialNotSilentlyOverwritten(input: {
  beforeVersion: number;
  afterVersion: number;
  beforeFingerprint: string;
  afterFingerprint: string;
}): OpportunityDomainResult<void> {
  if (input.beforeFingerprint === input.afterFingerprint) {
    return oppOk(undefined);
  }
  if (input.afterVersion <= input.beforeVersion) {
    return oppFail(
      'MATERIAL_CHANGE_REQUIRES_REVISION',
      'material change requires version increment / supersession'
    );
  }
  return oppOk(undefined);
}

export type OpportunityHistoryEventKind =
  | 'CANDIDATE_EVALUATED'
  | 'CANDIDATE_RESCORDED'
  | 'OPPORTUNITY_MATERIALIZED'
  | 'OPPORTUNITY_TRANSITION'
  | 'OPPORTUNITY_SUPERSEDED'
  | 'SCORE_MODEL_CHANGED';

/**
 * Pure history event intent. AUDIT_ONLY — never becomes current authority.
 */
export interface OpportunityHistoryEventIntent {
  kind: OpportunityHistoryEventKind;
  organizationId: string;
  clientId: string;
  aggregateKind: 'CANDIDATE' | 'OPPORTUNITY' | 'SCORE';
  aggregateId: string;
  aggregateVersion: number;
  actorKind: string;
  reasonCodes: string[];
  materialFingerprint: string;
  occurredAt: string;
  /** Explicit non-authority marker for consumers. */
  authority: 'AUDIT_ONLY';
}

export function createHistoryEventIntent(input: {
  kind: OpportunityHistoryEventKind;
  organizationId: string;
  clientId: string;
  aggregateKind: OpportunityHistoryEventIntent['aggregateKind'];
  aggregateId: string;
  aggregateVersion: number;
  actorKind: string;
  reasonCodes: string[];
  materialFingerprint: string;
  occurredAt: string;
}): OpportunityHistoryEventIntent {
  return {
    ...input,
    reasonCodes: [...input.reasonCodes],
    authority: 'AUDIT_ONLY',
  };
}

/** Deterministic command fingerprint for later idempotency (no durable replay yet). */
export function opportunityCommandFingerprint(parts: {
  organizationId: string;
  clientId: string;
  command: string;
  intentKey: string;
}): string {
  return [
    parts.organizationId,
    parts.clientId,
    parts.command,
    parts.intentKey,
  ].join('|');
}

export function scoreMaterialFingerprint(score: OpportunityScore): string {
  return JSON.stringify({
    candidateId: score.candidateId,
    scoringModelVersion: score.scoringModelVersion,
    totalScore: score.totalScore,
    band: score.band,
    dimensions: score.dimensions.map((d) => ({
      key: d.key,
      rawInput: d.rawInput,
      weight: d.weight,
      contribution: d.contribution,
      reasonCode: d.reasonCode,
    })),
    evidenceRefs: uniqueSorted(score.evidenceRefs),
    riskFlags: uniqueSorted(score.riskFlags),
  });
}
