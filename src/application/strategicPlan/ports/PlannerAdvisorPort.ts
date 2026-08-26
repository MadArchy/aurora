import type { StrategicAuthorizedAction } from '../../../domain/strategicBriefCore';

/**
 * Optional advisory seam — suggestions only.
 * Never approval, execution authority, or current Plan authority.
 * No SPEC-005 AiOperation / provider implementation in Phase 2.
 */
export interface PlannerAdvisorSuggestion {
  suggestedItems?: Array<{
    action: StrategicAuthorizedAction;
    order: number;
    rationale: string;
    channel?: string | null;
    format?: string | null;
  }>;
  note?: string;
  aiRunId?: string;
}

export interface PlannerAdvisorSuggestInput {
  organizationId: string;
  clientId: string;
  strategicBriefId: string;
  strategicBriefVersion: number;
  thesisId: string;
  planId?: string;
}

export interface PlannerAdvisorPort {
  suggest(input: PlannerAdvisorSuggestInput): PlannerAdvisorSuggestion;
}
