# Migration matrix — SPEC-005 Phase 5

| Operation | Legacy caller | Legacy prompt / session | Gateway input | Gateway output | promptId / version | Model role | aiRun | Status |
|-----------|---------------|-------------------------|---------------|----------------|--------------------|------------|-------|--------|
| CONTENT_DRAFT | `generateContentDraft` | session `complete('CONTENT_TASKS')` | `ContentDraftGatewayInput` | `ContentDraftOutput` | `tmpl_content_v1` / `1` | CREATIVE_WRITING | Gateway | **MIGRATED** (5A) |
| THESIS_PROPOSAL | `generateThesisProposal` | session `complete('POSITIONING_STRATEGIST')` / `thesis-generator-v1` | `ThesisProposalGatewayInput` | `ThesisProposalOutput` → `ThesisEditableFields` | `tmpl_thesis_proposal_v1` / `1` | DEEP_REASONING | Gateway | **MIGRATED** (5B) |
| SIGNAL_THESIS_EVAL | `analyzeSignalAgainstThesis` | session `complete` / `tmpl_strategist_signal_eval_v2` | `SignalThesisEvalGatewayInput` | `SignalThesisEvalOutput` (advisory overlay) | `tmpl_strategist_signal_eval_v2` / `2` | DEEP_REASONING | Gateway | **MIGRATED** (5B) |
| THESIS_CHALLENGE | `challengeThesis` | session `complete` (no aiRun historically) | `ThesisChallengeGatewayInput` | `ThesisChallengeOutput` → merge heuristic | `tmpl_thesis_challenge_v1` / `1` | DEEP_REASONING | Gateway | **MIGRATED** (5B) |
| ADVISOR_POSITIONING | `advisor.generatePositioningAdvice` | `runAgentJson` + session | `AdvisorPositioningGatewayInput` | `AdvisorPositioningOutput` → live advice merge | `tmpl_positioning_advisor_v1` / `1` | DEEP_REASONING | Gateway | **MIGRATED** (5C) |
| ADVISOR_CURATION_ANGLE | `advisor.proposeAngle` | `runAgentJson` + session | `AdvisorCurationAngleGatewayInput` | `AdvisorCurationAngleOutput` | `tmpl_curation_angle_v1` / `1` | FAST_STRUCTURED | Gateway | **MIGRATED** (5C) |
| ANALYSIS_COMPARATIVE | `runComparativeAnalysis` | dual session `complete` (OpenAI + Claude) | — | — | `tmpl_comparative_analysis_v1` / `1` | DEEP_REASONING | legacy | **BLOCKED** (5C semantic conflict) |

## ANALYSIS_COMPARATIVE blocker (Phase 5C)

**Classification:** `MULTI_PROVIDER_COMPARISON` (type B)

Legacy `runComparativeAnalysis` deliberately executes **two** provider calls (OpenAI then Claude) with the same prompt and returns side-by-side outputs. Current Gateway routes **one** provider/model per operation via `DEFAULT_MODEL_ROLE_BY_OPERATION`. Migrating as single-model would silently reduce product semantics.

**Resolution required:** explicit multi-provider orchestration contract + audit representation before migration. See Phase 5D gate.

## Session-key dependency (post-5C)

| Operation | Browser OpenAI/Anthropic key | X-AI-Session | Direct provider URL | Notes |
|-----------|------------------------------|--------------|---------------------|-------|
| CONTENT_DRAFT | NOT REQUIRED | NOT USED | NOT USED | ADMIN + Firebase → gateway |
| THESIS_PROPOSAL | NOT REQUIRED | NOT USED | NOT USED | ADMIN + Firebase → gateway; CLIENT/non-Firebase → heuristic NON_AI_LOCAL_FALLBACK |
| SIGNAL_THESIS_EVAL | NOT REQUIRED | NOT USED | NOT USED | ADMIN → gateway; else scoring-only degraded |
| THESIS_CHALLENGE | NOT REQUIRED | NOT USED | NOT USED | ADMIN → gateway; else heuristic NON_AI_LOCAL_FALLBACK |
| ADVISOR_POSITIONING | NOT REQUIRED | NOT USED | NOT USED | ADMIN → gateway; else heuristic NON_AI_LOCAL_FALLBACK |
| ADVISOR_CURATION_ANGLE | NOT REQUIRED | NOT USED | NOT USED | ADMIN → gateway; else heuristic NON_AI_LOCAL_FALLBACK |
| ANALYSIS_COMPARATIVE | STILL REQUIRED (dev session) | USED | via `/api/ai/complete` | Blocked — dual provider legacy path |

## Auth note (THESIS_PROPOSAL)

`aiComplete` remains **ADMIN_ONLY**. CLIENT onboarding that calls `generateThesisProposal` does **not** get gateway AI — it receives the existing profile heuristic. No auth policy weakening.

## runAgentJson / complete() disposition (post-5C)

| Symbol | Active consumers |
|--------|------------------|
| `runAgentJson` | **0** (DEAD AFTER PHASE 5C — definition remains for Phase 5D cleanup) |
| `complete()` LLM | **1** — `runComparativeAnalysis` only (dual OpenAI + Claude) |
