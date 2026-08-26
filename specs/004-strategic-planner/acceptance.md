# Acceptance 004 — Strategic Planner

**Phase 0:** Formal package **COMPLETE** · Human SPEC approval **APPROVED** (T-004-010)  
**SPEC-004 FORMAL SPEC:** **APPROVED**  
**SPEC-004 IMPLEMENTATION:** **PHASE_1_COMPLETE** · CODE_COMPLETE **NO**  
**DEPLOYED:** **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**

Spec **APPROVED** requires T-004-010 human SPEC approval — **SATISFIED**.  
Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-004-604) — **NOT STARTED**.  
Spec **DONE** requires CODE_COMPLETE + agreed deploy verification — **NOT STARTED**.

**Implementation baseline:** SPEC-006 CODE_COMPLETE @ `d98c98ca6ee877fc510d3327bd4b1208d74a7b54`  
**Upstream SPEC-003:** `e16280607fa078941078d2cb4c233025a1bd66a1`  
**Phase-0 checkpoint:** `6ee32f5e6c303abd98f9b17966bfdffa2a7a0338`  
**Branch:** `spec/004-strategic-planner`

### Human SPEC approval (T-004-010)

| Field | Value |
|-------|--------|
| **Task** | T-004-010 |
| **Status** | **DONE** |
| **Date** | **2026-08-25** (America/Bogota) |
| **Authorization text** | «Apruebo formalmente SPEC-004 — Strategic Planner y autorizo el cierre de T-004-010 y el inicio de la Phase 1 de implementación.» |

---

## Required (implementation → CODE_COMPLETE candidate)

| # | Criterion | Phase | Status | Evidence |
|---|-----------|-------|--------|----------|
| A1 | Canonical `StrategicPlan` aggregate exists (tenant, Brief binding, thesis, status, version) | 1 | ✅ **PASS** | `strategicPlanCore.ts` + domain tests |
| A2 | Canonical `PlanItem` model (action, order, rationale, status, plan link) | 1 | ✅ **PASS** | `planItemCore.ts` |
| A3 | Plan ↔ Brief is one-to-one revision binding | 1–2 | ✅ **PASS** | Domain create/bind (App live load Phase 2) |
| A4 | Thesis on plan equals Brief.thesisId — no `[0]` / primary / winner | 1–5 | ✅ **PASS** | Domain + architecture scan |
| A5 | PlanItem.action bounded by Brief.authorizedAction | 1–5 | ✅ **PASS** | createPlanItem + gate |
| A6 | `NONE` authorizedAction cannot activate executable items | 1–2 | ✅ **PASS** | NONE denied on PlanItem |
| A7 | PlanStatus lifecycle enforced (illegal transitions fail closed) | 1 | ✅ **PASS** | State machine tests |
| A8 | Human Approve/Reject required for plan authority | 2–5 | ☐ PENDING | Domain actor kind present; App trusted context Phase 2 |
| A9 | AI cannot approve/activate/reject plans | 2–5 | ✅ **PASS** | Domain AI ban (App enforcement Phase 2) |
| A10 | Trusted actor context wins over caller spoof | 2–5 | ☐ PENDING | Application |
| A11 | Tenant isolation: foreign Brief/plan deny | 1–5 | ✅ **PASS** | planTenantCore + tests |
| A12 | Cross-org deny | 1–5 | ✅ **PASS** | Tenant envelope match |
| A13 | Cross-client deny | 1–5 | ✅ **PASS** | Tenant envelope match |
| A14 | Stale Brief version denies activation | 1–5 | ✅ **PASS** | planBriefContextCore |
| A15 | Superseded Brief denies activation | 1–5 | ✅ **PASS** | planBriefContextCore |
| A16 | Material revise supersedes prior APPROVED/ACTIVE | 1–3 | ✅ **PASS** | reviseStrategicPlanMaterial |
| A17 | History append-only for material events | 3–5 | ☐ PENDING | History store |
| A18 | History is not current authority | 3–5 | ✅ **PASS** | History intent only (Domain) |
| A19 | Idempotent create/add/approve/activate where applicable | 2–5 | ☐ PENDING | Keys defined; App Phase 2 |
| A20 | Explainability projection complete | 1–3 | ✅ **PASS** | planExplainabilityCore |
| A21 | Domain framework-pure | 1–5 | ✅ **PASS** | Architecture tests |
| A22 | Application depends on ports not infrastructure | 2–5 | ☐ PENDING | Phase 2 |
| A23 | CurationEntry demoted from Plan authority | 4 | ☐ PENDING | Migration |
| A24 | DeliveryPackage not Plan aggregate | 4 | ☐ PENDING | Architecture |
| A25 | Content is downstream; SPEC-006 publication preserved | 4–5 | ☐ PENDING | Consumer (Domain does not embed SPEC-006) |
| A26 | Opportunity/Task materialization does not become strategy authority | 4 | ☐ PENDING | Consumer |
| A27 | No parallel Claim/Evidence verification in SPEC-004 | 4–5 | ✅ **PASS** | Domain arch bans |
| A28 | AuthorizePlannedAction before side-effect materialization | 4–5 | ☐ PENDING | Consumer spies |
| A29 | Denied planned action → side effects 0 | 4–5 | ☐ PENDING | Consumer |
| A30 | Multi-Brief aggregation denied (or explicitly governed — Phase 0: denied) | 1–5 | ✅ **PASS** | Domain deny |
| A31 | Multi-signal traceability preserved without reroute | 1–4 | ✅ **PASS** | signalIds on plan |
| A32 | SPEC-001 regression PASS | 6 | ☐ PENDING | Routing suites |
| A33 | SPEC-002 regression PASS | 6 | ☐ PENDING | Scoring suites |
| A34 | SPEC-003 regression PASS | 6 | ☐ PENDING | Brief suites |
| A35 | SPEC-005 regression PASS | 6 | ☐ PENDING | Gateway suites |
| A36 | SPEC-006 regression PASS | 6 | ☐ PENDING | Claim suites |
| A37 | SPEC-009 auth claims boundary / OTHER_SPEC | 5–6 | ☐ PENDING | Import bans + rules |
| A38 | Dedicated SPEC-004 architecture/security suites | 5 | ☐ PENDING | Phase 5 (Domain arch started) |
| A39 | LOCAL_AUTHORITATIVE documented; remote not required for CODE_COMPLETE | 3–6 | ☐ PENDING | Plan + stores |
| A40 | `npm run check` PASS | 6 | ☐ PENDING | Full suite |
| A41 | `npm run test:rules` PASS | 6 | ☐ PENDING | Rules suite |
| A42 | Legacy planner-adjacent suites remain green or formally superseded | 4–6 | ☐ PENDING | delivery/content/work (28/28 green baseline) |

**Implementation acceptance A1–A42:** **20 PASS** · **0 PARTIAL** · **22 PENDING** (after Phase 1)  
**CODE_COMPLETE CANDIDATE:** **NO**  
**HUMAN SPEC APPROVAL (T-004-010):** **DONE** — **APPROVED** 2026-08-25 (America/Bogota)

---

## Deploy gates (separate — NOT STARTED)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Remote StrategicPlan persistence + rules plan with SPEC-009 | ☐ PENDING |
| D2 | Production deploy authorized and executed | ☐ PENDING |
| D3 | Post-deploy verification | ☐ PENDING |

**SPEC-009 PRODUCTION = DEFERRED_UNCHANGED**

---

## Phase-1 verification record

| Suite | Result |
|-------|--------|
| Domain + Arch | **23/23 PASS** |
| Adjacent legacy | **28/28 PASS** |
| `npm run check` | **999/999 PASS** |
| `npm run test:rules` | **91/91 PASS** |
| Application / Persistence / Consumer | **NONE** |

---

## Sign-off tracking

| Milestone | Status |
|-----------|--------|
| Phase 0 package | ✅ COMPLETE |
| T-004-010 Human SPEC approval | ✅ **DONE** — **APPROVED** 2026-08-25 (America/Bogota) |
| Phase 1 Domain (T-004-101…110) | ✅ **COMPLETE** |
| Phase 2 Application | ☐ NOT_AUTHORIZED |
| CODE_COMPLETE | ☐ NO |
| DEPLOYED / DONE | ☐ **NO** |

**Current:** **APPROVED** · **PHASE_1 = COMPLETE** · **CODE_COMPLETE = NO** · **DEPLOYED = NO** · **DONE = NO**

**Next allowed state:** Separate authorization for Phase 2 Application.
