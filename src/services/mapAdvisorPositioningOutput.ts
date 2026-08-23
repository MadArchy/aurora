import type { AdvisorPositioningOutput } from '../application/ai/schemas/advisorPositioning';
import type { AdviceAction, AdviceCategory, AdviceHorizon, ImageDiagnosis } from '../types';

export interface AdvisorLiveAdvicePayload {
  summary?: string;
  diagnosis?: Partial<ImageDiagnosis>;
  actions?: Array<Partial<AdviceAction>>;
}

const VALID_CATEGORIES: AdviceCategory[] = ['CONTENT', 'CREDENTIAL', 'VISIBILITY', 'EVIDENCE', 'NETWORK', 'RISK'];
const VALID_HORIZONS: AdviceHorizon[] = ['DAYS_30', 'DAYS_60', 'DAYS_90'];

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Maps validated Gateway output to legacy advisor consumer shape. */
export function mapAdvisorPositioningOutputToLiveAdvice(
  output: AdvisorPositioningOutput
): AdvisorLiveAdvicePayload {
  return {
    summary: output.summary,
    diagnosis: output.diagnosis
      ? {
          strengths: output.diagnosis.strengths,
          gaps: output.diagnosis.gaps,
          risks: output.diagnosis.risks,
        }
      : undefined,
    actions: output.actions?.map((action) => ({
      title: action.title,
      why: action.description,
      how: action.description,
      category: VALID_CATEGORIES.includes(action.category as AdviceCategory)
        ? (action.category as AdviceCategory)
        : 'CONTENT',
      horizon: VALID_HORIZONS.includes(action.horizon as AdviceHorizon)
        ? (action.horizon as AdviceHorizon)
        : 'DAYS_30',
      effortMinutes: 45,
      impact: Number.isFinite(Number(action.priority)) ? clampScore(Number(action.priority)) : 60,
    })),
  };
}
