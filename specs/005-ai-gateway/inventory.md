# Inventory 005 — AI Gateway (Phase 0)

**Mode:** READ-ONLY inventory · **Date:** 2026-08-23  
**Branch:** `spec/005-ai-gateway` @ `04e65ff`  
**Baseline tests:** check **286/286** · test:rules **91/91**

---

## §1 AI call-site inventory (11 LLM paths + 2 provider integrations)

### Provider integrations (server fetch)

| ID | File | Function | Runtime | Provider | Model | Endpoint | Status |
|----|------|----------|---------|----------|-------|----------|--------|
| CS-001 | `server/postura-api.ts` | `/api/ai/complete` OpenAI branch | server (Vite dev) | OpenAI | body or `gpt-4o-mini` | `api.openai.com/v1/chat/completions` | **ACTIVE** (loopback) |
| CS-002 | `server/postura-api.ts` | `/api/ai/complete` Claude branch | server (Vite dev) | Anthropic | body or `claude-3-5-haiku-20241022` | `api.anthropic.com/v1/messages` | **ACTIVE** (loopback) |
| CS-005 | `functions/src/index.ts` | `aiComplete` | Cloud Function | OpenAI (+ Anthropic secret declared) | via ModelRegistry | n/a | **Phase 2 wired** (ADMIN-only; not deployed) |

### Browser orchestration → `/api/ai/complete`

| ID | File | Function | Agent | promptTemplateId | aiRuns | Tenant | Validation |
|----|------|----------|-------|------------------|--------|--------|------------|
| CS-006 | `src/services/ai.ts` | `runAgentJson<T>` | caller | caller | ✓ | org + optional clientId | `JSON.parse as T` |
| CS-007 | `src/services/ai.ts` | `analyzeSignalAgainstThesis` | POSITIONING_STRATEGIST | `tmpl_strategist_signal_eval_v2` | ✓ | thesis org/client | parse + fallbacks |
| CS-008 | `src/services/ai.ts` | `runComparativeAnalysis` | COMPARATIVE | inline | **✗** | signal/thesis ids only | parse ×2 |
| CS-009 | `src/services/ai.ts` | `generateThesisProposal` | POSITIONING_STRATEGIST | `thesis-generator-v1` | ✓ | from context | parse + fallbacks |
| CS-010 | `src/services/ai.ts` | `challengeThesis` | POSITIONING_STRATEGIST | inline | **✗** (LLM path) | thesis | parse + merge heuristic |
| CS-011 | `src/services/ai.ts` | `generateContentDraft` | CONTENT_TASKS | `tmpl_content_v1` | ✓ | content context | parse + claimSafety rules |
| CS-006a | `src/services/advisor.ts` | `generatePositioningAdvice` | POSITIONING_STRATEGIST | `tmpl_positioning_advisor_v1` | ✓ | client org | via CS-006 |
| CS-006b | `src/services/advisor.ts` | `proposeAngle` | POSITIONING_STRATEGIST | `tmpl_curation_angle_v1` | ✓ | client org | via CS-006 |

### Session / key path (not LLM, gateway entry)

| ID | File | Notes | Status |
|----|------|-------|--------|
| CS-012 | `ai.ts` + `postura-api.ts` | User keys → `POST /api/ai/session` → in-memory 60m | **CLIENT-SIDE RISK** (dev) |

### Non-LLM intelligence APIs

| ID | File | Provider | aiRuns | Status |
|----|------|----------|--------|--------|
| CS-003 | `server/sourceFeedCore.ts`, `functions/.../sourceFeedCore.ts` | Tavily | via research agent | **ACTIVE** |
| CS-004 | `server/youtubeCore.ts`, `functions/.../youtubeCore.ts` | YouTube Data v3 | no | **ACTIVE** |

### Heuristic agents

| ID | File | LLM? | aiRuns | Status |
|----|------|------|--------|--------|
| CS-013 | `src/services/topicAgent.ts` | No | ✓ | **ACTIVE** |
| CS-014 | `src/services/researchSignalsAgent.ts` | No (Tavily) | ✓ | **ACTIVE** |
| CS-015 | `src/services/sourceDiscoveryAgent.ts` | No | ✗ | **ACTIVE** |

**Total LLM business call sites:** **9** (6 in `ai.ts` + 2 advisor + 1 generic runner used by advisor)  
**Live provider HTTP calls:** **2** (OpenAI + Anthropic in dev proxy only)

---

## §2 Provider inventory

| Provider | Package/SDK | API style | Env var | Usage | Status |
|----------|-------------|-----------|---------|-------|--------|
| OpenAI | none (raw fetch) | Chat Completions REST | `OPENAI_API_KEY` (CF secret); session key (dev) | dev proxy + stub CF | **PARTIAL** |
| Anthropic | none (raw fetch) | Messages REST | session key only (dev); **no CF secret** | dev proxy only | **PARTIAL** |
| Tavily | none | Search REST | `TAVILY_API_KEY` | dev + CF | **ACTIVE** |
| YouTube | none | Data API v3 | `YOUTUBE_API_KEY` | dev + CF | **ACTIVE** |
| Google Gemini | — | — | — | — | **DEAD** (not referenced) |

---

## §3 Model inventory

| Model ID | Provider | File(s) | Purpose | Hardcoded | Consumers |
|----------|----------|---------|---------|-----------|-----------|
| `gpt-4o-mini` | OpenAI | `ai.ts`, `postura-api.ts` | default OpenAI | yes | all OPENAI routes |
| `gpt-4o` | OpenAI | `postura-api.ts` allowlist | allowed | allowlist | optional body |
| `gpt-4.1-mini` | OpenAI | `postura-api.ts` allowlist | allowed | allowlist | optional body |
| `claude-3-5-haiku-20241022` | Anthropic | `ai.ts`, `postura-api.ts` | default Claude | yes | CLAUDE routes |
| `claude-3-5-sonnet-20241022` | Anthropic | `postura-api.ts` allowlist | allowed | allowlist | optional body |
| `topic-agent-v1` | pseudo | `topicAgent.ts` | heuristic label | yes | topic agent |
| `research-signals-tavily-v1` | pseudo | `researchSignalsAgent.ts` | Tavily label | yes | research agent |

**UI-only labels:** `GPT-4o`, `Claude 3.7` in `ManagerCockpit.ts` — not wired.

**Inconsistency:** `ModelClass` enum exists in types but routing uses hardcoded strings in `routeRequest()`.

---

## §4 Client-side AI security

| Finding | Classification | Evidence |
|---------|----------------|----------|
| No `VITE_OPENAI_*` / `VITE_ANTHROPIC_*` | SAFE | grep clean |
| User API keys in Manager UI | **CLIENT-SIDE RISK** P0 | `ManagerCockpit.ts`, `main.ts` → `/api/ai/session` |
| Browser orchestrates all LLM calls | **CLIENT-SIDE RISK** P0 | `src/services/ai.ts` fetch `/api/ai/*` |
| Tavily/YouTube via CF Bearer | SAFE SERVER-SIDE | `sourceApi.ts` |
| Production LLM broken (501) | mitigates prod leak | `functions/src/index.ts` |

---

## §5 Server-side entry points

| Export | Auth | App Check | Tenant | Schema | Status |
|--------|------|-----------|--------|--------|--------|
| `aiComplete` | ADMIN Bearer | no | org from token; clientId from body (scoped ops) | gateway execute | **Phase 2** (not deployed) |
| `tavilySearch` | ADMIN Bearer | no | uid rate limit | n/a | ACTIVE |
| `youtubeApi` | ADMIN Bearer | no | uid rate limit | n/a | ACTIVE |
| `topicAgentRun` | callable | no | echo | none | STUB |
| `rssProxy` | ADMIN | no | n/a | n/a | ACTIVE (not AI) |

---

## §6 Agent / service inventory

| Agent | Purpose | Callers | Provider | Structured schema | Tests |
|-------|---------|---------|----------|-------------------|-------|
| POSITIONING_STRATEGIST | thesis, signals, advisor | `main.ts`, `advisor.ts` | OpenAI/Claude | informal JSON | none |
| CONTENT_TASKS | content drafts | `main.ts` | OpenAI/Claude | informal JSON | none |
| RESEARCH_SIGNALS | Tavily research | `main.ts` | Tavily | ResearchSignalOutput type | `researchSignalsAgent.test.ts` |
| TOPIC_AGENT | daily topics | `main.ts` | heuristic | TopicAgentOutput | `topicAgent.test.ts` |
| PROFILE | — | **unused** | — | — | — |
| Source Discovery | source recommendations | UI | heuristic+APIs | localStorage | `sourceDiscoveryAgent.test.ts` |
| Claim Safety | post-draft rules | `ai.ts` | **no LLM** | rule engine | `claimSafetyCore.test.ts` |

---

## §7 Prompt inventory

| promptTemplateId | File | Versioned? | Combines concerns? |
|------------------|------|------------|-------------------|
| `tmpl_positioning_advisor_v1` | advisor.ts | id only | strategy |
| `tmpl_curation_angle_v1` | advisor.ts | id only | curation |
| `tmpl_strategist_signal_eval_v2` | ai.ts | id only | signal + thesis |
| `thesis-generator-v1` | ai.ts | id only | strategy + profile |
| `tmpl_content_v1` | ai.ts | id only | writing |
| `topic_agent_daily_v1` | topicAgent.ts | id only | topics |
| `research_signals_v1` | researchSignalsAgent.ts | id only | research |

All prompts: **inline strings**. System prompt fixed in `ai.ts` L160 and `postura-api.ts` L157.

**Duplication:** signal/thesis context blocks repeated across CS-007, CS-008, advisor.

---

## §8 Structured output / parsing

| Site | Parser | Runtime validation | Class |
|------|--------|-------------------|-------|
| `ai.ts` runAgentJson | `JSON.parse as T` | no | **DANGEROUS_CAST** |
| `ai.ts` analyzeSignal… | parse + fallbacks | no | **UNVALIDATED** |
| `ai.ts` comparative | parse ×2 | no | **UNVALIDATED** |
| `ai.ts` thesis proposal | parse + fallbacks | no | **WEAK_VALIDATION** |
| `ai.ts` challengeThesis | parse | no | **UNVALIDATED** |
| `ai.ts` content draft | parse + claimSafety | partial (post-hoc rules) | **WEAK_VALIDATION** |
| `postura-api.ts` | JSON.parse + regex | no schema | **WEAK_VALIDATION** |

**P0:** AI text → JSON.parse → trusted domain object without Zod.

---

## §9 Zod / schema state

| Item | Status |
|------|--------|
| `zod` in package.json | **PRESENT** (`^4.4.3`) — Phase 1 |
| AI output Zod schemas | **`src/application/ai/schemas/*`** (7 operations) |
| Operation→schema map | **`outputRegistry.ts`** |
| Enforce at runtime | **`validateAiOutput()`** (Phase 1); gateway wiring Phase 2+ |

Reusable schema candidates for Phase 1: signal eval, thesis proposal, content draft, advisor outputs, comparative result.

---

## §10 aiRuns — current vs gaps

### Current (`AIRunRecord` — `src/types/index.ts` L723–744)

| Field | EXISTS |
|-------|--------|
| id | ✓ |
| organizationId | ✓ |
| clientId | ✓ optional |
| agent | ✓ |
| provider | ✓ |
| modelName | ✓ |
| promptTemplateId | ✓ |
| inputContextSummary | ✓ |
| outputPayload | ✓ |
| rawResponse | ✓ optional |
| promptTokens | ✓ |
| completionTokens | ✓ |
| totalCostUsd | ✓ (always 0) |
| latencyMs | ✓ |
| validationPassed | ✓ (proxy-level only) |
| hallucinationCheckScore | ✓ optional (unused) |
| securityCheckPassed | ✓ |
| status | ✓ |
| errorMessage | ✓ optional |
| createdAt | ✓ |

### Gaps for SPEC-005

| Field | Status |
|-------|--------|
| operation (gateway op id) | **MISSING** |
| promptVersion | **MISSING** |
| promptHash | **MISSING** |
| schemaVersion | **MISSING** |
| validationStatus (VALID/REPAIR/REJECT) | **PARTIAL** (boolean only) |
| repairCount | **MISSING** |
| errorClass | **MISSING** |
| estimatedCost (real) | **MISSING** |
| userId / role | **MISSING** |
| providerRequestId | **MISSING** |

SPEC-009 envelope: `organizationId` + `clientId` on Firestore path — **compatible** (`sync.ts`, rules L644).

---

## §11 Retry / timeout

| Call | Timeout | Retry | 429 | 5xx |
|------|---------|-------|-----|-----|
| OpenAI/Claude fetch | **none** | none | none | none |
| Tavily | none | none | none | none |
| RSS ingest | 15s | none | — | — |
| CF rate limits | yes | n/a | implicit | n/a |

---

## §12 Cost / usage observability

| Metric | Exists? |
|--------|---------|
| promptTokens | ✓ (provider) |
| completionTokens | ✓ |
| totalCostUsd | field exists, **always 0** |
| latencyMs | ✓ |
| monthly quota | `entitlements.assertAiQuota` |
| per-operation breakdown | partial (aiRuns) |
| error count aggregate | no |

---

## §13 Secret / env names (values NEVER logged)

| Variable | Where referenced | Classification |
|----------|------------------|----------------|
| `OPENAI_API_KEY` | `functions/src/index.ts` | SERVER_SECRET (unused) |
| `TAVILY_API_KEY` | vite.config, CF, server | SERVER_SECRET |
| `YOUTUBE_API_KEY` | .env.example, CF, server | SERVER_SECRET |
| `ANTHROPIC_API_KEY` | docs only | **UNUSED** in code |
| `AI_MODEL_OPENAI_*` | docs only | UNUSED |
| `VITE_POSTURA_FUNCTIONS_BASE` | client CF routing | config (not secret) |
| Session `openai`/`claude` keys | browser → dev server | **CLIENT_EXPOSED** (dev) |

---

## §14 Tenant / auth context

| Path | organizationId | clientId | Source | Validated? |
|------|----------------|----------|--------|------------|
| ai.ts LLM flows | passed to recordAiRun | optional | caller / domain object | **caller-provided** |
| postura-api proxy | none | none | n/a | n/a |
| aiComplete stub | token available | token | auth | not used |
| tavilySearch CF | uid only | n/a | Firebase Auth | ADMIN gate |
| Firestore aiRuns write | envelope fields | envelope | sync layer | SPEC-009 rules |

**P0 flag:** Gateway must not trust request-body `organizationId` without matching auth claims.

---

## §15 Domain dependency map

| Domain | AI service | Input | Output | Persistence |
|--------|------------|-------|--------|-------------|
| Signal analysis | analyzeSignalAgainstThesis | signal + thesis | angle, action | signal fields |
| Thesis generation | generateThesisProposal | profile context | thesis draft | theses |
| Thesis challenge | challengeThesis | thesis | recommendations | UI only |
| Content | generateContentDraft | task/content ctx | title, body | contents |
| Advisor | generatePositioningAdvice, proposeAngle | client profile | advice JSON | advices |
| Comparative | runComparativeAnalysis | signal + thesis | dual outputs | UI |
| Research | researchSignalsAgent | signals | summaries | signals |
| Topics | topicAgent | profile | ranked topics | curation |
| Sources | sourceDiscoveryAgent | profile | recommendations | sources (local) |

---

## §16–§17 See `data-flow.md` and `plan.md`

---

## §18 Gateway contract (proposed)

```typescript
// Conceptual — derive final types in Phase 1 from these operations
type AiOperation =
  | 'signal.thesisEval'
  | 'thesis.generate'
  | 'thesis.challenge'
  | 'content.draft'
  | 'advisor.positioning'
  | 'advisor.curationAngle'
  | 'analysis.comparative';

interface TenantContext {
  organizationId: string;
  clientId?: string | null;
  userId: string;
  role: 'ADMIN' | 'CLIENT';
}

interface AiExecuteRequest<TInput> {
  operation: AiOperation;
  tenant: TenantContext; // from auth — gateway overwrites body
  input: TInput;
  promptVersion?: string; // default from registry
}

interface AiExecuteResult<TOutput> {
  output: TOutput; // schema-validated only
  validationStatus: 'VALID' | 'REPAIR_REQUIRED' | 'REJECTED';
  repairCount: number;
  metadata: {
    provider: string;
    modelId: string;
    promptId: string;
    promptVersion: string;
    schemaVersion: string;
    promptTokens: number;
    completionTokens: number;
    latencyMs: number;
    estimatedCostUsd?: number;
  };
  auditRunId: string;
}
```

Callers must **not** pass raw provider model IDs in production.

---

## §19 ModelRegistry (proposed)

| Logical role | Maps to (initial) | Notes |
|--------------|-------------------|-------|
| `FAST_JSON` | gpt-4o-mini / haiku | default strategist + content |
| `DEEP_JSON` | gpt-4o / sonnet | optional upgrade |
| `COMPARATIVE_OPENAI` | gpt-4o-mini | comparative path |
| `COMPARATIVE_CLAUDE` | claude-3-5-haiku | comparative path |

Registry fields: `role`, `provider`, `providerModelId`, `enabled`, `fallbackRole?`, `maxTokens`, `temperature`, `supportsJsonMode`.

Environment override via config — not hardcoded in `ai.ts`.

---

## §20 Validation / repair policy (proposed)

```text
RAW provider text
  → parse JSON (fail → REJECTED)
  → Zod schema safeParse
       VALID → return
       INVALID → if repairAttempts < MAX (default 1):
                    repair prompt with errors → re-validate
                 else REJECTED
```

Software persists **only** `VALID` outputs to domain. `REPAIR_REQUIRED` logged in aiRuns.

---

## §21 Prompt versioning (proposed)

Each operation registers:

- `promptId` (stable)
- `promptVersion` (semver or integer)
- `promptHash` (sha256 of template body — optional audit)

Store in aiRuns; full prompt text optional (size/cost).

---

## §22 aiRuns gap matrix

See §10 above.

---

## §23 Test inventory

| Area | Files | Gap |
|------|-------|-----|
| Topic agent | `topicAgent.test.ts` | no LLM |
| Research agent | `researchSignalsAgent.test.ts` | mocked Tavily |
| Tavily mapping | `tavilyDiscovery.test.ts` | no gateway |
| aiRuns rules | `firestore.rules.test.ts` | ACL only |
| Actor persistence | `actorAwarePersistence.q2.test.ts` | CLIENT cannot write aiRuns |
| **ai.ts / gateway** | **NONE** | **critical gap** |
| Provider integration | **NONE** | mock needed |
| Schema validation | **NONE** | Zod tests needed |

---

## §24 Risk table

| ID | Risk | Sev | Evidence |
|----|------|-----|----------|
| R-005-01 | Browser API keys | P0 | CS-012 |
| R-005-02 | Prod LLM 501 | P0 | CS-005 |
| R-005-03 | Unvalidated JSON → domain | P0 | §8 |
| R-005-04 | Caller-provided tenant in aiRuns | P0 | §14 |
| R-005-05 | Hardcoded models | P1 | §3 |
| R-005-06 | No LLM timeout | P1 | §11 |
| R-005-07 | No retry | P1 | §11 |
| R-005-08 | Partial aiRuns | P1 | CS-008, CS-010 |
| R-005-09 | Zero cost | P1 | §12 |
| R-005-10 | Duplicate prompts | P2 | §7 |
| R-005-11 | Anthropic no prod secret | P1 | §2 |

---

## §25 Migration strategy (strangler)

**Order** (from call graph + risk):

1. Phase 1–3: Gateway + schemas + adapters (no caller migration)
2. Phase 4: aiRuns schema extension + observability
3. Phase 5a: `aiComplete` CF — wire OpenAI + Anthropic secrets
4. Phase 5b: Migrate `generateContentDraft` (isolated, clear schema)
5. Phase 5c: Migrate thesis proposal + signal eval
6. Phase 5d: Migrate advisor flows
7. Phase 5e: Comparative + challenge + remove session key UI
8. Phase 6: Remove dev proxy LLM paths / deprecate `AIService.complete` direct fetch

Each step: feature flag or env gate; keep heuristic fallbacks.

---

## §26 Requirements list

AI-005-001 through AI-005-024 — see `spec.md`.

---

## §27 Acceptance criteria

See `acceptance.md` (A1–A24).

---

## §28 Phase plan

See `plan.md` and `tasks.md`.
