# Migration matrix — SPEC-005 Phase 5 (final)

| Operation | Status | Session-key | Direct provider fallback | Server Gateway | Audit |
|-----------|--------|-------------|--------------------------|----------------|-------|
| CONTENT_DRAFT | **MIGRATED** | NO | NONE | YES | YES (Gateway aiRun) |
| THESIS_PROPOSAL | **MIGRATED** | NO | NONE | YES | YES |
| SIGNAL_THESIS_EVAL | **MIGRATED** | NO | NONE | YES | YES |
| THESIS_CHALLENGE | **MIGRATED** | NO | NONE | YES | YES |
| ADVISOR_POSITIONING | **MIGRATED** | NO | NONE | YES | YES |
| ADVISOR_CURATION_ANGLE | **MIGRATED** | NO | NONE | YES | YES |
| ANALYSIS_COMPARATIVE | **MIGRATED** | NO | NONE | YES (multi-provider) | YES (`executionMode: COMPARATIVE`) |

## Phase 5D — legacy infrastructure REMOVED

| Artifact | Disposition |
|----------|-------------|
| `runAgentJson` | **REMOVED** |
| `complete()` browser proxy | **REMOVED** |
| `setSessionKeys` / `clearSessionKeys` | **REMOVED** |
| `X-AI-Session` | **REMOVED** (zero executable refs) |
| `/api/ai/session` | **REMOVED** |
| `/api/ai/complete` | **REMOVED** |
| Manager OpenAI/Claude key UI | **REMOVED** |
| Browser provider credential state | **REMOVED** |
| `/api/ai/gateway-complete` | **PRESERVED** (local Gateway bridge) |
| `aiComplete` Cloud Function | **PRESERVED** |
| Server `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | **PRESERVED** (Secret Manager) |

## Local workflow (post-5D)

```text
Browser (ADMIN + Firebase)
  → AiCompleteHttpClient (Bearer ID token)
  → /api/ai/gateway-complete (dev) OR Cloud Function aiComplete
  → ExecuteAiOperation → ModelRegistry → Provider adapters
```

No browser provider keys. No restoration of session-key UI.

## ANALYSIS_COMPARATIVE (preserved)

Explicit OpenAI + Anthropic slices; provider-preserving retry/repair; one logical aiRun with `providerExecutions[2]`; max 4 calls/slice, max 8 total; 270s Gateway deadline.
