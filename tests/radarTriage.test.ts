import { describe, expect, it } from 'vitest';
import {
  groupSignalsForTriage,
  shouldAutoDiscardScoredSignal,
  shouldAutoResearchSignal,
  triageBucket,
} from '../src/domain/radarTriageCore';
import type { Signal } from '../src/types';

function signal(partial: Partial<Signal> & Pick<Signal, 'id' | 'title'>): Signal {
  return {
    organizationId: 'org',
    sourceType: 'RSS',
    sourceName: 'Test',
    contentSnippet: 'snippet',
    fingerprint: partial.id,
    detectedAt: new Date().toISOString(),
    status: 'NEW',
    aiStatus: 'PENDING_AI',
    managerDecision: 'UNREVIEWED',
    ...partial,
  };
}

describe('radar triage', () => {
  it('puts CRITICAL and RESEARCH_REQUIRED into decide-now', () => {
    expect(triageBucket(signal({ id: '1', title: 'A', priorityBand: 'CRITICAL' }))).toBe('DECIDE_NOW');
    expect(
      triageBucket(
        signal({ id: '2', title: 'B', priorityBand: 'MEDIUM', recommendedAction: 'RESEARCH_REQUIRED' })
      )
    ).toBe('DECIDE_NOW');
  });

  it('groups signals into three columns', () => {
    const groups = groupSignalsForTriage([
      signal({ id: '1', title: 'Crit', priorityBand: 'HIGH', relevanceScore: 80 }),
      signal({ id: '2', title: 'Rev', priorityBand: 'MEDIUM', recommendedAction: 'SHORT_POST', relevanceScore: 55 }),
      signal({ id: '3', title: 'Mon', priorityBand: 'LOW', recommendedAction: 'MONITOR', relevanceScore: 30 }),
      signal({ id: '4', title: 'Gone', status: 'DISCARDED', priorityBand: 'HIGH' }),
    ]);
    expect(groups.decideNow.map((s) => s.id)).toEqual(['1']);
    expect(groups.review.map((s) => s.id)).toEqual(['2']);
    expect(groups.monitor.map((s) => s.id)).toEqual(['3']);
  });

  it('auto-discards low NO_ACTION scores', () => {
    expect(shouldAutoDiscardScoredSignal({ totalScore: 22, recommendedAction: 'NO_ACTION' })).toBe(true);
    expect(shouldAutoDiscardScoredSignal({ totalScore: 55, recommendedAction: 'NO_ACTION' })).toBe(false);
    expect(shouldAutoDiscardScoredSignal({ totalScore: 20, recommendedAction: 'MONITOR' })).toBe(false);
  });

  it('auto-researches only HIGH/CRITICAL with RESEARCH_REQUIRED', () => {
    expect(
      shouldAutoResearchSignal(
        signal({
          id: '1',
          title: 'Need research',
          priorityBand: 'HIGH',
          recommendedAction: 'RESEARCH_REQUIRED',
        })
      )
    ).toBe(true);
    expect(
      shouldAutoResearchSignal(
        signal({
          id: '2',
          title: 'Already done',
          priorityBand: 'HIGH',
          recommendedAction: 'RESEARCH_REQUIRED',
          researchBrief: {
            queriedAt: new Date().toISOString(),
            query: 'q',
            evidence: [],
            summary: 's',
            suggestedNextStep: 'SAVE',
          },
        })
      )
    ).toBe(false);
    expect(
      shouldAutoResearchSignal(
        signal({
          id: '3',
          title: 'Low',
          priorityBand: 'LOW',
          recommendedAction: 'RESEARCH_REQUIRED',
        })
      )
    ).toBe(false);
  });
});
