# Acceptance 007 — Opportunity Scout

**Phase 0:** Formal package **COMPLETE** · Human SPEC approval **APPROVED** (T-007-010)  
**Phase 1:** Domain **COMPLETE** (T-007-101…110)  
**Phase 2:** Application + ports **COMPLETE** (T-007-201…211)  
**Phase 3:** Persistence **COMPLETE** (T-007-301…308) · **LOCAL_AUTHORITATIVE**  
**Phase 4:** Consumer / legacy migration **COMPLETE** (T-007-401…407)  
**Phase 5:** Security / adversarial **COMPLETE** (T-007-501…510) · threats **18/18 PASS**  
**Phase 6:** Acceptance **COMPLETE** (T-007-601…605) · human T-007-604 **DONE**  
**SPEC-007 IMPLEMENTATION:** **IMPLEMENTATION_COMPLETE = YES**  
**CODE_COMPLETE CANDIDATE:** **YES**  
**CODE_COMPLETE:** **YES**  
**HUMAN CODE_COMPLETE SIGNOFF:** **APPROVED** (T-007-604)  
**DEPLOYED:** **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**  
**FREEZE:** **ACTIVE**

Spec **APPROVED** requires T-007-010 human SPEC approval — **SATISFIED**.  
Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-007-604) — **SATISFIED**.  
Spec **DONE** requires CODE_COMPLETE + agreed deploy verification — **NOT STARTED** (deployment separate).

**Human CODE_COMPLETE model:** TASK-LEVEL only (T-007-604). No A1–A40 criterion is human-only.  
**Implementation baseline:** SPEC-004 CODE_COMPLETE @ `8661e4a2c272372e4d851bdb01d10f85b447e27c`  
**Upstream SPEC-003:** `e16280607fa078941078d2cb4c233025a1bd66a1`  
**Upstream SPEC-006:** `d98c98ca6ee877fc510d3327bd4b1208d74a7b54`  
**Branch:** `spec/007-opportunity-scout`  
**Phase-0 checkpoint:** `551679e9fd562771d1e700807c2b373f0cc07b3d`  
**Phase-1 implementation SHA:** `cdcb5a04cf4e97baaaf7db7d7a62dccc15afcc98`  
**Phase-1 checkpoint:** `2899386c1a660e79bf90a15a991ffdcf157567f8`  
**Phase-2 implementation SHA:** `ddd43002c9501b3853744409c343012aae5943ec`  
**Phase-2 checkpoint:** `5eafd7a170791995f31ce647fa1777dea63e16e3`  
**Phase-3 implementation SHA:** `78f5c4dade7c411fd9ce143d69e41d70efa30f4f`  
**Phase-3 checkpoint:** `248b37e1c32cb8a635dc12d864f769be709ceca7`  
**Phase-4 implementation SHA:** `69fb4457644fdf6af530c065e5897c87b74b4384`  
**Phase-4 checkpoint:** `85dc11255da419cdb6be1588a5e86584b38d6f4f`  
**Phase-5 security/test SHA:** `2e52626cc57f0f34d5e759e2309a6df108134f58`  
**Phase-5 checkpoint:** `ed6c916f96ac5e46be1d366a69a670b1e2ed92b3`  
**Phase-6 acceptance evidence SHA:** `9c7536a217e81d32a4c7fa3e14e1f956b292d7b8`  
**Phase-6 CODE_COMPLETE candidate checkpoint:** `8a21ee0aa0c8b1acdb34805b6e47ead6ec1aec87`

### Human SPEC approval (T-007-010)

| Field | Value |
|-------|--------|
| **Task** | T-007-010 |
| **Status** | **DONE** |
| **Date** | 2026-08-26 |
| **Timezone** | America/Bogota |
| **Authorization text** | «Apruebo formalmente SPEC-007 — Opportunity Scout y autorizo el cierre de T-007-010 y el inicio de la Phase 1 de implementación.» |

### Human CODE_COMPLETE approval (T-007-604) — RECORDED

| Field | Value |
|-------|--------|
| **Task** | T-007-604 |
| **Status** | **DONE** |
| **Date** | 2026-08-26 |
| **Timezone** | America/Bogota |
| **Authorization text** | «Apruebo formalmente el CODE_COMPLETE de SPEC-007 — Opportunity Scout y autorizo el cierre de T-007-604.» |
| **APPROVAL CONTRACT MATCH** | **YES** |
| **HUMAN CODE_COMPLETE SIGNOFF** | **APPROVED** |

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Phase | Status | Evidence target |
|---|-----------|-------|--------|-----------------|
| A1 | Canonical `OpportunityCandidate` aggregate exists | 1 | ✅ PASS | Domain `opportunityCandidateCore.ts` |
| A2 | Canonical materialized `Opportunity` model | 1 | ✅ PASS | Domain `opportunityCore.ts` |
| A3 | Stage A intelligence ≠ Stage B execution authority | 0–1 | ✅ PASS | spec + Domain gate |
| A4 | Thesis explicit — no `[0]` / primary / winner | 1–5 | ✅ PASS | Domain+App+Infra+consumer+Phase 5 |
| A5 | Opportunity Score exists and is explainable | 1–6 | ✅ PASS | Domain score + explainability projections |
| A6 | Opportunity Score ≠ SPEC-002 Strategic Score | 1–5 | ✅ PASS | Domain + Phase 5 T-007-510 / T-007-15 |
| A7 | Multi-thesis evaluation explicit on candidates | 1–2 | ✅ PASS | Domain + App register/evaluate |
| A8 | Materialized Opportunity binds exactly one thesisId | 1–4 | ✅ PASS | Domain + App + Infra + consumer |
| A9 | Materialize requires SPEC-004 CREATE_OPPORTUNITY allow | 2–5 | ✅ PASS | App + consumer + Phase 5 bypass matrix |
| A10 | Trusted actor wins over caller spoof | 2–5 | ✅ PASS | App + consumer + Phase 5 |
| A11 | Tenant isolation (org\|client\|id) | 1–5 | ✅ PASS | Domain + App + Infra + Phase 5 matrix |
| A12 | Cross-org / cross-client deny | 1–5 | ✅ PASS | Domain + App + Infra + Phase 5 |
| A13 | Human accept/decline governed | 2–5 | ✅ PASS | App + consumer lifecycle |
| A14 | AI cannot authorize materialize/accept/submit | 2–5 | ✅ PASS | Domain + App + Phase 5 T-007-03 |
| A15 | Caller snapshot authority = 0 | 2–5 | ✅ PASS | App + consumer + Phase 5 |
| A16 | UI status-alone authority = 0 | 4–5 | ✅ PASS | Panel + Phase 5 UI bans |
| A17 | History append-only | 3–5 | ✅ PASS | Infra history adapter |
| A18 | History is not current authority | 3–5 | ✅ PASS | AUDIT_ONLY + Phase 5 T-007-11 |
| A19 | Idempotent register/evaluate/materialize/lifecycle | 2–5 | ✅ PASS | App + durable keys + Phase 5 replay |
| A20 | Explainability projection (why/whyNow/score/risks) | 1–6 | ✅ PASS | `opportunityExplainabilityCore` + App projections |
| A21 | Domain framework-pure | 1–5 | ✅ PASS | Arch tests Phase 1 + 5 |
| A22 | Application depends on ports | 2–5 | ✅ PASS | App arch tests Phase 2 + 5 |
| A23 | `dbService` Opportunity demoted from authority | 4 | ✅ PASS | Demotion + Phase 5 T-007-506 |
| A24 | OpportunityPanel / ClientPortal triggers only | 4 | ✅ PASS | Consumer list + main intent handlers |
| A25 | main.ts create path uses Application Materialize | 4 | ✅ PASS | `materializeOpportunityForDelivery` |
| A26 | SPEC-003 Brief mutation by 007 = 0 | 4–5 | ✅ PASS | Consumer/arch bans + T-007-507 |
| A27 | SPEC-004 Plan gate preserved / no parallel | 4–5 | ✅ PASS | PlanAuth + Phase 5 bypass = 0 |
| A28 | SPEC-006 publication not owned by 007 | 4–5 | ✅ PASS | App/Infra/consumer + T-007-509 |
| A29 | Denied Plan → materialize side effects 0 | 4–5 | ✅ PASS | App + consumer deny/no-mirror |
| A30 | Canonical lifecycle unifies dual legacy statuses | 1–4 | ✅ PASS | Canonical status; dual COMPATIBILITY only |
| A31 | Legacy status mapping documented / no silent coerce of ambiguous | 0–4 | ✅ PASS | Domain map + MIGRATION_REVIEW_REQUIRED |
| A32 | SPEC-001 regression PASS | 5–6 | ✅ PASS | Phase 5 T-007-510 |
| A33 | SPEC-002 regression PASS | 5–6 | ✅ PASS | Phase 5 OpportunityScore ≠ StrategicScore |
| A34 | SPEC-003 regression PASS | 5–6 | ✅ PASS | Phase 5 T-007-507 |
| A35 | SPEC-004 regression PASS | 5–6 | ✅ PASS | Phase 5 frozen tip + no parallel gate |
| A36 | SPEC-005 / SPEC-006 regression PASS | 5–6 | ✅ PASS | Phase 5 T-007-508 / T-007-509 |
| A37 | SPEC-009 auth claims boundary | 5–6 | ✅ PASS | DEFERRED_UNCHANGED; no production ownership |
| A38 | Dedicated SPEC-007 security suites | 5 | ✅ PASS | Phase5Security + Phase5Architecture |
| A39 | LOCAL_AUTHORITATIVE documented | 3–6 | ✅ PASS | Phase 3 store keys + plan |
| A40 | `npm run check` + `test:rules` PASS | 6 | ✅ PASS | Fresh closure: check **1245/1245** · rules **91/91** |

**Implementation acceptance A1–A40:** **40 PASS** · **0 PARTIAL** · **0 FAIL** · **0 PENDING**  
**CODE_COMPLETE CANDIDATE:** **YES**  
**CODE_COMPLETE:** **YES**  
**HUMAN SPEC APPROVAL (T-007-010):** **DONE**  
**HUMAN CODE_COMPLETE SIGNOFF (T-007-604):** **APPROVED**

---

## Deploy gates (separate — NOT STARTED)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Remote Opportunity persistence + rules plan with SPEC-009 | ☐ NOT_STARTED |
| D2 | Production deploy authorization | ☐ NOT_STARTED |
| D3 | Post-deploy verification | ☐ NOT_STARTED |

**SPEC-009 PRODUCTION = DEFERRED_UNCHANGED**  
**DEPLOYMENT = NOT_STARTED** · **DEPLOYED = NO** · **DONE = NO**

---

## Findings disposition (final)

| Audit | Disposition |
|-------|-------------|
| AUDIT007-02 | **RESOLVED** |
| AUDIT007-03 | **RESOLVED** |
| AUDIT007-04 | **RESOLVED** |
| AUDIT007-05 | **RESOLVED** |
| AUDIT007-07 | **RESOLVED** |
| AUDIT007-08 | **OPEN_NONBLOCKING** — spotlight `[0]` DISPLAY_ONLY |

**Formal threats T-007-01…18:** **18/18 PASS**  
**Local tamper resistance:** **KNOWN_LIMITATION** · **NONBLOCKING** · **DEFERRED_TO_SPEC009**  
**New findings:** **0**  

**P0 = 0 · P1 = 0 · P2 = 0 · P3 = 1**

---

## Sign-off tracking

| Milestone | Status |
|-----------|--------|
| Phase 0 package | ✅ COMPLETE |
| T-007-010 Human SPEC approval | ✅ DONE · APPROVED |
| Phase 1 Domain | ✅ COMPLETE |
| Phase 2 Application | ✅ COMPLETE |
| Phase 3 Persistence | ✅ COMPLETE · LOCAL_AUTHORITATIVE |
| Phase 4 Consumer | ✅ COMPLETE |
| Phase 5 Security | ✅ COMPLETE · 18/18 threats PASS |
| Phase 6 technical evidence | ✅ COMPLETE |
| T-007-604 Human CODE_COMPLETE | ✅ **DONE** · **APPROVED** |
| CODE_COMPLETE CANDIDATE | ✅ **YES** |
| CODE_COMPLETE | ✅ **YES** |
| FREEZE | ✅ **ACTIVE** |
| DEPLOYED / DONE | ☐ **NO** |

**Current:** **CODE_COMPLETE = YES** · **FREEZE = ACTIVE** · **DEPLOYED = NO** · **DONE = NO**

**Next action:** Accept SPEC-007 final freeze. Do not deploy without separate authorization. Do not start SPEC-008.
