import { describe, expect, it } from 'vitest';
import {
  assertClaimSafeTransition,
  CLAIM_GATED_STATUSES,
  isClaimGatedStatus,
} from '../src/domain/claimSafetyGateCore';
import type { ClaimSafetyVerdictRecord } from '../src/types';

function record(
  verdict: ClaimSafetyVerdictRecord['verdict'],
  summary = 'test'
): ClaimSafetyVerdictRecord {
  return { verdict, summary, reviewedAt: '2026-08-21T12:00:00.000Z', findings: [] };
}

describe('assertClaimSafeTransition — Phase 4 demoted gate', () => {
  it('allows non-gated statuses without a review', () => {
    const result = assertClaimSafeTransition('DRAFT', 'AI_GENERATED', undefined);
    expect(result.allowed).toBe(true);
    expect(result.status).toBe('AI_GENERATED');
  });

  it('blocks gated advances when canonical AuthorizePublication decision is missing', () => {
    const result = assertClaimSafeTransition('AI_GENERATED', 'CLIENT_REVIEW', record('PASS'));
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/AuthorizePublication|canonical/i);
  });

  it('ignores forged claimSafety PASS when canonical denies', () => {
    for (const target of CLAIM_GATED_STATUSES) {
      const result = assertClaimSafeTransition('AI_GENERATED', target, record('PASS', 'forged'), {
        canonical: { allowed: false, reason: 'EVIDENCE_REQUIRED blocks', reasonCode: 'EVIDENCE_REQUIRED' },
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('EVIDENCE_REQUIRED');
    }
  });

  it('allows gated advance only when canonical.allowed is true', () => {
    const result = assertClaimSafeTransition('AI_GENERATED', 'CLIENT_REVIEW', record('BLOCK'), {
      canonical: { allowed: true, reasonCode: 'NO_CLAIMS' },
    });
    expect(result.allowed).toBe(true);
  });

  it('legacy REVIEW ack flags do not authorize without canonical', () => {
    const hard = assertClaimSafeTransition('AI_GENERATED', 'CLIENT_REVIEW', record('REVIEW'), {
      requireReviewAck: true,
      reviewAcknowledged: true,
    });
    expect(hard.allowed).toBe(false);
  });
});

describe('isClaimGatedStatus', () => {
  it('recognizes the gated set', () => {
    expect(isClaimGatedStatus('CLIENT_REVIEW')).toBe(true);
    expect(isClaimGatedStatus('DRAFT')).toBe(false);
  });
});
