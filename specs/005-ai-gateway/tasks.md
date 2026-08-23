# Tasks 005 — AI Gateway

**Spec status:** `APPROVED`  
**Implementation:** `IN PROGRESS` (Phase 3 complete; Phase 4 not started)  
**Branch:** `spec/005-ai-gateway` @ `04e65ff` + Phase 1 commits

---

## Phase 0 — Inventory + freeze

- [x] **T-005-00** Baseline verification (git, Node, npm, Firebase CLI, check, test:rules)
- [x] **T-005-01** Complete AI call-site inventory (§inventory CS-001..015)
- [x] **T-005-02** Provider + model inventory
- [x] **T-005-03** Client-side AI security audit
- [x] **T-005-04** Server entry points (`aiComplete`, CF exports)
- [x] **T-005-05** Agent/service inventory
- [x] **T-005-06** Prompt inventory
- [x] **T-005-07** Structured output / parsing risk inventory
- [x] **T-005-08** Zod/schema state
- [x] **T-005-09** aiRuns current + gap analysis
- [x] **T-005-10** Retry/timeout/cost observability inventory
- [x] **T-005-11** Secret/env name inventory
- [x] **T-005-12** Tenant/auth context inventory
- [x] **T-005-13** Domain dependency map + data flow doc
- [x] **T-005-14** Target architecture + gateway contract proposal
- [x] **T-005-15** ModelRegistry + validation/repair + prompt versioning design
- [x] **T-005-16** Risk table + migration strategy
- [x] **T-005-17** Requirements AI-005-001..029 + acceptance A1–A29
- [x] **T-005-18** Phase 1–6 plan + governance docs created
- [x] **T-005-19** Post-doc verification: check + test:rules baseline

**Phase 0 gate:** Human approval → Spec `APPROVED`

---

## Phase 1 — Contracts + schemas ✅

- [x] **T-005-20** Add `zod` (^4.4.3); define operation schemas in `src/application/ai/schemas/`
- [x] **T-005-21** Define `AiGatewayPort` + error types + request/result contracts
- [x] **T-005-22** Schema fixture tests — `tests/aiGatewayPhase1.test.ts` (19 tests)

**Stop respected:** No Functions deploy; no provider adapters; no caller migration.

---

## Phase 1H — Hexagonal boundaries ✅

- [x] **T-005-23** Inventory + migration matrix — `hexagonal-boundaries.md`
- [x] **T-005-24** Split domain (`src/domain/ai`) from application (`src/application/ai`)
- [x] **T-005-25** Define inbound port `AiGatewayPort` + outbound ports (provider, registry, persistence)
- [x] **T-005-26** Move Zod schemas + validation pipeline to application boundary
- [x] **T-005-27** Add architecture boundary tests — `tests/aiGatewayArchitecture.test.ts`
- [x] **T-005-28** Update constitution §22A–22B (hexagonal + domain purity)
- [x] **T-005-29** Test composition root — `src/composition/ai/testGatewayComposition.ts`

**Stop respected:** No live adapters; no `aiComplete` migration; no Firestore aiRuns implementation.

---

## Phase 2 — Adapters + ModelRegistry ✅

- [x] **T-005-30** OpenAI adapter + timeout
- [x] **T-005-31** Anthropic adapter + CF secret
- [x] **T-005-32** ModelRegistry config
- [x] **T-005-33** Mock provider for tests
- [x] **T-005-34** Replace `UnimplementedAiGateway` with `ExecuteAiOperation` in server composition (`UnimplementedAiGateway` retained for test composition only)

---

## Phase 2C — Contract verification + checkpoint ✅

- [x] **T-005-35** Fix `promptHash` to full 64-char SHA-256 (Phase-1 contract)
- [x] **T-005-36** Document `AICOMPLETE_ADMIN_ONLY` policy + tests
- [x] **T-005-37** Document OpenAI-only production registry routing; Anthropic adapter tested separately

**Stop respected:** No browser call-site migration; no production deploy; no Firestore aiRuns.

---

## Phase 3 — Validation + repair + resilience ✅

- [x] **T-005-40** SchemaValidator + bounded repair execution (`ExecuteAiOperation` + `ai_output_repair@1`)
- [x] **T-005-41** Bounded provider retry policy (`MAX_PROVIDER_RETRIES=1`, Application layer)
- [x] **T-005-42** Error taxonomy separation (retry vs repair vs reject; `tests/aiGatewayPhase3.test.ts`)

## Phase 3C — Contract verification + checkpoint ✅

- [x] **T-005-43** Repair promptHash = canonical template hash (not rendered execution)
- [x] **T-005-44** Global gateway execution deadline (`MAX_GATEWAY_EXECUTION_MS`)
- [x] **T-005-45** aiComplete function timeout compatibility (`AI_COMPLETE_FUNCTION_TIMEOUT_SECONDS=300`)

**Frozen Phase-3 policy:**
- `MAX_PROVIDER_RETRIES = 1` (one optional retry after initial attempt)
- `MAX_REPAIR_ATTEMPTS = 1` (unchanged from Phase 1)
- `MAX_PROVIDER_CALLS_PER_EXECUTION = 4` (2 primary + 2 repair worst-case)
- `MAX_GATEWAY_EXECUTION_MS = 270_000` (30s margin below function timeout)
- `AI_COMPLETE_FUNCTION_TIMEOUT_SECONDS = 300` (aiComplete code config)
- Repair `promptHash` = SHA-256 of canonical template (`ai_output_repair@1`)
- Repair model role: `FAST_STRUCTURED` (same provider registry routing)
- Retry location: Application (`providerRetryPolicy.ts`), adapters remain single-attempt

---

## Phase 4 — aiRuns observability ✅

- [x] **T-005-50** Extend AIRunRecord / Firestore writer
- [x] **T-005-51** Gateway aiRuns on all paths
- [x] **T-005-52** Rules/tests for new fields (no rules change required; envelope tests + Phase 4 unit tests)

---

## Phase 5 — Migration (IN PROGRESS)

- [x] **T-005-60** Implement `aiComplete` gateway browser client (`AiCompleteHttpClient`)
- [x] **T-005-61** Migrate `content.draft` / `CONTENT_DRAFT` (`generateContentDraft`)
- [x] **T-005-62** Migrate thesis + signal eval (`THESIS_PROPOSAL`, `SIGNAL_THESIS_EVAL`)
- [x] **T-005-63** Migrate advisor flows (`ADVISOR_POSITIONING`, `ADVISOR_CURATION_ANGLE` — 5C partial)
- [x] **T-005-64** Migrate thesis challenge (`THESIS_CHALLENGE`; comparative remains blocked)
- [ ] **T-005-65** Remove prod session-key path

---

## Phase 6 — CODE_COMPLETE (NOT STARTED)

- [ ] **T-005-70** Final verification + acceptance sign-off

---

## Explicitly out of scope (this Spec branch)

- SPEC-009 T-009-16+ production migration
- Firestore/Storage rules changes (unless aiRuns schema requires — Phase 4 only)
- React migration
- Gemini provider
