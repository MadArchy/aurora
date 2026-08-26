# Acceptance 007 — Opportunity Scout

**Phase 0:** Formal package **COMPLETE** · Human SPEC approval **APPROVED** (T-007-010)  
**Phase 1:** Domain **COMPLETE** (T-007-101…110)  
**SPEC-007 IMPLEMENTATION:** Phase 1 **COMPLETE** · Phase 2+ **NOT_AUTHORIZED**  
**CODE_COMPLETE CANDIDATE:** **NO**  
**DEPLOYED:** **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**

Spec **APPROVED** requires T-007-010 human SPEC approval — **SATISFIED**.  
Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-007-604) — **NOT STARTED**.  
Spec **DONE** requires CODE_COMPLETE + agreed deploy verification — **NOT STARTED**.

**Implementation baseline:** SPEC-004 CODE_COMPLETE @ `8661e4a2c272372e4d851bdb01d10f85b447e27c`  
**Upstream SPEC-003:** `e16280607fa078941078d2cb4c233025a1bd66a1`  
**Upstream SPEC-006:** `d98c98ca6ee877fc510d3327bd4b1208d74a7b54`  
**Branch:** `spec/007-opportunity-scout`  
**Phase-0 checkpoint:** `551679e9fd562771d1e700807c2b373f0cc07b3d`  
**Phase-1 checkpoint:** _(pinned at governance checkpoint)_

### Human SPEC approval (T-007-010)

| Field | Value |
|-------|--------|
| **Task** | T-007-010 |
| **Status** | **DONE** |
| **Date** | 2026-08-26 |
| **Timezone** | America/Bogota |
| **Authorization text** | «Apruebo formalmente SPEC-007 — Opportunity Scout y autorizo el cierre de T-007-010 y el inicio de la Phase 1 de implementación.» |
| **PHASE-1 AUTHORIZATION** | YES |
| **PHASE-2 AUTHORIZATION** | NO |

---

## Required (implementation → CODE_COMPLETE candidate)

| # | Criterion | Phase | Status | Evidence target |
|---|-----------|-------|--------|-----------------|
| A1 | Canonical `OpportunityCandidate` aggregate exists | 1 | ✅ PASS | Domain `opportunityCandidateCore.ts` |
| A2 | Canonical materialized `Opportunity` model | 1 | ✅ PASS | Domain `opportunityCore.ts` |
| A3 | Stage A intelligence ≠ Stage B execution authority | 0–1 | ✅ PASS | spec + Domain gate |
| A4 | Thesis explicit — no `[0]` / primary / winner | 1–5 | ◐ PARTIAL | Domain + arch tests; App/Infra/main pending |
| A5 | Opportunity Score exists and is explainable | 1–2 | ◐ PARTIAL | Domain score + explainability; App pending |
| A6 | Opportunity Score ≠ SPEC-002 Strategic Score | 1–5 | ◐ PARTIAL | Domain + arch; full circuit pending |
| A7 | Multi-thesis evaluation explicit on candidates | 1–2 | ◐ PARTIAL | Domain; App pending |
| A8 | Materialized Opportunity binds exactly one thesisId | 1–4 | ◐ PARTIAL | Domain materialize; App/migrate pending |
| A9 | Materialize requires SPEC-004 CREATE_OPPORTUNITY allow | 2–5 | ◐ PARTIAL | Domain gate predicates; App/consumer pending |
| A10 | Trusted actor wins over caller spoof | 2–5 | ☐ PENDING | App trusted context |
| A11 | Tenant isolation (org\|client\|id) | 1–5 | ◐ PARTIAL | Domain; App/Infra pending |
| A12 | Cross-org / cross-client deny | 1–5 | ◐ PARTIAL | Domain tenant match; Infra pending |
| A13 | Human accept/decline governed | 2–5 | ☐ PENDING | App use cases |
| A14 | AI cannot authorize materialize/accept/submit | 2–5 | ◐ PARTIAL | Domain actor deny; App pending |
| A15 | Caller snapshot authority = 0 | 2–5 | ☐ PENDING | App + consumer |
| A16 | UI status-alone authority = 0 | 4–5 | ☐ PENDING | Arch bans |
| A17 | History append-only | 3–5 | ☐ PENDING | Infra history |
| A18 | History is not current authority | 3–5 | ◐ PARTIAL | Domain intents `AUDIT_ONLY`; persistence pending |
| A19 | Idempotent register/evaluate/materialize/lifecycle | 2–5 | ◐ PARTIAL | Domain fingerprint helper; App/Infra pending |
| A20 | Explainability projection (why/whyNow/score/risks) | 1–3 | ◐ PARTIAL | Domain explainability; Infra pending |
| A21 | Domain framework-pure | 1–5 | ✅ PASS | Arch tests Phase 1 |
| A22 | Application depends on ports | 2–5 | ☐ PENDING | Arch tests |
| A23 | `dbService` Opportunity demoted from authority | 4 | ☐ PENDING | Migration + gate |
| A24 | OpportunityPanel / ClientPortal triggers only | 4 | ☐ PENDING | Consumer |
| A25 | main.ts create path uses Application Materialize | 4 | ☐ PENDING | Consumer |
| A26 | SPEC-003 Brief mutation by 007 = 0 | 4–5 | ☐ PENDING | Arch bans |
| A27 | SPEC-004 Plan gate preserved / no parallel | 4–5 | ☐ PENDING | Tests |
| A28 | SPEC-006 publication not owned by 007 | 4–5 | ☐ PENDING | Arch bans |
| A29 | Denied Plan → materialize side effects 0 | 4–5 | ☐ PENDING | Ordering tests |
| A30 | Canonical lifecycle unifies dual legacy statuses | 1–4 | ◐ PARTIAL | Domain lifecycle + legacy map; migrate Phase 4 |
| A31 | Legacy status mapping documented / no silent coerce of ambiguous | 0–4 | ◐ PARTIAL | opportunity-model + Domain fail-closed map |
| A32 | SPEC-001 regression PASS | 6 | ☐ PENDING | Phase 6 |
| A33 | SPEC-002 regression PASS | 6 | ☐ PENDING | Phase 6 |
| A34 | SPEC-003 regression PASS | 6 | ☐ PENDING | Phase 6 |
| A35 | SPEC-004 regression PASS | 6 | ☐ PENDING | Phase 6 |
| A36 | SPEC-005 / SPEC-006 regression PASS | 6 | ☐ PENDING | Phase 6 |
| A37 | SPEC-009 auth claims boundary | 5–6 | ☐ PENDING | Phase 5–6 |
| A38 | Dedicated SPEC-007 security suites | 5 | ☐ PENDING | Phase 5 |
| A39 | LOCAL_AUTHORITATIVE documented | 3–6 | ☐ PENDING | Phase 3 |
| A40 | `npm run check` + `test:rules` PASS | 6 | ☐ PENDING | Phase 6 |

**Implementation acceptance A1–A40 (Phase 1):** **4 PASS** · **14 PARTIAL** · **0 FAIL** · **22 PENDING**  
**CODE_COMPLETE CANDIDATE:** **NO**  
**HUMAN SPEC APPROVAL (T-007-010):** **DONE**

---

## Deploy gates (separate — NOT STARTED)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Remote Opportunity persistence + rules plan with SPEC-009 | ☐ PENDING |
| D2 | Production deploy authorized and executed | ☐ PENDING |
| D3 | Post-deploy verification | ☐ PENDING |

**SPEC-009 PRODUCTION = DEFERRED_UNCHANGED**

---

## Sign-off tracking

| Milestone | Status |
|-----------|--------|
| Phase 0 package | ✅ COMPLETE |
| T-007-010 Human SPEC approval | ✅ DONE · APPROVED |
| Phase 1 Domain | ✅ COMPLETE |
| Phase 2–6 | ☐ NOT_AUTHORIZED / NOT_STARTED |
| CODE_COMPLETE | ☐ NO |
| DEPLOYED / DONE | ☐ **NO** |

**Current:** Phase 1 **COMPLETE** · **CODE_COMPLETE = NO** · **DEPLOYED = NO** · **DONE = NO**

**Next allowed state:** Phase 2 Application (requires separate authorization) — **STOP**.
