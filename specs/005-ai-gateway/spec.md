# Spec 005 — AI Gateway

| Field | Value |
|-------|--------|
| **Spec ID** | `005-ai-gateway` |
| **Status** | **`APPROVED`** · Phase 5 COMPLETE · implementation gates A1–A29 PASS · deploy gates D1–D4 pending · **CODE_COMPLETE eligible** (human T-005-70) |
| **Branch** | `spec/005-ai-gateway` |
| **Baseline SHA** | `04e65ff556899bf2f2f8d138880b05df21a34c5d` |
| **Frozen SPEC-009 implementation SHA** | `9c351ef7ac6fafdbce8ff8b8eb5a5678e2ceae99` (reference only; do not modify) |
| **Priority** | P0 — **RESOLVED** (browser provider execution path eliminated Phase 5D) |
| **Constitution** | §AI Governance — **AI SUGGESTS. SOFTWARE GOVERNS.** |
| **Depends on** | SPEC-009 tenant isolation (`organizationId` / `clientId` envelope) |
| **Blocks** | Production deploy of gateway (D1–D4); not browser LLM security |
| **Inventory** | `specs/005-ai-gateway/inventory.md` |
| **Node** | `v24.7.0` |
| **npm** | `11.5.1` |
| **Firebase CLI** | `15.14.0` |
| **Test baseline** | `npm run check` → **487/487 PASS** (Phase 5D); `npm run test:rules` → **91/91 PASS** |

---

## Constitutional principle

No AI response becomes a trusted domain object merely through `JSON.parse()`, TypeScript casting, or prompt instructions.

Gateway responsibilities:

- server-only provider credentials in production;
- tenant context derived from authenticated session (SPEC-009);
- model routing via registry (logical role → provider model);
- prompt identity + version on every run;
- runtime schema validation (Zod or equivalent);
- bounded repair or reject;
- timeouts, retries, error taxonomy;
- usage / latency / cost metadata;
- durable `aiRuns` audit trail.

---

## Problem

POSTURA has **partial** AI architecture:

1. **Production LLM path broken** — Cloud Function `aiComplete` returns **501**; browser calls `/api/ai/*` which exists only on Vite dev middleware.
2. **~~Dev-only provider proxy~~** — **REMOVED Phase 5D.** Historical: OpenAI + Anthropic keys entered browser UI → in-memory session on local server.
3. **Unvalidated structured output** — seven LLM flows parse JSON without runtime schema; field fallbacks mask invalid output.
4. **No Zod / no provider SDK** — raw `fetch` only; no shared validation layer.
5. **Inconsistent observability** — `aiRuns` written on some paths only; `totalCostUsd` always `0`.
6. **Hardcoded models** — `gpt-4o-mini`, `claude-3-5-haiku-20241022` in `src/services/ai.ts` and proxy allowlists.
7. **No timeouts/retries** on LLM `fetch`.
8. **Docs vs code gap** — Fase 10 spec describes full AI Router; **not implemented**.

Non-LLM intelligence (Tavily, YouTube) is **ACTIVE** server-side via Cloud Functions — out of gateway scope except shared auth/tenant patterns.

---

## Goal

Centralized **server-side**, **provider-agnostic** AI Gateway that:

- replaces direct browser → provider paths in production;
- validates all structured AI output before domain persistence;
- records auditable `aiRuns` with prompt/model/schema metadata;
- inherits SPEC-009 tenant envelope on every write;
- migrates existing call sites incrementally (strangler).

---

## Non-Goals (this Spec)

- React migration (`010`)
- Brief / domain model redesign
- Gemini / new providers unless added in implementation phases with inventory update
- External pricing research or billing productization
- SPEC-009 production migration/deploy (deferred)
- Replacing heuristic agents (Topic, Source Discovery) with LLM unless separately authorized
- Claim Safety Engine LLM upgrade (remains rule-based)

---

## Requirements (proposed — Phase 0 freeze)

See `inventory.md` §Requirements and `acceptance.md` for IDs **AI-005-001..029**.

Summary:

| ID | Requirement |
|----|-------------|
| AI-005-001 | Production LLM execution is server-only |
| AI-005-002 | No provider secret in browser bundle or `VITE_*` |
| AI-005-003 | Gateway is sole production entry for LLM calls |
| AI-005-004 | Tenant context required (`organizationId`; `clientId` when CLIENT-scoped) |
| AI-005-005 | Tenant context from auth claims — not unvalidated request body |
| AI-005-006 | Provider adapter interface (OpenAI, Anthropic minimum) |
| AI-005-007 | ModelRegistry: logical role → provider model ID |
| AI-005-008 | PromptRegistry: `promptId` + `promptVersion` (+ optional hash) per run |
| AI-005-009 | Runtime output schema validation per operation |
| AI-005-010 | Validation states: VALID / REPAIR_REQUIRED / REJECTED |
| AI-005-011 | Bounded repair (max attempts configurable; default 1) |
| AI-005-012 | Request timeout on every provider call |
| AI-005-013 | Retry policy for transient provider errors (429, 5xx) with cap |
| AI-005-014 | Token usage captured from provider responses |
| AI-005-015 | Latency captured per execution |
| AI-005-016 | Cost field reserved; estimation optional Phase 4+ |
| AI-005-017 | `aiRuns` written for every gateway execution |
| AI-005-018 | Error taxonomy mapped to stable `errorClass` |
| AI-005-019 | No unvalidated gateway output persisted to domain collections |
| AI-005-020 | Strangler migration — existing operations keep working per phase |
| AI-005-021 | Deterministic tests via mock provider — no paid API in CI |
| AI-005-022 | SPEC-009 envelope on `aiRuns` Firestore writes |
| AI-005-023 | Admin-only gateway invocation unless operation explicitly CLIENT-safe |
| AI-005-024 | Raw provider response retained in audit field, not trusted for domain |
| AI-005-025 | Domain layer (`src/domain/ai`) has no Firebase, provider SDK, or infrastructure imports |
| AI-005-026 | Application layer (`src/application/ai`) has no concrete provider or persistence adapter imports |
| AI-005-027 | Outbound ports defined for provider, model registry, prompt registry, and aiRun persistence |
| AI-005-028 | Inbound port (`AiGatewayPort`) exposes gateway capability without transport-specific parameters |
| AI-005-029 | Architecture tests enforce hexagonal import boundaries deterministically |

---

## Lifecycle

| State | Meaning |
|-------|---------|
| `DRAFT` | Spec authoring |
| `READY_FOR_HUMAN_APPROVAL` | Phase 0 inventory + docs complete |
| `APPROVED` | Human authorizes implementation |
| `IMPLEMENTING` | Phases 1–5 in progress |
| `CODE_COMPLETE` | Gateway + migrations + tests green in repo |
| `DEPLOYED` | Functions deployed; production callers on gateway |
| `DONE` | Acceptance + deploy verification |

**Implementation:** `IN PROGRESS` (Phase 1 + Phase 1H complete)

---

## Risks (summary)

| ID | Risk | Severity |
|----|------|----------|
| R-005-01 | Browser-supplied API keys (dev path) | P0 |
| R-005-02 | Production LLM unavailable (501 stub) | P0 |
| R-005-03 | Unvalidated JSON → domain objects | P0 |
| R-005-04 | Missing tenant on server AI (when implemented) | P0 |
| R-005-05 | Hardcoded stale models | P1 |
| R-005-06 | No timeout on provider fetch | P1 |
| R-005-07 | No retry policy | P1 |
| R-005-08 | Partial `aiRuns` coverage | P1 |
| R-005-09 | `totalCostUsd` always zero | P1 |
| R-005-10 | Duplicated inline prompts | P2 |

Full table: `inventory.md` §24.

---

## References

- `docs/audits/BASELINE_CONSTITUTION_AUDIT.md` — AI Gateway PARTIAL
- `docs/spec/Postura_Fase_10_Documento_10_Arquitectura_IA_Agentes_AI_Router.md` — target doc (aspirational)
- SPEC-009 `acceptance.md` — defers `aiComplete` / Secret Manager to 005
