# Acceptance 005 — AI Gateway

**Phase 0:** criteria defined only — **none marked PASS** for implementation.

Spec **DONE** requires Required PASS + production gateway deployed.

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Maps to | Phase 0 |
|---|-----------|---------|---------|
| A1 | Zero production LLM calls from browser to provider URLs | AI-005-001, AI-005-003 | ✅ Phase 5D — legacy proxy + session keys removed; browser has zero direct provider URLs / X-AI-Session |
| A2 | Zero `VITE_*` provider secrets | AI-005-002 | ✅ No `VITE_OPENAI` / `VITE_ANTHROPIC`; server secrets only |
| A3 | `aiComplete` (or successor) returns validated results — not 501 | AI-005-003 | ✅ Phase 2 code (`functions/src/index.ts` wired; not deployed) |
| A4 | Gateway requires authenticated Firebase session | AI-005-004 | ✅ Phase 2 (`requirePosturaAuth` on aiComplete) |
| A5 | Tenant `organizationId` from auth claims — not unvalidated body | AI-005-005 | ✅ Phase 2 (`resolveTrustedTenantForAiComplete`; ADMIN path) |
| A6 | CLIENT role cannot invoke ADMIN-only operations | AI-005-023 | ✅ Phase 2 aiComplete (`AICOMPLETE_ADMIN_ONLY`; CLIENT gets 403) |
| A7 | OpenAI adapter with server secret only | AI-005-006 | ✅ Phase 2 (`OpenAiAdapter` + `OPENAI_API_KEY`) |
| A8 | Anthropic adapter with server secret only | AI-005-006 | ✅ Phase 2 (`AnthropicAdapter` + `ANTHROPIC_API_KEY`) |
| A9 | ModelRegistry resolves logical role → provider model deterministically | AI-005-007 | ✅ Phase 2 (`ModelRegistryAdapter` + tests) |
| A10 | Every run records `promptId` + `promptVersion` | AI-005-008 | ✅ Phase 2 (`PromptRegistryAdapter`; `promptHash` full SHA-256 64 hex) |
| A11 | Every structured operation validates with Zod (or equivalent) | AI-005-009 | ✅ Phase 1 (`tests/aiGatewayPhase1.test.ts` G–L) |
| A12 | Invalid schema → REJECTED (no domain write) | AI-005-010, AI-005-019 | ✅ Phase 3 (repair attempt; `REPAIR_FAILED` / `INVALID_OUTPUT`; no trusted write) |
| A13 | Repair bounded (default max 1) — no infinite loop | AI-005-011 | ✅ Phase 3 (`MAX_REPAIR_ATTEMPTS=1`; repair execution + test O/N) |
| A14 | Provider call timeout enforced | AI-005-012 | ✅ Phase 2 (`DEFAULT_PROVIDER_TIMEOUT_MS=60000`) |
| A15 | Transient 429/5xx retried with cap | AI-005-013 | ✅ Phase 3 (`MAX_PROVIDER_RETRIES=1`; tests A–F) |
| A16 | Token counts persisted per run | AI-005-014 | ✅ Phase 4 (nullable; no fake zeros) |
| A17 | Latency persisted per run | AI-005-015 | ✅ Phase 4 (`latencyMs` = gateway wall-clock) |
| A18 | `aiRuns` written on success and failure | AI-005-017 | ✅ Phase 4 (`ExecuteAiOperation` + `AiRunRepositoryPort`) |
| A19 | aiRuns Firestore docs include SPEC-009 envelope | AI-005-022 | ✅ Phase 4 (`organizationId` + `clientId`; Admin SDK validation) |
| A20 | Stable `errorClass` on failures | AI-005-018 | ✅ Phase 1 foundation (`AiGatewayErrorCode`; test P) |
| A21 | CI tests use mock provider — no paid API | AI-005-021 | ✅ Phase 1 (deterministic unit tests only) |
| A22 | Migrated operations pass schema fixture tests | AI-005-020 | ✅ Phase 5A–5C-MP (all 7 ops including multi-provider ANALYSIS_COMPARATIVE) |
| A23 | Domain layer free of Firebase/provider/infrastructure imports | AI-005-025 | ✅ Phase 1H (`tests/aiGatewayArchitecture.test.ts` A–D) |
| A24 | Application layer free of concrete adapter imports | AI-005-026 | ✅ Phase 1H (`tests/aiGatewayArchitecture.test.ts` E–G) |
| A25 | Inbound/outbound ports defined for gateway | AI-005-027, AI-005-028 | ✅ Phase 1H (ports under `src/application/ai/ports/`) |
| A26 | Architecture import tests pass in CI | AI-005-029 | ✅ Phase 1H (`tests/aiGatewayArchitecture.test.ts`) |
| A27 | Hexagonal migration matrix documented | AI-005-025 | ✅ `hexagonal-boundaries.md` + `migration-matrix.md` |
| A28 | `npm run check` PASS | governance | ✅ **487/487** (477 baseline + 10 Phase 5D negative security) |
| A29 | `npm run test:rules` PASS | governance | ✅ **91/91** |

---

## Deploy gates (separate)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Functions deployed with secrets configured | ☐ |
| D2 | Production smoke: content draft via gateway | ☐ |
| D3 | Session key UI removed or dev-only | ☐ (implementation: **REMOVED** Phase 5D; deploy verification pending) |
| D4 | Spec `DEPLOYED` / `DONE` | ☐ |

---

## Phase 0 evidence (documentation)

| Item | Status |
|------|--------|
| Call-site inventory | ✅ `inventory.md` §1 |
| Provider/model inventory | ✅ §2–3 |
| Client-side risk documented | ✅ §4 (P0) |
| aiRuns gap matrix | ✅ §10 |
| Risk table | ✅ §24 |
| Migration strategy | ✅ §25 |
| Target architecture | ✅ `plan.md`, `data-flow.md`, `hexagonal-boundaries.md` |

---

## Sign-off

| Role | Date | Result |
|------|------|--------|
| Phase 0 inventory | 2026-08-23 | **APPROVED** |
| Phase 1 contracts | 2026-08-23 | **DONE** |
| Phase 1H hexagonal | 2026-08-23 | **DONE** |
| Phase 2 providers | 2026-08-23 | **DONE** |
| Phase 3 resilience | 2026-08-23 | **DONE** |
| Phase 3C contracts | 2026-08-23 | **DONE** |
| Phase 4 aiRuns audit | 2026-08-23 | **DONE** |
| Phase 5A CONTENT_DRAFT | 2026-08-23 | **DONE** |
| Phase 5B thesis + signal | 2026-08-23 | **DONE** |
| Phase 5C advisor (partial) | 2026-08-23 | **DONE** (advisor migrated; comparative deferred to 5C-MP) |
| Phase 5C-MP comparative | 2026-08-23 | **DONE** — multi-provider ANALYSIS_COMPARATIVE |
| Phase 5D legacy cleanup | 2026-08-23 | **DONE** — session proxy/UI/keys removed; P0 RESOLVED |
| T-005-70 human sign-off | 2026-08-23 | **APPROVED** — implementation **CODE_COMPLETE** |
| Human approver (Spec) | 2026-08-23 | **APPROVED** |

**Implementation:** **`CODE_COMPLETE`** (A1–A29 PASS). **Deployment:** NOT STARTED (D1–D4 PENDING). **SPEC DONE:** NO.

---

## T-005-70 HUMAN SIGN-OFF PACKAGE

**Prepared:** 2026-08-23  
**Implementation checkpoint SHA:** `7ae45dde43e7ddcf6ed8d12b7f38625956d85489`  
**Branch:** `spec/005-ai-gateway`  
**Human decision:** **APPROVED** (explicit authorization in development workflow, 2026-08-23)

### Task definition (T-005-70)

From `tasks.md` Phase 6:

> **T-005-70** Final verification + acceptance sign-off (human)  
> Deploy gates D1–D4 remain separate from CODE_COMPLETE

This task required a human reviewer to confirm that implementation acceptance A1–A29 are satisfied with evidence, and to authorize the `CODE_COMPLETE` governance state. **Human approval received 2026-08-23.**

### Implementation acceptance summary

| Range | Count | Status |
|-------|-------|--------|
| A1–A29 | 29/29 | **PASS** (automated + documented evidence) |
| Pending implementation acceptance | 0 | — |

See §Required table above for per-criterion evidence. No criterion marked PASS without current file verification at checkpoint `7ae45dd`.

### Security summary

| Control | Status | Evidence |
|---------|--------|----------|
| Browser provider keys | **0** | `tests/aiGatewayPhase5d.test.ts` B/C; `src/services/ai.ts` |
| Session-key LLM consumers | **0** | Phase 5D removal; migration matrix |
| X-AI-Session executable refs | **0** | Phase 5D test A; static scan |
| Direct browser provider calls | **0** | Phase 5D tests E/F |
| Legacy `/api/ai/complete` proxy | **REMOVED** | `server/postura-api.ts`; Phase 5D test |
| Server secrets server-only | **YES** | `providerSecrets.ts`; adapters; no `VITE_*` |
| Tenant auth-derived | **YES** | `resolveTrustedTenantForAiComplete`; A5 |
| aiComplete ADMIN_ONLY | **YES** | `AICOMPLETE_ADMIN_ONLY`; A6 |
| No raw secrets in aiRuns | **YES** | `AiRunRepositoryPort`; inventory §10 |

### Architecture summary

| Layer | Status | Evidence |
|-------|--------|----------|
| Hexagonal boundaries | **PASS** | `tests/aiGatewayArchitecture.test.ts` (12/12) |
| Domain purity (no Firebase/provider) | **PASS** | Architecture tests A–D |
| Application ports only (no concrete adapters) | **PASS** | Architecture tests E–G |
| Browser → AiCompleteHttpClient → Gateway | **PASS** | `migration-matrix.md`; gateway services |
| PromptRegistry | **PASS** | `PromptRegistryAdapter`; A10 |
| ModelRegistry | **PASS** | `ModelRegistryAdapter`; A9 |
| AiRunRepositoryPort | **PASS** | Phase 4 tests; A18–A19 |
| Comparative multi-provider | **PASS** | Phase 5C-MP tests; `executionMode: COMPARATIVE` |

### Operation migration summary (7/7)

| Operation | Gateway | Browser key | Direct fallback | Zod validation | aiRun |
|-----------|---------|-------------|-----------------|------------------|-------|
| CONTENT_DRAFT | YES | NO | NONE | YES | YES |
| THESIS_PROPOSAL | YES | NO | NONE | YES | YES |
| SIGNAL_THESIS_EVAL | YES | NO | NONE | YES | YES |
| THESIS_CHALLENGE | YES | NO | NONE | YES | YES |
| ADVISOR_POSITIONING | YES | NO | NONE | YES | YES |
| ADVISOR_CURATION_ANGLE | YES | NO | NONE | YES | YES |
| ANALYSIS_COMPARATIVE | YES | NO | NONE | YES | YES (COMPARATIVE) |

### P0 closure summary

| Artifact | Disposition |
|----------|-------------|
| `runAgentJson` | REMOVED |
| `complete()` legacy | REMOVED |
| X-AI-Session | REMOVED (0 executable) |
| `/api/ai/complete` | REMOVED |
| Manager session-key UI | REMOVED |
| Browser provider credentials | 0 |
| LEGACY AI P0 | **RESOLVED** |

### Resilience / validation (frozen policy)

| Policy | Value | Evidence |
|--------|-------|----------|
| MAX_REPAIR_ATTEMPTS | 1 | `src/domain/ai/constants.ts`; Phase 3 tests |
| MAX_PROVIDER_RETRIES | 1 | constants; Phase 3 tests |
| MAX_PROVIDER_CALLS_PER_EXECUTION | 4 | constants; providerCallBudget |
| MAX_GATEWAY_EXECUTION_MS | 270_000 | constants (300s − 30s margin) |
| AI_COMPLETE_FUNCTION_TIMEOUT_SECONDS | 300 | constants |
| Comparative slices | 2 (OpenAI + Anthropic) | Phase 5C-MP |
| MAX calls per slice | 4 | constants |
| MAX comparative calls | 8 | constants |
| Cross-provider fallback | **NONE** | Phase 5C-MP tests |

### Human governance (constitution)

| Flow | AI role | Software/human gate |
|------|---------|---------------------|
| THESIS_PROPOSAL | Suggests proposal | Does not activate/approve thesis; `thesisProposalCore` / rules govern |
| THESIS_CHALLENGE | Suggests challenge | Does not silently approve; revision requires explicit client approval (`approveThesisByClient`) |
| SIGNAL_THESIS_EVAL | Advisory eval | Deterministic routing/scoring governs; AI output validated, not trusted blindly |
| Advisor outputs | Advisory | No domain write without software validation |

**Rule:** AI SUGGESTS · SOFTWARE GOVERNS · HUMAN APPROVES WHERE REQUIRED.

### Known deferred items (non-blocking for CODE_COMPLETE)

| Item | Status | Notes |
|------|--------|-------|
| Cost accounting (`totalCostUsd`) | **DEFERRED** | `costStatus: NOT_CALCULATED`; no fake zero semantics (plan.md Phase 4) |
| Production deploy (D1–D4) | **PENDING** | Separate from CODE_COMPLETE |
| Gemini provider | **OUT OF SCOPE** | tasks.md explicit exclusion |

Cost accounting is **not** a required pre-CODE_COMPLETE acceptance criterion (A16 requires nullable token counts, not priced totals).

### Deployment gates (separate — not CODE_COMPLETE blockers)

| Gate | Status | Notes |
|------|--------|-------|
| D1 | ☐ PENDING | Functions deployed with secrets |
| D2 | ☐ PENDING | Production smoke: content draft via gateway |
| D3 | ☐ PENDING | Session-key UI removed (**implementation done** Phase 5D) |
| D4 | ☐ PENDING | Spec DEPLOYED / DONE |

### Automated verification at checkpoint

| Command | Result |
|---------|--------|
| `npm run check` | **487/487 PASS** |
| `npm run test:rules` | **91/91 PASS** |
| `npm --prefix functions run build` | **PASS** |
| Architecture tests | **12/12 PASS** (within `npm run check`) |
| Static legacy scan | **PASS** (`tests/aiGatewayPhase5d.test.ts`) |

### Human decision field

| Field | Value |
|-------|-------|
| Approval source | Explicit human authorization (development workflow) |
| Date | 2026-08-23 |
| T-005-70 | **DONE — APPROVED** |
| CODE_COMPLETE authorized | **YES** |
| SPEC-005 DEPLOYED | **NO** |
| SPEC-005 DONE | **NO** |

### CODE_COMPLETE evidence (frozen at implementation checkpoint `7ae45dd`)

| Evidence | Status |
|----------|--------|
| 7/7 AiOperations routed through Gateway | YES |
| Browser provider/session-key execution removed | YES |
| `runAgentJson` consumers | 0 |
| `complete()` LLM consumers | 0 |
| X-AI-Session executable references | 0 |
| Browser direct-provider consumers | 0 |
| Legacy provider proxy | REMOVED |
| Manager session-key UI | REMOVED |
| Structured Zod validation | YES |
| Bounded retry/repair | YES |
| Provider-preserving Comparative repair | YES |
| OpenAI + Anthropic Comparative semantics | PRESERVED |
| aiRuns audit | ENABLED |
| Tenant auth-derived | YES |
| aiComplete ADMIN_ONLY | YES |
| LEGACY AI P0 | RESOLVED |
| Human sign-off T-005-70 | APPROVED |
| Cost accounting | DEFERRED (`costStatus: NOT_CALCULATED`) |

## aiComplete authorization (Phase 2)

| Policy | Value |
|--------|-------|
| Endpoint | `AICOMPLETE_ADMIN_ONLY` |
| Enforcement | `requirePosturaAuth({ adminOnly: true })` on `aiComplete` |
| CLIENT via aiComplete | **Not reachable** — blocked at auth before tenant resolution |
| Tenant resolution | ADMIN path uses auth-derived `organizationId`; `clientId` from body for scoped ops |
