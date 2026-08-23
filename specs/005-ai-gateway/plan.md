# Plan 005 — AI Gateway

| Field | Value |
|-------|--------|
| **Spec** | `005-ai-gateway` |
| **Phase** | **2 DONE** · Phase 3 NOT STARTED |
| **Branch** | `spec/005-ai-gateway` @ `04e65ff` |

---

## Phase 0 — Inventory + architecture freeze ✅

**Deliverables:** `spec.md`, `inventory.md`, `plan.md`, `tasks.md`, `acceptance.md`, `data-flow.md`

**Gate:** Human review → `APPROVED`

**Stop:** No implementation code.

---

## Target architecture (minimal)

```text
┌─────────────────────────────────────────────────────────┐
│  Client (browser)                                        │
│  GatewayClient.execute(operation, input)                 │
│  — no provider keys, no model IDs, no raw prompts        │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS + Firebase Auth
                            ▼
┌─────────────────────────────────────────────────────────┐
│  AiGateway (Cloud Function / server)                     │
│  ├─ Auth + tenant from claims (SPEC-009)                 │
│  ├─ OperationRegistry → handler                          │
│  ├─ PromptRegistry → promptId/version/body               │
│  ├─ ModelRegistry → ProviderAdapter                      │
│  ├─ ProviderAdapter (OpenAI | Anthropic)                 │
│  ├─ SchemaValidator (Zod) + RepairPolicy                 │
│  └─ AiRunWriter → Firestore aiRuns                       │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
                   Validated AiResult<T>
```

**Not building:** generic plugin framework, multi-cloud orchestration, prompt CMS, billing product.

---

## Implementation phases

### Phase 1 — Contracts + runtime schemas ✅

**Deliverables:** `src/domain/ai/*`, `src/application/ai/*`, `tests/aiGatewayPhase1.test.ts`, `zod` dependency

**Gate:** Operation schemas + validation pipeline unit tests PASS

**Stop:** No provider adapters; no caller migration.

**Frozen decisions:**
- Operations: `CONTENT_DRAFT`, `THESIS_PROPOSAL`, `SIGNAL_THESIS_EVAL`, `THESIS_CHALLENGE`, `ADVISOR_POSITIONING`, `ADVISOR_CURATION_ANGLE`, `ANALYSIS_COMPARATIVE`
- `MAX_REPAIR_ATTEMPTS = 1`
- Validation states: `RAW`, `VALID`, `REPAIR_REQUIRED`, `REJECTED`
- Model roles: `FAST_STRUCTURED`, `DEEP_REASONING`, `CREATIVE_WRITING`
- Strict Zod schemas; extra fields rejected

---

### Phase 1H — Hexagonal boundary alignment ✅

**Deliverables:** layer split per `hexagonal-boundaries.md`, inbound/outbound ports, `tests/aiGatewayArchitecture.test.ts`, constitution §22A–22B

**Gate:** Architecture import tests PASS; Phase 1 functional tests unchanged

**Stop:** No live provider adapters; no interface migration; no composition prod wiring

**Layer layout:**

```text
src/domain/ai/              — pure concepts (no Zod, no Firebase)
src/application/ai/
  contracts/                — AiGatewayRequest/Result, trust markers
  schemas/                  — 7 strict Zod output schemas + registry
  validation/               — parse, validate, repair pipeline
  ports/inbound/            — AiGatewayPort
  ports/outbound/           — AiProvider, ModelRegistry, PromptRegistry, AiRunRepository
  use-cases/                — UnimplementedAiGateway (stub)
src/composition/ai/         — testGatewayComposition (deterministic)
src/interfaces/ai/        — documented; Phase 2+ HTTP/CF adapters
src/infrastructure/ai/    — documented; Phase 2+ adapters only
```

---

### Phase 1 — Contracts + runtime schemas (reference)

- Add `zod` dependency
- Define `AiOperation` enum + per-operation input/output Zod schemas
- Define `AiGateway` interface + error taxonomy
- Unit tests with fixtures (no live API)

**Gate:** All operation schemas tested; no provider calls.

**Stop:** Do not deploy Functions.

### Phase 2 — Provider adapters + ModelRegistry ✅

- `OpenAiAdapter`, `AnthropicAdapter` (fetch + timeout; no SDK)
- `ModelRegistryAdapter`, `PromptRegistryAdapter`
- `ExecuteAiOperation` + `serverGatewayComposition`
- `aiComplete` Cloud Function wired (not deployed)
- `FakeAiProviderPort` for deterministic tests

**Gate:** Adapter unit tests pass; secrets not in repo; browser bundle isolation verified.

**Stop respected:** No browser call-site migration; no production deploy.

### Phase 3 — Validation + repair + resilience ✅

- Bounded provider retry (`MAX_PROVIDER_RETRIES=1`) in Application layer
- Structured-output repair execution (`ai_output_repair@1`, `MAX_REPAIR_ATTEMPTS=1`)
- Global provider-call ceiling (`MAX_PROVIDER_CALLS_PER_EXECUTION=4`)
- Retry vs repair separation + resilience metadata on results
- Deterministic tests: `tests/aiGatewayPhase3.test.ts` (30 cases)

**Gate:** Retry/repair/budget paths tested with fake provider; architecture tests unchanged.

**Stop respected:** No aiRuns persistence; no browser migration; no production deploy.

### Phase 3C — Contract verification ✅

- Repair `promptHash` hashes canonical template (`REPAIR_USER_TEMPLATE_CANONICAL`), not runtime values
- `MAX_GATEWAY_EXECUTION_MS = 270_000` (270s) with 30s margin below function timeout (300s)
- Worst-case wall clock: 4 × 60s provider + 500ms backoff ≈ 240.5s < 270s
- Retry backoff: 250ms per sequence (one sleep per `MAX_PROVIDER_RETRIES=1`)

### Phase 4 — aiRuns + observability ✅

- `AiRunPersistenceRecord` (storage-neutral application contract)
- `FirestoreAiRunRepository` at `clients/{clientId}/aiRuns/{runId}`
- Single final write after execution (success or failure)
- Fail-closed persistence: `PERSISTENCE_ERROR` if audit save fails after provider success
- `promptHash` = canonical template; `renderedPromptHash` = execution-specific SHA-256
- `costStatus = NOT_CALCULATED` (no fake `totalCostUsd: 0`)
- Gateway wired via `serverGatewayComposition` → `AiRunRepositoryPort`

**Gate:** `tests/aiGatewayPhase4.test.ts` (27 tests); rules unchanged; envelope validated in adapter.

### Phase 5 — Strangler migration

Sub-phases 5a–5e (see inventory §25). Each sub-phase:

- One operation migrated
- Fallback preserved
- `npm run check` + `test:rules` green

**Gate per operation:** E2E with mock provider; no regression in UI flows.

### Phase 6 — CODE_COMPLETE verification

- Zero direct client LLM fetch in `src/`
- Session key UI removed or dev-only flag
- `aiComplete` fully implemented
- Dev proxy LLM deprecated behind `POSTURA_DEV_AI_PROXY=false` default
- Full acceptance A1–A24

**Gate:** `CODE_COMPLETE` declaration (separate task).

---

## File layout (hexagonal — Phase 1H+)

```text
src/domain/ai/                    # pure domain concepts
src/application/ai/
  contracts/
  schemas/
  validation/
  ports/inbound/
  ports/outbound/
  use-cases/
src/composition/ai/                 # dependency wiring (test only in 1H)
src/interfaces/ai/                # future HTTP/CF inbound adapters (Phase 2+)
src/infrastructure/ai/            # future provider/registry/persistence adapters (Phase 2+)

functions/src/ai/                 # Cloud Function gateway (Phase 2+)
src/services/aiGatewayClient.ts     # thin client wrapper (Phase 5+)
```

---

## Dependencies

| Spec | Relationship |
|------|--------------|
| SPEC-009 | Tenant envelope on aiRuns; auth claims; rules frozen at `9c351ef` |
| SPEC-009 prod migration | **Deferred** — do not block 005 on T-009-16 |

---

## Decision log

| Date | Decision | Status |
|------|----------|--------|
| 2026-08-23 | Phase 1: Zod schemas + gateway contracts in `src/domain/aiGateway/` | **DONE** (superseded by 1H) |
| 2026-08-23 | Phase 1H: hexagonal split → `src/domain/ai` + `src/application/ai` | **DONE** |
| 2026-08-23 | Zod required for structured outputs | **PROPOSED** |
| 2026-08-23 | Strangler migration order: content → thesis → signals → advisor | **PROPOSED** |
| 2026-08-23 | Tavily/YouTube remain separate CF endpoints | **PROPOSED** |
