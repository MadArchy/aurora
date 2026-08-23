# Acceptance 005 — AI Gateway

**Phase 0:** criteria defined only — **none marked PASS** for implementation.

Spec **DONE** requires Required PASS + production gateway deployed.

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Maps to | Phase 0 |
|---|-----------|---------|---------|
| A1 | Zero production LLM calls from browser to provider URLs | AI-005-001, AI-005-003 | ☐ |
| A2 | Zero `VITE_*` provider secrets | AI-005-002 | ☐ |
| A3 | `aiComplete` (or successor) returns validated results — not 501 | AI-005-003 | ☐ |
| A4 | Gateway requires authenticated Firebase session | AI-005-004 | ☐ |
| A5 | Tenant `organizationId` from auth claims — not unvalidated body | AI-005-005 | ☐ |
| A6 | CLIENT role cannot invoke ADMIN-only operations | AI-005-023 | ☐ |
| A7 | OpenAI adapter with server secret only | AI-005-006 | ☐ |
| A8 | Anthropic adapter with server secret only | AI-005-006 | ☐ |
| A9 | ModelRegistry resolves logical role → provider model deterministically | AI-005-007 | ☐ |
| A10 | Every run records `promptId` + `promptVersion` | AI-005-008 | ☐ |
| A11 | Every structured operation validates with Zod (or equivalent) | AI-005-009 | ✅ Phase 1 (`tests/aiGatewayPhase1.test.ts` G–L) |
| A12 | Invalid schema → REJECTED (no domain write) | AI-005-010, AI-005-019 | ☐ |
| A13 | Repair bounded (default max 1) — no infinite loop | AI-005-011 | ✅ Phase 1 (`MAX_REPAIR_ATTEMPTS=1`; test O) |
| A14 | Provider call timeout enforced | AI-005-012 | ☐ |
| A15 | Transient 429/5xx retried with cap | AI-005-013 | ☐ |
| A16 | Token counts persisted per run | AI-005-014 | ☐ |
| A17 | Latency persisted per run | AI-005-015 | ☐ |
| A18 | `aiRuns` written on success and failure | AI-005-017 | ☐ |
| A19 | aiRuns Firestore docs include SPEC-009 envelope | AI-005-022 | ☐ |
| A20 | Stable `errorClass` on failures | AI-005-018 | ✅ Phase 1 foundation (`AiGatewayErrorCode`; test P) |
| A21 | CI tests use mock provider — no paid API | AI-005-021 | ✅ Phase 1 (deterministic unit tests only) |
| A22 | Migrated operations pass schema fixture tests | AI-005-020 | ☐ |
| A23 | Domain layer free of Firebase/provider/infrastructure imports | AI-005-025 | ✅ Phase 1H (`tests/aiGatewayArchitecture.test.ts` A–D) |
| A24 | Application layer free of concrete adapter imports | AI-005-026 | ✅ Phase 1H (`tests/aiGatewayArchitecture.test.ts` E–G) |
| A25 | Inbound/outbound ports defined for gateway | AI-005-027, AI-005-028 | ✅ Phase 1H (ports under `src/application/ai/ports/`) |
| A26 | Architecture import tests pass in CI | AI-005-029 | ✅ Phase 1H (`tests/aiGatewayArchitecture.test.ts`) |
| A27 | Hexagonal migration matrix documented | AI-005-025 | ✅ `hexagonal-boundaries.md` |
| A28 | `npm run check` PASS | governance | ✅ **316/316** (305 baseline + 11 architecture tests) |
| A29 | `npm run test:rules` PASS | governance | ✅ **91/91** |

---

## Deploy gates (separate)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Functions deployed with secrets configured | ☐ |
| D2 | Production smoke: content draft via gateway | ☐ |
| D3 | Session key UI removed or dev-only | ☐ |
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
| Human approver | | ☐ APPROVED (Spec) |

**Implementation:** `IN PROGRESS` (Phase 1 + Phase 1H complete; Phase 2 not started)
