import { describe, expect, it } from 'vitest';
import {
  createScoreHistoryEntry,
  isMaterialScoreChange,
  toScoreHistorySnapshotFromResult,
  type ScoreHistoryMaterialSnapshot,
} from '../src/domain/scoreHistoryCore';
import { SCORING_VERSION } from '../src/domain/scoringCore';
import type { StrategicScoreResult } from '../src/types';

const ROUTING = {
  routingState: 'CLEAR' as const,
  routedThesisId: 'thesis_a',
  routingAlgorithmVersion: 'routing-v1',
};

function baseScore(overrides: Partial<StrategicScoreResult> = {}): StrategicScoreResult {
  return {
    totalScore: 63,
    priorityBand: 'MEDIUM',
    factors: {
      thesisMatch: 0.6,
      audienceMatch: 0.5,
      timeliness: 0.7,
      authorityFit: 0.5,
      differentiation: 0.72,
      strategicPotential: 0.55,
      commercialPotential: 0.4,
      sourceQuality: 0.8,
    },
    penalties: { evidenceGap: 0, risk: 0, staleness: 0, conflict: 0 },
    strategicRationale: 'test',
    recommendedAction: 'MONITOR',
    recommendedDisposition: 'MONITOR',
    recommendedOutputFormat: 'NONE',
    scoringVersion: SCORING_VERSION,
    scoringStatus: 'SCORED',
    calculatedAt: '2026-08-23T22:00:00.000Z',
    ...overrides,
  };
}

function snap(score: StrategicScoreResult): ScoreHistoryMaterialSnapshot {
  return toScoreHistorySnapshotFromResult(score, ROUTING);
}

describe('SPEC-002 Phase 3 — scoreHistoryCore materiality', () => {
  it('first assignment is not material (no history on INITIAL)', () => {
    const next = snap(baseScore());
    expect(isMaterialScoreChange(null, next)).toBe(false);
    expect(isMaterialScoreChange(undefined, next)).toBe(false);
  });

  it('score change 55 MEDIUM → 75 HIGH is material', () => {
    const prev = snap(baseScore({ totalScore: 55, priorityBand: 'MEDIUM' }));
    const next = snap(baseScore({ totalScore: 75, priorityBand: 'HIGH' }));
    expect(isMaterialScoreChange(prev, next)).toBe(true);
  });

  it('band boundary 69 MEDIUM → 70 HIGH is material', () => {
    const prev = snap(baseScore({ totalScore: 69, priorityBand: 'MEDIUM' }));
    const next = snap(baseScore({ totalScore: 70, priorityBand: 'HIGH' }));
    expect(isMaterialScoreChange(prev, next)).toBe(true);
  });

  it('scoringVersion change is material at same total score', () => {
    const prev = snap(baseScore({ scoringVersion: 'scoring-v1' }));
    const next = snap(baseScore({ scoringVersion: 'scoring-v2' }));
    expect(isMaterialScoreChange(prev, next)).toBe(true);
  });

  it('timestamp-only equivalent rescore is not material', () => {
    const prev = snap(baseScore());
    const next = snap(baseScore({ calculatedAt: '2026-08-23T23:00:00.000Z' }));
    expect(isMaterialScoreChange(prev, next)).toBe(false);
  });

  it('disposition change at same score is material', () => {
    const prev = snap(
      baseScore({
        recommendedDisposition: 'MONITOR',
        recommendedOutputFormat: 'NONE',
      })
    );
    const next = snap(
      baseScore({
        recommendedDisposition: 'RESEARCH_REQUIRED',
        recommendedOutputFormat: 'NONE',
      })
    );
    expect(isMaterialScoreChange(prev, next)).toBe(true);
  });

  it('factor composition change at same total score is material', () => {
    const prev = snap(baseScore());
    const next = snap(
      baseScore({
        factors: {
          ...baseScore().factors,
          thesisMatch: 0.9,
          audienceMatch: 0.3,
        },
      })
    );
    expect(isMaterialScoreChange(prev, next)).toBe(true);
  });

  it('output format change is material', () => {
    const prev = snap(
      baseScore({
        recommendedDisposition: 'SAVE',
        recommendedOutputFormat: 'VIDEO',
      })
    );
    const next = snap(
      baseScore({
        recommendedDisposition: 'SAVE',
        recommendedOutputFormat: 'SHORT_POST',
      })
    );
    expect(isMaterialScoreChange(prev, next)).toBe(true);
  });

  it('history entry excludes forbidden AI raw fields', () => {
    const prev = snap(baseScore({ totalScore: 55, priorityBand: 'MEDIUM' }));
    const next = snap(baseScore({ totalScore: 75, priorityBand: 'HIGH' }));
    const entry = createScoreHistoryEntry({
      organizationId: 'org_test',
      clientId: 'client_test',
      signalId: 'sig_1',
      previous: prev,
      next,
      actorId: 'SYSTEM',
      changedAt: '2026-08-23T22:00:00.000Z',
    });
    expect(entry).not.toHaveProperty('rawPrompt');
    expect(entry).not.toHaveProperty('rawProviderOutput');
    expect(entry).not.toHaveProperty('apiKey');
    expect(entry.next.scoringVersion).toBe('scoring-v1');
  });
});
