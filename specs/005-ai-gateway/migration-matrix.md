# Migration matrix — SPEC-005 Phase 5

| Operation | Legacy caller | Legacy prompt / session | Gateway input | Gateway output | promptId / version | Model role | aiRun | Status |
|-----------|---------------|-------------------------|---------------|----------------|--------------------|------------|-------|--------|
| CONTENT_DRAFT | `generateContentDraft` | session `complete('CONTENT_TASKS')` | `ContentDraftGatewayInput` | `ContentDraftOutput` | `tmpl_content_v1` / `1` | CREATIVE_WRITING | Gateway | **MIGRATED** (5A) |
| THESIS_PROPOSAL | `generateThesisProposal` | session `complete('POSITIONING_STRATEGIST')` / `thesis-generator-v1` | `ThesisProposalGatewayInput` | `ThesisProposalOutput` → `ThesisEditableFields` | `tmpl_thesis_proposal_v1` / `1` | DEEP_REASONING | Gateway | **MIGRATED** (5B) |
| SIGNAL_THESIS_EVAL | `analyzeSignalAgainstThesis` | session `complete` / `tmpl_strategist_signal_eval_v2` | `SignalThesisEvalGatewayInput` | `SignalThesisEvalOutput` (advisory overlay) | `tmpl_strategist_signal_eval_v2` / `2` | DEEP_REASONING | Gateway | **MIGRATED** (5B) |
| THESIS_CHALLENGE | `challengeThesis` | session `complete` (no aiRun historically) | `ThesisChallengeGatewayInput` | `ThesisChallengeOutput` → merge heuristic | `tmpl_thesis_challenge_v1` / `1` | DEEP_REASONING | Gateway | **MIGRATED** (5B) |
| ADVISOR_POSITIONING | `advisor.generatePositioningAdvice` | `runAgentJson` + session | — | — | `tmpl_positioning_advisor_v1` / `1` | DEEP_REASONING | legacy | **NOT MIGRATED** |
| ADVISOR_CURATION_ANGLE | `advisor.proposeAngle` | `runAgentJson` + session | — | — | `tmpl_curation_angle_v1` / `1` | FAST_STRUCTURED | legacy | **NOT MIGRATED** |
| ANALYSIS_COMPARATIVE | `runComparativeAnalysis` | dual session `complete` | — | — | `tmpl_comparative_analysis_v1` / `1` | DEEP_REASONING | legacy | **NOT MIGRATED** |

## Session-key dependency (post-5B)

| Operation | Browser OpenAI/Anthropic key | X-AI-Session | Direct provider URL | Notes |
|-----------|------------------------------|--------------|---------------------|-------|
| CONTENT_DRAFT | NOT REQUIRED | NOT USED | NOT USED | ADMIN + Firebase → gateway |
| THESIS_PROPOSAL | NOT REQUIRED | NOT USED | NOT USED | ADMIN + Firebase → gateway; CLIENT/non-Firebase → heuristic NON_AI_LOCAL_FALLBACK |
| SIGNAL_THESIS_EVAL | NOT REQUIRED | NOT USED | NOT USED | ADMIN → gateway; else scoring-only degraded |
| THESIS_CHALLENGE | NOT REQUIRED | NOT USED | NOT USED | ADMIN → gateway; else heuristic NON_AI_LOCAL_FALLBACK |
| Advisor / comparative | STILL REQUIRED (dev session) | USED | via `/api/ai/complete` | Phase 5C+ |

## Auth note (THESIS_PROPOSAL)

`aiComplete` remains **ADMIN_ONLY**. CLIENT onboarding that calls `generateThesisProposal` does **not** get gateway AI — it receives the existing profile heuristic. No auth policy weakening.
