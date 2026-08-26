# Acceptance 004 — Strategic Planner

**Phase 0:** Formal package **COMPLETE** · Human SPEC approval **APPROVED** (T-004-010)  
**SPEC-004 FORMAL SPEC:** **APPROVED**  
**SPEC-004 IMPLEMENTATION:** **PHASE_4_COMPLETE** · CODE_COMPLETE **NO**  
**DEPLOYED:** **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**

Spec **APPROVED** requires T-004-010 human SPEC approval — **SATISFIED**.  
Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-004-604) — **NOT STARTED**.  
Spec **DONE** requires CODE_COMPLETE + agreed deploy verification — **NOT STARTED**.

**Implementation baseline:** SPEC-006 CODE_COMPLETE @ `d98c98ca6ee877fc510d3327bd4b1208d74a7b54`  
**Upstream SPEC-003:** `e16280607fa078941078d2cb4c233025a1bd66a1`  
**Phase-0 checkpoint:** `6ee32f5e6c303abd98f9b17966bfdffa2a7a0338`  
**Phase-1 checkpoint:** `6e8de53673ed8a2e7e7caf033ee51bca51307a19`  
**Phase-2 checkpoint:** `b6c2712d3f0183c76259680cbf03c9ec0abdd59e`  
**Phase-3 checkpoint:** `2e27e08cf28530c1935af5e49adf69747ca0e92c`  
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
| A1 | Canonical `StrategicPlan` aggregate exists | 1 | ✅ **PASS** | Domain |
| A2 | Canonical `PlanItem` model | 1 | ✅ **PASS** | Domain |
| A3 | Plan ↔ Brief one-to-one revision binding | 1–2 | ✅ **PASS** | Domain + App |
| A4 | Thesis explicit — no `[0]` / primary / winner | 1–5 | ✅ **PASS** | Domain/App/Infra/main scan |
| A5 | PlanItem.action bounded by Brief.authorizedAction | 1–5 | ✅ **PASS** | Domain + App + consumer |
| A6 | `NONE` cannot activate executable items | 1–2 | ✅ **PASS** | Domain + consumer |
| A7 | PlanStatus lifecycle enforced | 1 | ✅ **PASS** | Domain |
| A8 | Human Approve/Reject required | 2–5 | ✅ **PASS** | App trusted HUMAN |
| A9 | AI cannot approve/activate/reject | 2–5 | ✅ **PASS** | Domain + App |
| A10 | Trusted actor wins over caller spoof | 2–5 | ✅ **PASS** | App + consumer |
| A11 | Tenant isolation | 1–5 | ✅ **PASS** | Domain/App/Infra/consumer |
| A12 | Cross-org deny | 1–5 | ✅ **PASS** | Tenant keys |
| A13 | Cross-client deny | 1–5 | ✅ **PASS** | Tenant keys |
| A14 | Stale Brief version denies activation | 1–5 | ✅ **PASS** | After reload + consumer |
| A15 | Superseded Brief denies activation | 1–5 | ✅ **PASS** | Domain + consumer |
| A16 | Material revise supersedes prior | 1–3 | ✅ **PASS** | Domain + App |
| A17 | History append-only | 3–5 | ✅ **PASS** | Infra history |
| A18 | History is not current authority | 3–5 | ✅ **PASS** | Tests |
| A19 | Idempotent create/add/approve/activate | 2–5 | ✅ **PASS** | App + durable Infra |
| A20 | Explainability projection | 1–3 | ✅ **PASS** | Domain + authorize result |
| A21 | Domain framework-pure | 1–5 | ✅ **PASS** | Arch tests |
| A22 | Application depends on ports | 2–5 | ✅ **PASS** | Arch tests |
| A23 | CurationEntry demoted from Plan authority | 4 | ✅ **PASS** | assertCurationNotPlanAuthority + gate |
| A24 | DeliveryPackage not Plan aggregate | 4 | ✅ **PASS** | Migration matrix + gate |
| A25 | Content downstream; SPEC-006 preserved | 4–5 | ✅ **PASS** | Plan then Claim gate |
| A26 | Opportunity/Task not strategy authority | 4 | ✅ **PASS** | Downstream of PlanItem |
| A27 | No parallel Claim/Evidence in SPEC-004 | 4–5 | ✅ **PASS** | Arch bans |
| A28 | AuthorizePlannedAction before side-effect | 4–5 | ✅ **PASS** | gateStrategicDownstream |
| A29 | Denied planned action → side effects 0 | 4–5 | ✅ **PASS** | Deny before create |
| A30 | Multi-Brief aggregation denied | 1–5 | ✅ **PASS** | Domain + App |
| A31 | Multi-signal traceability preserved | 1–4 | ✅ **PASS** | signalIds on plan |
| A32 | SPEC-001 regression PASS | 6 | ☐ PENDING | Phase 6 |
| A33 | SPEC-002 regression PASS | 6 | ☐ PENDING | Phase 6 |
| A34 | SPEC-003 regression PASS | 6 | ☐ PENDING | Phase 6 |
| A35 | SPEC-005 regression PASS | 6 | ☐ PENDING | Phase 6 |
| A36 | SPEC-006 regression PASS | 6 | ☐ PENDING | Phase 6 |
| A37 | SPEC-009 auth claims boundary | 5–6 | ☐ PENDING | Phase 5–6 |
| A38 | Dedicated SPEC-004 security suites | 5 | ☐ PENDING | Phase 5 |
| A39 | LOCAL_AUTHORITATIVE documented | 3–6 | ✅ **PASS** | Phase 3 |
| A40 | `npm run check` PASS | 6 | ☐ PENDING | 1070 green baseline |
| A41 | `npm run test:rules` PASS | 6 | ☐ PENDING | 91 green baseline |
| A42 | Legacy planner-adjacent suites green | 4–6 | ✅ **PASS** | 28/28 adjacent |

**Implementation acceptance A1–A42:** **34 PASS** · **0 PARTIAL** · **8 PENDING** (after Phase 4)  
**CODE_COMPLETE CANDIDATE:** **NO**  
**HUMAN SPEC APPROVAL (T-004-010):** **DONE**

---

## Deploy gates (separate — NOT STARTED)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Remote StrategicPlan persistence + rules plan with SPEC-009 | ☐ PENDING |
| D2 | Production deploy authorized and executed | ☐ PENDING |
| D3 | Post-deploy verification | ☐ PENDING |

**SPEC-009 PRODUCTION = DEFERRED_UNCHANGED**

---

## Phase-4 verification record

| Suite | Result |
|-------|--------|
| Phase-4 Consumer + Arch | **20/20 PASS** |
| Phase-3 Persistence + Arch | **19/19 PASS** |
| Phase-2 Application + Arch | **32/32 PASS** |
| Phase-1 Domain + Arch | **23/23 PASS** |
| Adjacent legacy | **28/28 PASS** |
| `npm run check` | **1070/1070 PASS** |
| `npm run test:rules` | **91/91 PASS** |

---

## Sign-off tracking

| Milestone | Status |
|-----------|--------|
| Phase 0–3 | ✅ COMPLETE |
| Phase 4 Consumer (T-004-401…407) | ✅ **COMPLETE** |
| F-004-03 | ✅ **RESOLVED** |
| Phase 5 Security | ☐ NOT_AUTHORIZED |
| CODE_COMPLETE | ☐ NO |
| DEPLOYED / DONE | ☐ **NO** |

**Current:** **APPROVED** · **PHASE_4 = COMPLETE** · **CODE_COMPLETE = NO** · **DEPLOYED = NO** · **DONE = NO**

**Next allowed state:** Separate authorization for Phase 5 Security.
