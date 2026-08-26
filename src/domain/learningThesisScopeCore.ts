/**
 * SPEC-008 Phase 1 — Multi-thesis scope predicates (pure).
 * No implicit primary thesis / first-index / hidden winner authority.
 */

import { lrnFail, lrnOk, type LearningDomainResult } from './learningLoopErrors';

export type ThesisScopeKind = 'SINGLE' | 'MULTI' | 'CLIENT_WIDE';

export type ThesisScope =
  | { kind: 'SINGLE'; thesisId: string }
  | { kind: 'MULTI'; thesisIds: readonly string[] }
  | { kind: 'CLIENT_WIDE' };

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function uniqueSorted(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  );
}

export function assertExplicitThesisId(
  thesisId: unknown
): LearningDomainResult<string> {
  const id = nonEmpty(thesisId);
  if (!id) {
    return lrnFail(
      'INVALID_THESIS_SCOPE',
      'explicit thesisId required (no primary/first-element/winner selection)'
    );
  }
  return lrnOk(id);
}

export function assertThesisScope(
  scope: ThesisScope
): LearningDomainResult<ThesisScope> {
  switch (scope.kind) {
    case 'SINGLE': {
      const thesisId = assertExplicitThesisId(scope.thesisId);
      if (!thesisId.ok) return thesisId;
      return lrnOk({ kind: 'SINGLE', thesisId: thesisId.value });
    }
    case 'MULTI': {
      const ids = uniqueSorted(scope.thesisIds ?? []);
      if (ids.length < 2) {
        return lrnFail(
          'INVALID_THESIS_SCOPE',
          'MULTI thesisScope requires at least two explicit thesisIds'
        );
      }
      return lrnOk({ kind: 'MULTI', thesisIds: ids });
    }
    case 'CLIENT_WIDE':
      return lrnOk({ kind: 'CLIENT_WIDE' });
    default:
      return lrnFail('INVALID_THESIS_SCOPE', 'unknown thesisScope kind');
  }
}

export function thesisScopeFingerprint(scope: ThesisScope): string {
  const normalized = assertThesisScope(scope);
  if (!normalized.ok) return 'INVALID';
  const s = normalized.value;
  switch (s.kind) {
    case 'SINGLE':
      return `SINGLE:${s.thesisId}`;
    case 'MULTI':
      return `MULTI:${s.thesisIds.join(',')}`;
    case 'CLIENT_WIDE':
      return 'CLIENT_WIDE';
  }
}

export function thesisScopesMatch(a: ThesisScope, b: ThesisScope): boolean {
  return thesisScopeFingerprint(a) === thesisScopeFingerprint(b);
}

/**
 * Adversarial guard: never infer a winner from ordering or score.
 */
export function denyImplicitThesisWinner(): LearningDomainResult<never> {
  return lrnFail(
    'INVALID_THESIS_SCOPE',
    'implicit thesis winner selection is forbidden'
  );
}

export function assertThesisIdInScope(
  thesisId: unknown,
  scope: ThesisScope
): LearningDomainResult<string> {
  const explicit = assertExplicitThesisId(thesisId);
  if (!explicit.ok) return explicit;
  const normalized = assertThesisScope(scope);
  if (!normalized.ok) return normalized;
  const s = normalized.value;
  if (s.kind === 'CLIENT_WIDE') {
    return lrnOk(explicit.value);
  }
  if (s.kind === 'SINGLE') {
    if (s.thesisId !== explicit.value) {
      return lrnFail(
        'INVALID_THESIS_SCOPE',
        `thesisId=${explicit.value} not in SINGLE scope ${s.thesisId}`
      );
    }
    return lrnOk(explicit.value);
  }
  if (!(s.thesisIds as readonly string[]).includes(explicit.value)) {
    return lrnFail(
      'INVALID_THESIS_SCOPE',
      `thesisId=${explicit.value} not in MULTI scope`
    );
  }
  return lrnOk(explicit.value);
}
