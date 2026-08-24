import type {
  OutputFormatRecommendation,
  StrategicDisposition,
  StrategicScoreResult,
} from '../../types';
import { SCORING_VERSION } from '../../domain/scoringCore';

export interface GovernedScoreResult {
  signalId: string;
  clientId: string;
  organizationId: string;
  routingState: 'CLEAR';
  thesisId: string;
  scoreResult: StrategicScoreResult;
  recommendedDisposition: StrategicDisposition;
  recommendedOutputFormat: OutputFormatRecommendation;
  scoringVersion: string;
  /** True when an optional write port persisted the score. */
  persisted: boolean;
}

export function toGovernedScoreResult(input: {
  signalId: string;
  clientId: string;
  organizationId: string;
  thesisId: string;
  scoreResult: StrategicScoreResult;
  persisted: boolean;
}): GovernedScoreResult {
  const { scoreResult } = input;
  if (scoreResult.scoringVersion && scoreResult.scoringVersion !== SCORING_VERSION) {
    throw new Error(`Unexpected scoringVersion: ${scoreResult.scoringVersion}`);
  }
  return {
    signalId: input.signalId,
    clientId: input.clientId,
    organizationId: input.organizationId,
    routingState: 'CLEAR',
    thesisId: input.thesisId,
    scoreResult,
    recommendedDisposition:
      scoreResult.recommendedDisposition ??
      (scoreResult.recommendedAction === 'CREATE_OPPORTUNITY'
        ? 'OPPORTUNITY_CANDIDATE'
        : scoreResult.recommendedAction === 'RESEARCH_REQUIRED'
          ? 'RESEARCH_REQUIRED'
          : scoreResult.recommendedAction === 'MONITOR'
            ? 'MONITOR'
            : scoreResult.recommendedAction === 'NO_ACTION'
              ? 'NO_ACTION'
              : 'SAVE'),
    recommendedOutputFormat:
      scoreResult.recommendedOutputFormat ??
      (scoreResult.recommendedAction === 'VIDEO'
        ? 'VIDEO'
        : scoreResult.recommendedAction === 'SHORT_POST'
          ? 'SHORT_POST'
          : scoreResult.recommendedAction === 'ARTICLE'
            ? 'ARTICLE'
            : 'NONE'),
    scoringVersion: scoreResult.scoringVersion ?? SCORING_VERSION,
    persisted: input.persisted,
  };
}
