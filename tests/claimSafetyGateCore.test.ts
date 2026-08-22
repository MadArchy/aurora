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

describe('assertClaimSafeTransition', () => {
  it('allows non-gated statuses without a review', () => {
    const result = assertClaimSafeTransition('DRAFT', 'AI_GENERATED', undefined);
    expect(result.allowed).toBe(true);
    expect(result.status).toBe('AI_GENERATED');
  });

  it('blocks gated advances when claim safety is missing', () => {
    const result = assertClaimSafeTransition('AI_GENERATED', 'CLIENT_REVIEW', undefined);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('AI_GENERATED');
  });

  it('blocks CLIENT_REVIEW / READY / PUBLISHED when the verdict is BLOCK', () => {
    for (const target of CLAIM_GATED_STATUSES) {
      const result = assertClaimSafeTransition('AI_GENERATED', target, record('BLOCK', 'cargo sin evidencia'));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('bloquea');
    }
  });

  it('allows PASS into CLIENT_REVIEW', () => {
    const result = assertClaimSafeTransition('AI_GENERATED', 'CLIENT_REVIEW', record('PASS'));
    expect(result.allowed).toBe(true);
  });

  it('allows REVIEW by default and can require an explicit ack', () => {
    const soft = assertClaimSafeTransition('AI_GENERATED', 'CLIENT_REVIEW', record('REVIEW'));
    expect(soft.allowed).toBe(true);

    const hard = assertClaimSafeTransition('AI_GENERATED', 'CLIENT_REVIEW', record('REVIEW'), {
      requireReviewAck: true,
    });
    expect(hard.allowed).toBe(false);
    expect(hard.requiresAck).toBe(true);

    const acked = assertClaimSafeTransition('AI_GENERATED', 'CLIENT_REVIEW', record('REVIEW'), {
      requireReviewAck: true,
      reviewAcknowledged: true,
    });
    expect(acked.allowed).toBe(true);
  });
});

describe('isClaimGatedStatus', () => {
  it('recognizes the gated set', () => {
    expect(isClaimGatedStatus('CLIENT_REVIEW')).toBe(true);
    expect(isClaimGatedStatus('DRAFT')).toBe(false);
  });
});
