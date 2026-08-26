/**
 * SPEC-007 Phase 1 — Multi-thesis evaluation predicates (pure).
 * No primary / [0] / highest-score winner authority.
 */

import type {
  OpportunityCandidate,
  ThesisEvaluation,
} from './opportunityCandidateCore';
import { oppFail, oppOk, type OpportunityDomainResult } from './opportunityScoutErrors';

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/**
 * Resolve an explicit thesis evaluation. Never selects the first array element or highest score.
 */
export function findThesisEvaluation(
  evaluations: readonly ThesisEvaluation[],
  thesisId: string
): ThesisEvaluation | null {
  const id = nonEmpty(thesisId);
  if (!id) return null;
  return evaluations.find((ev) => ev.thesisId === id) ?? null;
}

export function assertExplicitThesisId(
  thesisId: unknown
): OpportunityDomainResult<string> {
  const id = nonEmpty(thesisId);
  if (!id) {
    return oppFail(
      'THESIS_MISMATCH',
      'explicit thesisId required (no primary/first-element/winner selection)'
    );
  }
  return oppOk(id);
}

/**
 * Materialization / binding must name an explicit thesis present on the candidate.
 * Highest evaluation score is irrelevant.
 */
export function assertCandidateThesisForBinding(
  candidate: OpportunityCandidate,
  thesisId: unknown
): OpportunityDomainResult<ThesisEvaluation> {
  const explicit = assertExplicitThesisId(thesisId);
  if (!explicit.ok) return explicit;
  const found = findThesisEvaluation(candidate.thesisEvaluations, explicit.value);
  if (!found) {
    return oppFail(
      'THESIS_MISMATCH',
      `thesisId=${explicit.value} not present on candidate thesisEvaluations`
    );
  }
  return oppOk(found);
}

/**
 * Adversarial guard: never infer a winner from evaluation ordering or score.
 */
export function denyImplicitThesisWinner(): OpportunityDomainResult<never> {
  return oppFail(
    'THESIS_MISMATCH',
    'implicit thesis winner selection is forbidden'
  );
}
