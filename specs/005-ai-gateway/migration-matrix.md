# Migration matrix — SPEC-005 Phase 5

| Operation | Legacy caller | Legacy prompt / session | Gateway input | Gateway output | promptId / version | Model role | aiRun | Status |
|-----------|---------------|-------------------------|---------------|----------------|--------------------|------------|-------|--------|
| CONTENT_DRAFT | `generateContentDraft` | session `complete('CONTENT_TASKS')` | `ContentDraftGatewayInput` | `ContentDraftOutput` | `tmpl_content_v1` / `1` | CREATIVE_WRITING | Gateway | **MIGRATED** (5A) |
| THESIS_PROPOSAL | `generateThesisProposal` | session `complete('POSITIONING_STRATEGIST')` / `thesis-generator-v1` | `ThesisProposalGatewayInput` | `ThesisProposalOutput` → `ThesisEditableFields` | `tmpl_thesis_proposal_v1` / `1` | DEEP_REASONING | Gateway | **MIGRATED** (5B) |
| SIGNAL_THESIS_EVAL | `analyzeSignalAgainstThesis` | session `complete` / `tmpl_strategist_signal_eval_v2` | `SignalThesisEvalGatewayInput` | `SignalThesisEvalOutput` (advisory overlay) | `tmpl_strategist_signal_eval_v2` / `2` | DEEP_REASONING | Gateway | **MIGRATED** (5B) |
| THESIS_CHALLENGE | `challengeThesis` | session `complete` (no aiRun historically) | `ThesisChallengeGatewayInput` | `ThesisChallengeOutput` → merge heuristic | `tmpl_thesis_challenge_v1` / `1` | DEEP_REASONING | Gateway | **MIGRATED** (5B) |
| ADVISOR_POSITIONING | `advisor.generatePositioningAdvice` | `runAgentJson` + session | `AdvisorPositioningGatewayInput` | `AdvisorPositioningOutput` → live advice merge | `tmpl_positioning_advisor_v1` / `1` | DEEP_REASONING | Gateway | **MIGRATED** (5C) |
| ADVISOR_CURATION_ANGLE | `advisor.proposeAngle` | `runAgentJson` + session | `AdvisorCurationAngleGatewayInput` | `AdvisorCurationAngleOutput` | `tmpl_curation_angle_v1` / `1` | FAST_STRUCTURED | Gateway | **MIGRATED** (5C) |
| ANALYSIS_COMPARATIVE | `runComparativeAnalysis` | dual session `complete` (OpenAI + Claude) | `AnalysisComparativeGatewayInput` | Aggregate `{ openai, anthropic }` → `AIComparativeResult` | `tmpl_comparative_analysis_v1` / `1` | DEEP_REASONING (×2) | Gateway COMPARATIVE | **MIGRATED** (5C-MP) |

## ANALYSIS_COMPARATIVE — MULTI_PROVIDER_COMPARISON (Phase 5C-MP)

**Classification:** `EXPLICIT MULTI_PROVIDER_COMPARISON` (not fallback)

| Aspect | Policy |
|--------|--------|
| Semantics | Two independent provider/model executions in ONE Gateway operation |
| Providers | OpenAI (`gpt-4o-mini`) + Anthropic (`claude-3-5-haiku-20241022`) — Phase-0 verified |
| Plan | `ModelRegistryPort.resolveComparativePlan` → `ComparativeExecutionPlan` |
| Concurrency | `Promise.all` in Application (`comparativeOrchestration.ts`) |
| Per-slice budget | `MAX_PROVIDER_CALLS_PER_PROVIDER_SLICE = 4` |
| Total budget | `MAX_COMPARATIVE_PROVIDER_CALLS = 8` (does not redefine single-provider 4) |
| Retry | Same-provider only (OpenAI→OpenAI, Anthropic→Anthropic) |
| Repair | **Provider-preserving** — same slice `ModelConfiguration` (never FAST_STRUCTURED cross-provider) |
| Failure | BOTH slices required; one-sided terminal failure → overall FAILED |
| Aggregate | Software logic after both validate — no judge model |
| Audit | `executionMode: COMPARATIVE` + `providerExecutions[2]` on one logical aiRun |

## Session-key dependency (post-5C-MP)

| Operation | Browser OpenAI/Anthropic key | X-AI-Session | Direct provider URL | Notes |
|-----------|------------------------------|--------------|---------------------|-------|
| All 7 structured LLM ops | NOT REQUIRED | NOT USED | NOT USED | ADMIN + Firebase → gateway |
| Legacy session infra | still present | still present | `/api/ai/complete` exists | **No active LLM consumer** — Phase 5D cleanup |

## runAgentJson / complete() disposition (post-5C-MP)

| Symbol | Active consumers |
|--------|------------------|
| `runAgentJson` | **0** (DEAD — definition retained for Phase 5D) |
| `complete()` LLM | **0** active business callers (`complete` only used inside dead `runAgentJson`) |

## Auth note

`aiComplete` remains **ADMIN_ONLY**. No auth policy weakening.
