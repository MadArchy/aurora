# Acceptance 004 — Strategic Planner

**Phase 0:** Formal package **COMPLETE** · Human SPEC approval **APPROVED** (T-004-010)  
**SPEC-004 FORMAL SPEC:** **APPROVED**  
**SPEC-004 IMPLEMENTATION:** **CODE_COMPLETE** · DEPLOYED **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**

Spec **APPROVED** requires T-004-010 human SPEC approval — **SATISFIED**.  
Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-004-604) — **SATISFIED**.  
Spec **DONE** requires CODE_COMPLETE + agreed deploy verification — **NOT STARTED**.

**Implementation baseline:** SPEC-006 CODE_COMPLETE @ `d98c98ca6ee877fc510d3327bd4b1208d74a7b54`  
**Upstream SPEC-003:** `e16280607fa078941078d2cb4c233025a1bd66a1`  
**Phase-0 checkpoint:** `6ee32f5e6c303abd98f9b17966bfdffa2a7a0338`  
**Phase-1 checkpoint:** `6e8de53673ed8a2e7e7caf033ee51bca51307a19`  
**Phase-2 checkpoint:** `b6c2712d3f0183c76259680cbf03c9ec0abdd59e`  
**Phase-3 checkpoint:** `2e27e08cf28530c1935af5e49adf69747ca0e92c`  
**Phase-4 checkpoint:** `c2bfdc70fa2d519cdb7cd5d75d9a06f8dd5bffdc`  
**Phase-5 checkpoint:** `a599e34f76ea2e2e239b9aa005758583d82173da`  
**Phase-6 acceptance evidence SHA:** `30716797badcd59b0839d5695b945d39ba0bedb6`  
**CODE_COMPLETE candidate checkpoint:** `49c998e95f2ac92f5c389545a605a4d86cd98e36`  
**CODE_COMPLETE declaration SHA:** `98ef0baad04735ed45afdf20e65064aab4c92d92`  
**SPEC-004 FINAL CODE_COMPLETE CHECKPOINT:** `98ef0baad04735ed45afdf20e65064aab4c92d92`  
**Branch:** `spec/004-strategic-planner`

### Human SPEC approval (T-004-010)

| Field | Value |
|-------|--------|
| **Task** | T-004-010 |
| **Status** | **DONE** |
| **Date** | **2026-08-25** (America/Bogota) |
| **Authorization text** | «Apruebo formalmente SPEC-004 — Strategic Planner y autorizo el cierre de T-004-010 y el inicio de la Phase 1 de implementación.» |

### Human CODE_COMPLETE sign-off (T-004-604)

| Field | Value |
|-------|--------|
| **Task** | T-004-604 |
| **Status** | **DONE** |
| **Date** | **2026-08-25** (America/Bogota) |
| **Authorization text** | "Apruebo formalmente SPEC-004 — Strategic Planner como CODE_COMPLETE y autorizo el cierre de T-004-604." |

---

## Required (implementation → CODE_COMPLETE candidate)

| # | Criterion | Phase | Status | Evidence |
|---|-----------|-------|--------|----------|
| A1 | Canonical `StrategicPlan` aggregate exists | 1 | ✅ **PASS** | `strategicPlanCore.ts` · `strategicPlanDomain.test.ts` (19) |
| A2 | Canonical `PlanItem` model | 1 | ✅ **PASS** | `planItemCore.ts` · Domain tests |
| A3 | Plan ↔ Brief one-to-one revision binding | 1–2 | ✅ **PASS** | Domain + `CreateStrategicPlan` · Phase 2/5 tests |
| A4 | Thesis explicit — no `[0]` / primary / winner | 1–6 | ✅ **PASS** | Domain/App/Infra/main/consumer scans · Phase 5 arch (12) |
| A5 | PlanItem.action bounded by Brief.authorizedAction | 1–5 | ✅ **PASS** | `planGateCore.ts` · Phase 2/5 adversarial |
| A6 | `NONE` cannot activate executable items | 1–2 | ✅ **PASS** | Domain + consumer · Phase 5 NONE escalation |
| A7 | PlanStatus lifecycle enforced | 1 | ✅ **PASS** | `strategicPlanCore.ts` · Domain tests |
| A8 | Human Approve/Reject required | 2–5 | ✅ **PASS** | App trusted HUMAN · Phase 5 role spoof deny |
| A9 | AI cannot approve/activate/reject | 2–5 | ✅ **PASS** | Domain + App · Phase 5 AI self-approval |
| A10 | Trusted actor wins over caller spoof | 2–5 | ✅ **PASS** | `trustedContext.ts` · Phase 2/5 spoof tests |
| A11 | Tenant isolation | 1–5 | ✅ **PASS** | `planTenantCore.ts` · Phase 3/5 cross-tenant |
| A12 | Cross-org deny | 1–5 | ✅ **PASS** | Tenant keys · Phase 5 matrix |
| A13 | Cross-client deny | 1–5 | ✅ **PASS** | Tenant keys · Phase 5 matrix |
| A14 | Stale Brief version denies activation | 1–5 | ✅ **PASS** | `planBriefContextCore.ts` · Phase 3/5 stale Brief |
| A15 | Superseded Brief denies activation | 1–5 | ✅ **PASS** | Domain + consumer · Phase 5 superseded Brief |
| A16 | Material revise supersedes prior | 1–3 | ✅ **PASS** | Domain + App · Phase 2 revise tests |
| A17 | History append-only | 3–5 | ✅ **PASS** | `LocalStrategicPlanHistoryAdapter` · Infra tests |
| A18 | History is not current authority | 3–5 | ✅ **PASS** | Phase 4/5 history replay deny |
| A19 | Idempotent create/add/approve/activate | 2–5 | ✅ **PASS** | App + durable Infra · Phase 3/5 idempotency |
| A20 | Explainability projection | 1–3 | ✅ **PASS** | `planExplainabilityCore.ts` · authorize result codes |
| A21 | Domain framework-pure | 1–5 | ✅ **PASS** | `strategicPlanArchitecture.test.ts` (4) |
| A22 | Application depends on ports | 2–5 | ✅ **PASS** | `strategicPlanApplicationArchitecture.test.ts` (5) |
| A23 | CurationEntry demoted from Plan authority | 4 | ✅ **PASS** | `assertCurationNotPlanAuthority` · Phase 4/5 |
| A24 | DeliveryPackage not Plan aggregate | 4 | ✅ **PASS** | Migration matrix + Phase 5 delivery spoof |
| A25 | Content downstream; SPEC-006 preserved | 4–5 | ✅ **PASS** | Plan then Claim gate · Phase 4/5 SPEC-006 boundary |
| A26 | Opportunity/Task not strategy authority | 4 | ✅ **PASS** | Downstream of PlanItem · Phase 5 spoof |
| A27 | No parallel Claim/Evidence in SPEC-004 | 4–5 | ✅ **PASS** | Arch bans · SecurityArchitecture |
| A28 | AuthorizePlannedAction before side-effect | 4–5 | ✅ **PASS** | `gateStrategicDownstream` · Phase 5 ordering |
| A29 | Denied planned action → side effects 0 | 4–5 | ✅ **PASS** | Deny before create · Phase 5 |
| A30 | Multi-Brief aggregation denied | 1–5 | ✅ **PASS** | Domain + App · Phase 5 multi-Brief |
| A31 | Multi-signal traceability preserved | 1–4 | ✅ **PASS** | `signalIds` on plan · Domain/App |
| A32 | SPEC-001 regression PASS | 6 | ✅ **PASS** | `strategicRoutingSelectedThesisPersist` (5) · `strategicSignalRoutingPhase4/5` (38) · `thesisRoutingCore/Architecture` (25) — **68/68** fresh |
| A33 | SPEC-002 regression PASS | 6 | ✅ **PASS** | `scoringPhase4/5` (48) · `scoringCore/Architecture` (15) — **63/63** fresh |
| A34 | SPEC-003 regression PASS | 6 | ✅ **PASS** | `strategicBriefPhase4/5` (33) · `strategicBriefSecurityArchitecture` (10) — **43/43** fresh · SPEC-003 mods **0** |
| A35 | SPEC-005 regression PASS | 6 | ✅ **PASS** | `aiGatewayArchitecture` (12) · `aiGatewayPhase5a` (12) — **24/24** fresh · no paid AI · SPEC-005 mods **0** |
| A36 | SPEC-006 regression PASS | 6 | ✅ **PASS** | `claimEvidencePhase5` (22) · `claimEvidenceSecurityArchitecture` (13) — **35/35** fresh · SPEC-006 mods **0** |
| A37 | SPEC-009 auth claims boundary | 5–6 | ✅ **PASS** | Phase 5 — no auth-claim migration; DEFERRED_UNCHANGED |
| A38 | Dedicated SPEC-004 security suites | 5 | ✅ **PASS** | Phase5 (38) + SecurityArch (12) = **50/50** |
| A39 | LOCAL_AUTHORITATIVE documented | 3–6 | ✅ **PASS** | Phase 3 persistence · plan.md |
| A40 | `npm run check` PASS | 6 | ✅ **PASS** | **1120/1120 PASS** (fresh Phase 6) |
| A41 | `npm run test:rules` PASS | 6 | ✅ **PASS** | **91/91 PASS** (fresh Phase 6) |
| A42 | Legacy planner-adjacent suites green | 4–6 | ✅ **PASS** | delivery/content/work/opportunity/stateMachine/claimSafety — **28/28** fresh |

**Implementation acceptance A1–A42:** **42 PASS** · **0 PARTIAL** · **0 FAIL** · **0 PENDING**  
**CODE_COMPLETE CANDIDATE:** **YES**  
**HUMAN SPEC APPROVAL (T-004-010):** **DONE**  
**HUMAN CODE_COMPLETE (T-004-604):** **APPROVED**

### Acceptance discrepancy resolution (Phase 5 → Phase 6)

Phase 5 summary stated **36 PASS / 6 PENDING**, but the authoritative matrix at that time was **35 PASS / 7 PENDING** (A32–A36, A40–A41). The prose count was inconsistent with the table; Phase 6 reconciles to **42/42 PASS** with fresh evidence.

**Human-only gate:** T-004-604 (not an A-criterion).  
**Deployment-only gates:** D1–D3 (separate from A1–A42).

---

## Deploy gates (separate — NOT STARTED)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Remote StrategicPlan persistence + rules plan with SPEC-009 | ☐ PENDING |
| D2 | Production deploy authorized and executed | ☐ PENDING |
| D3 | Post-deploy verification | ☐ PENDING |

**SPEC-009 PRODUCTION = DEFERRED_UNCHANGED**

---

## Phase-6 verification record (fresh)

| Suite | Result |
|-------|--------|
| A1–A42 evidence consolidated | **42/42 PASS** |
| Threats T-004-01…17 | **17/17 PASS** |
| Phase-5 Security + Arch | **50/50 PASS** |
| Phase-4 Consumer + Arch | **20/20 PASS** |
| Phase-3 Persistence + Arch | **19/19 PASS** |
| Phase-2 Application + Arch | **32/32 PASS** |
| Phase-1 Domain + Arch | **23/23 PASS** |
| Adjacent legacy | **28/28 PASS** |
| SPEC-001 regression | **68/68 PASS** |
| SPEC-002 regression | **63/63 PASS** |
| SPEC-003 regression | **43/43 PASS** |
| SPEC-005 regression | **24/24 PASS** |
| SPEC-006 regression | **35/35 PASS** |
| `npm run check` | **1120/1120 PASS** |
| `npm run test:rules` | **91/91 PASS** |
| Product changes | **0** |
| Test changes | **0** |
| F-004-03 | **RESOLVED** |
| F-004-04 | **OPEN_NONBLOCKING** |

---

## Sign-off tracking

| Milestone | Status |
|-----------|--------|
| Phase 0–5 | ✅ COMPLETE |
| Phase 6 Evidence (T-004-601/602/603/605) | ✅ **COMPLETE** |
| Phase 6 Human Gate (T-004-604) | ✅ **APPROVED** |
| F-004-03 | ✅ **RESOLVED** |
| F-004-04 | ☐ **OPEN_NONBLOCKING** (does not affect executable strategic authority; does not block CODE_COMPLETE) |
| CODE_COMPLETE_CANDIDATE | ✅ **YES** |
| CODE_COMPLETE | ✅ **YES** |
| DEPLOYED / DONE | ☐ **NO** |

**Current:** **APPROVED** · **CODE_COMPLETE = YES** · **DEPLOYED = NO** · **DONE = NO** · **SPEC-004 FREEZE = ACTIVE**

**Next allowed state:** Constitutional roadmap — SPEC-007 (not authorized by this closure). Deployment D1–D3 remain separate authorization.
