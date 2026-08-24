import { describe, expect, it } from 'vitest';
import {
  deriveStrategicRecommendation,
  LEGACY_RECOMMENDED_ACTION_MAP,
  toLegacyRecommendedAction,
} from '../src/domain/dispositionCore';
import type { OutputFormatRecommendation, StrategicDisposition } from '../src/types';

const DISPOSITION_VALUES: StrategicDisposition[] = [
  'NO_ACTION',
  'MONITOR',
  'SAVE',
  'RESEARCH_REQUIRED',
  'OPPORTUNITY_CANDIDATE',
  'LOW_PRIORITY',
];

const FORMAT_VALUES: OutputFormatRecommendation[] = [
  'NONE',
  'VIDEO',
  'SHORT_POST',
  'ARTICLE',
  'LINKEDIN_POST',
];

describe('SPEC-002 Phase 1 — dispositionCore', () => {
  it('keeps content formats out of StrategicDisposition', () => {
    for (const value of DISPOSITION_VALUES) {
      expect(['VIDEO', 'SHORT_POST', 'ARTICLE', 'LINKEDIN_POST']).not.toContain(value);
    }
  });

  it('keeps strategic dispositions out of OutputFormatRecommendation', () => {
    for (const value of FORMAT_VALUES) {
      expect(['RESEARCH_REQUIRED', 'NO_ACTION', 'MONITOR', 'OPPORTUNITY_CANDIDATE']).not.toContain(value);
    }
  });

  it('baseline ladder splits VIDEO into SAVE + VIDEO', () => {
    const split = deriveStrategicRecommendation({
      finalScore: 75,
      risk: 0,
      evidenceGap: 2,
      proofPointCount: 4,
    });
    expect(split.recommendedDisposition).toBe('SAVE');
    expect(split.recommendedOutputFormat).toBe('VIDEO');
    expect(split.legacyRecommendedAction).toBe('VIDEO');
  });

  it('baseline ladder splits SHORT_POST into SAVE + SHORT_POST', () => {
    const split = deriveStrategicRecommendation({
      finalScore: 55,
      risk: 0,
      evidenceGap: 2,
      proofPointCount: 4,
    });
    expect(split.recommendedDisposition).toBe('SAVE');
    expect(split.recommendedOutputFormat).toBe('SHORT_POST');
    expect(split.legacyRecommendedAction).toBe('SHORT_POST');
  });

  it('legacy map round-trips through toLegacyRecommendedAction', () => {
    for (const [legacy, split] of Object.entries(LEGACY_RECOMMENDED_ACTION_MAP)) {
      const roundTrip = toLegacyRecommendedAction(
        split.recommendedDisposition,
        split.recommendedOutputFormat
      );
      if (legacy === 'CREATE_TOPIC' || legacy === 'TASK') {
        expect(roundTrip).toBe('SAVE');
      } else {
        expect(roundTrip).toBe(legacy);
      }
    }
  });
});
