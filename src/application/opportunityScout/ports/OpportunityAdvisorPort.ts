/**
 * SPEC-007 Phase 2 — Optional Opportunity advisor port (SPEC-005 future).
 * Suggestions only — never materialize / accept / thesis / Plan authority.
 */

export interface OpportunityAdvisorSuggestion {
  dimensionHints?: Array<{ key: string; suggestedRawInput: number; note: string }>;
  rationaleNotes?: string[];
}

export interface OpportunityAdvisorSuggestInput {
  organizationId: string;
  clientId: string;
  candidateId: string;
  title: string;
  summary: string;
}

/**
 * Advisory suggestions only. Never approval, materialization, or thesis selection authority.
 */
export interface OpportunityAdvisorPort {
  suggest?(input: OpportunityAdvisorSuggestInput): OpportunityAdvisorSuggestion;
}
