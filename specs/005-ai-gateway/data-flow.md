# Data Flow 005 — Current AI Architecture

Phase 0 snapshot. **Not target state.**

---

## LLM path (development — ACTIVE)

```text
Manager UI (ManagerCockpit / main.ts)
  │ user enters OpenAI + Claude keys
  ▼
POST /api/ai/session  ──►  server/postura-api.ts  (in-memory Map, 60m TTL)
  │
  ▼
src/services/ai.ts  AIService.complete()
  │ routeRequest() → hardcoded gpt-4o-mini | claude-3-5-haiku-20241022
  ▼
POST /api/ai/complete  ──►  server/postura-api.ts
  ├─► fetch https://api.openai.com/v1/chat/completions     [CS-001]
  └─► fetch https://api.anthropic.com/v1/messages          [CS-002]
  │
  ▼
validateAiPayload() — JSON.parse + script-tag regex only
  │
  ▼
Browser: JSON.parse(live.text) as T  — NO Zod
  │
  ├─► optional field fallbacks
  ├─► dbService.recordAiRun()  (some paths)
  └─► domain persistence (thesis, content, signals, advisor)
```

**Loopback guard:** `isLoopbackOrigin()` — dev only.

---

## LLM path (production — BROKEN)

```text
Browser  AIService.complete()
  ▼
fetch /api/ai/complete   ──► 404 / no Vite middleware on static hosting
  OR
fetch VITE_POSTURA_FUNCTIONS_BASE/aiComplete  ──►  501 NOT_IMPLEMENTED
```

Cloud Function `aiComplete` (`functions/src/index.ts`):

- Auth: **`AICOMPLETE_ADMIN_ONLY`** — `requirePosturaAuth({ adminOnly: true })` + rate limit
- Secrets: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (read via `runAiCompleteHttp` → `createServerAiGateway`)
- Handler: hexagonal gateway (`ExecuteAiOperation`)
- **Phase 2:** returns validated results when secrets configured — **code only, not deployed**
- CLIENT role: **not reachable** on this endpoint (403 before handler)

---

## Intelligence APIs (production — ACTIVE)

```text
Browser (sourceApi.ts / tavilyDiscovery.ts)
  ▼
Firebase Bearer token
  ▼
Cloud Functions
  ├─ tavilySearch  → api.tavily.com/search     (TAVILY_API_KEY secret)
  └─ youtubeApi    → googleapis.com/youtube/v3 (YOUTUBE_API_KEY secret)
```

Dev fallback: same endpoints via Vite proxy (`postura-api.ts`).

**Not LLM** — excluded from gateway provider adapters except shared HTTP auth patterns.

---

## Heuristic agents (no LLM)

```text
runTopicAgent()           → rankDailyTopics()           → aiRuns ✓
runResearchSignalsAgent() → Tavily + synthesizeResearchSummary() → aiRuns ✓
runSourceDiscoveryAgent() → heuristics + Tavily/YouTube  → localStorage only ✗ aiRuns
```

---

## aiRuns persistence

```text
dbService.recordAiRun()
  ├─ localStorage (postura_ai_runs_v5)
  └─ Firestore sync: clients/{clientId}/aiRuns/{id}
       envelope: organizationId + clientId (SPEC-009)
```

---

## Bypass / duplicate paths

| Issue | Evidence |
|-------|----------|
| Dual Tavily implementation | `server/sourceFeedCore.ts` + `functions/src/lib/sourceFeedCore.ts` |
| Comparative analysis skips aiRuns | `ai.ts` `runComparativeAnalysis` |
| challengeThesis LLM skips aiRuns | `ai.ts` `challengeThesis` |
| Source Discovery no aiRuns | `sourceDiscoveryAgent.ts` |
| Docs describe `ai/providers/*` | **Not in repo** |

---

## Target flow (SPEC-005 — NOT IMPLEMENTED)

```text
UI / service
  ▼
GatewayClient (typed operation id + input)
  ▼
Cloud Function / server AiGateway.execute()
  ├─ resolve tenant from Firebase Auth claims
  ├─ ModelRegistry.resolve(operation)
  ├─ PromptRegistry.load(promptId, version)
  ├─ ProviderAdapter.complete()
  ├─ GatewayExecutionDeadline (wall-clock budget)
  ├─ executeProviderWithRetry() — bounded technical retry (Application)
  ├─ validateAiOutput() → VALID | REPAIR_REQUIRED | REJECTED
  ├─ resolveRepair() → one repair provider call (if eligible)
  ├─ validateAiOutput() again (same schema)
  └─ success | REPAIR_FAILED | technical error
  ├─ write aiRuns (full metadata)
  └─ return AiResult<T> — domain-safe output only
```

See `plan.md` §Target Architecture.

---

## Phase 1H module (2026-08-23)

Hexagonal split — dependencies point inward:

| Layer | Path | Contents |
|-------|------|----------|
| Domain | `src/domain/ai/` | `AiOperation`, validation states, model roles, tenant types, errors |
| Application | `src/application/ai/` | contracts, Zod schemas, validation pipeline, ports, use cases |
| Composition | `src/composition/ai/` | test-only wiring (`createTestAiGateway`) |
| Infrastructure | `src/infrastructure/ai/` | **not implemented** — Phase 2+ |
| Interfaces | `src/interfaces/ai/` | **not implemented** — Phase 2+ |

Trust boundary:

```text
PROVIDER RAW OUTPUT (untrusted)
        ↓
APPLICATION VALIDATION (Zod + repair pipeline)
        ↓
ValidatedDomainOutput (trusted)
        ↓
DOMAIN / DOWNSTREAM
```

Inbound port: `AiGatewayPort.execute(request)`  
Outbound ports: `AiProviderPort`, `ModelRegistryPort`, `PromptRegistryPort`, `AiRunRepositoryPort`

See `hexagonal-boundaries.md` for full migration matrix.

**No provider HTTP in Phase 1/1H.** Legacy dev path unchanged.
