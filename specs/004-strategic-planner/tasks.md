# Tasks 004 â€” Strategic Planner

**Spec status:** `APPROVED`  
**Implementation:** **PHASE_6_EVIDENCE_COMPLETE** · CODE_COMPLETE_CANDIDATE **YES** · CODE_COMPLETE **NO** · DEPLOYED **NO** · DONE **NO** · DEPLOYMENT **NOT_STARTED**  
**Branch:** `spec/004-strategic-planner`  
**Base SHA:** SPEC-006 CODE_COMPLETE `d98c98ca6ee877fc510d3327bd4b1208d74a7b54`  
**Upstream SPEC-003:** `e16280607fa078941078d2cb4c233025a1bd66a1`  
**Phase-0 governance checkpoint:** `6ee32f5e6c303abd98f9b17966bfdffa2a7a0338`  
**Phase-1 implementation SHA:** `609b17f85a6c9bce3c4ce4afc26d76c0749a9aea`  
**Phase-1 checkpoint:** `6e8de53673ed8a2e7e7caf033ee51bca51307a19`  
**Human SPEC approval:** **APPROVED** (T-004-010) â€” 2026-08-25 (America/Bogota)  
**Approval text:** Â«Apruebo formalmente SPEC-004 â€” Strategic Planner y autorizo el cierre de T-004-010 y el inicio de la Phase 1 de implementaciÃ³n.Â»

Status legend: `TODO` Â· `DOING` Â· `DONE` Â· `BLOCKED` Â· `PENDING`

Requirement ID prefix (future Domain): `PLAN-004-001` â€¦

---

## Phase 0 â€” Inventory + formal SPEC package âœ… COMPLETE

- [x] **T-004-001** Create `specs/004-strategic-planner/` directory â€” **DONE**
- [x] **T-004-002** Author `spec.md` (purpose, authority, boundaries) â€” **DONE**
- [x] **T-004-003** Author `plan.md` (strangler, phases, dependencies) â€” **DONE**
- [x] **T-004-004** Author `tasks.md` (this file) â€” **DONE**
- [x] **T-004-005** Author `acceptance.md` (A1â€“A42 + deploy separation) â€” **DONE**
- [x] **T-004-006** Author `data-flow.md` (flows, gates, Brief/claim boundaries) â€” **DONE**
- [x] **T-004-007** Author `hexagonal-boundaries.md` â€” **DONE**
- [x] **T-004-008** Author `migration-matrix.md` (legacy planner-adjacent inventory) â€” **DONE**
- [x] **T-004-009** Author `planner-model.md` + `threat-model.md` â€” **DONE**
- [x] **T-004-010** Human SPEC approval â†’ status `APPROVED` â€” **DONE** (2026-08-25 America/Bogota)

**Phase 0 gate:** Package authored Â· Human SPEC approval **DONE**

**Exit:** Formal package complete Â· **APPROVED** Â· Phase 1 **AUTHORIZED** after T-004-010.

**Newly authored Phase 0 IDs:** T-004-001 â€¦ T-004-010

---

## Phase 1 â€” Domain contracts âœ… COMPLETE

- [x] **T-004-101** Define `StrategicPlan` aggregate + Brief/thesis/tenant linkage â€” **DONE**
- [x] **T-004-102** Define `PlanItem` entity + action bound to Brief.authorizedAction â€” **DONE**
- [x] **T-004-103** `PlanStatus` / `PlanItemStatus` state machines â€” **DONE**
- [x] **T-004-104** Tenant isolation pure validators â€” **DONE**
- [x] **T-004-105** Stale/superseded Brief fail-closed predicates â€” **DONE**
- [x] **T-004-106** `AuthorizePlannedAction` Domain predicates â€” **DONE**
- [x] **T-004-107** Materiality / supersession rules â€” **DONE**
- [x] **T-004-108** Explainability projection shapes â€” **DONE**
- [x] **T-004-109** Multi-Brief aggregation deny + multi-thesis safety â€” **DONE**
- [x] **T-004-110** Domain unit tests + architecture purity tests â€” **DONE**

**Exit:** Domain tests PASS; no Firebase/db/React/provider imports. **MET**

**Evidence:**
- Domain: `strategicPlanCore.ts`, `planItemCore.ts`, `planTenantCore.ts`, `planBriefContextCore.ts`, `planGateCore.ts`, `planMaterialityCore.ts`, `planExplainabilityCore.ts`, `strategicPlanErrors.ts`
- Tests: `tests/strategicPlanDomain.test.ts` (19) Â· `tests/strategicPlanArchitecture.test.ts` (4) Â· **23/23 PASS**
- Adjacent legacy regression **28/28 PASS**
- F-004-02 = **RESOLVED**

**Phase 1 IDs:** T-004-101 â€¦ T-004-110 â€” **ALL DONE**

**Phase-1 implementation SHA:** `609b17f85a6c9bce3c4ce4afc26d76c0749a9aea`  
**Phase-1 governance checkpoint:** `47d694d2b8feb4f5e322752100082f342b4df479`  
**Phase-1 tip checkpoint:** `6e8de53673ed8a2e7e7caf033ee51bca51307a19`

---

## Phase 2 â€” Application / governance âœ… COMPLETE

- [x] **T-004-201** `CreateStrategicPlan` use case â€” **DONE**
- [x] **T-004-202** `AddPlanItem` / `RemovePlanItem` use cases â€” **DONE**
- [x] **T-004-203** `ProposeStrategicPlan` use case â€” **DONE**
- [x] **T-004-204** `ApproveStrategicPlan` / `RejectStrategicPlan` use cases â€” **DONE**
- [x] **T-004-205** `ReviseStrategicPlan` use case â€” **DONE**
- [x] **T-004-206** `AuthorizePlannedAction` use case (decision only) â€” **DONE**
- [x] **T-004-207** `ActivatePlanItem` / `CompletePlanItem` / `CancelPlanItem` â€” **DONE**
- [x] **T-004-208** `RevalidatePlanAgainstBrief` use case â€” **DONE**
- [x] **T-004-209** Ports: PlanRepository, PlanItemStore, History, BriefReader, Actor, Clock, optional Advisor â€” **DONE**
- [x] **T-004-210** Controlled error model â€” **DONE**
- [x] **T-004-211** Application hexagonal tests â€” **DONE**

**RUNTIME ADVISOR = DEFERRED** (PlannerAdvisorPort only; no new AiOperation)  
**Phase 2 IDs:** T-004-201 â€¦ T-004-211 â€” **ALL DONE**

**Exit:** Application orchestrates Domain; ports only; no Infrastructure/UI/consumer. **MET**

**Evidence:**
- Application: `src/application/strategicPlan/` (use cases + ports + trustedContext)
- Tests: `tests/strategicPlanPhase2.test.ts` (27) Â· `tests/strategicPlanApplicationArchitecture.test.ts` (5) Â· **32/32 PASS**
- Phase-1 Domain regression **23/23 PASS**
- Adjacent legacy regression **28/28 PASS**
- Full check **1031/1031 PASS** Â· Rules **91/91 PASS**
- F-004-03 remains **OPEN** (consumer migration Phase 4)
- F-004-04 remains **OPEN_NONBLOCKING**

**Phase-2 implementation SHA:** `6413ee48064d0dfed8b90d1204d1d977c2eee8e7`  
**Phase-2 governance checkpoint:** 4ce59d8696c6755c91b5ba3d9217747bc03f0f45

Phase 3 **COMPLETE**.

---

## Phase 3 — Persistence / history ✅ COMPLETE

- [x] **T-004-301** Local-authoritative StrategicPlan store — **DONE**
- [x] **T-004-302** PlanItem store — **DONE** (aggregate-owned + LocalPlanItemStore list adapter)
- [x] **T-004-303** Append-only plan history store — **DONE**
- [x] **T-004-304** Brief reader adapter (read-only SPEC-003) — **DONE**
- [x] **T-004-305** Tenant-safe write units — **DONE**
- [x] **T-004-306** Idempotent create/approve/activate — **DONE** (durable + reload)
- [x] **T-004-307** Actor/audit from trusted context — **DONE**
- [x] **T-004-308** Infrastructure architecture tests — **DONE**

**Phase 3 IDs:** T-004-301 … T-004-308 — **ALL DONE**  
Firestore Plan rules = FUTURE / SPEC-009

**Exit:** LOCAL_AUTHORITATIVE persistence; ports backed; no UI/consumer. **MET**

**Evidence:**
- Infrastructure: `src/infrastructure/strategicPlan/` (LocalStrategicPlanStore/Repository, LocalPlanItemStore, History, BriefReader)
- Tests: `tests/strategicPlanPhase3.test.ts` (14) · `tests/strategicPlanInfrastructureArchitecture.test.ts` (5) · **19/19 PASS**
- Phase-2 regression **32/32 PASS** · Phase-1 **23/23 PASS** · Adjacent **28/28 PASS**
- Full check **1050/1050 PASS** · Rules **91/91 PASS**
- F-004-03 remains **OPEN** (consumer migration Phase 4)
- F-004-04 remains **OPEN_NONBLOCKING**

**Phase-3 implementation SHA:** `e569e67aa78feeade33cccab283e63701c879e52`  
**Phase-3 governance checkpoint:** ca9a6c926fd7cceee975893abc8d0dae896718f0

Phase 4 **COMPLETE**.

---

## Phase 4 — Consumer / strangler migration ✅ COMPLETE

- [x] **T-004-401** Migrate content-generation path through StrategicPlan + AuthorizePlannedAction — **DONE**
- [x] **T-004-402** Migrate opportunity/task creation paths through plan items — **DONE**
- [x] **T-004-403** Migrate delivery materialization to require planned authorization where strategic — **DONE**
- [x] **T-004-404** Demote CurationEntry from Plan authority (COMPATIBILITY intake) — **DONE**
- [x] **T-004-405** Preserve SPEC-003 Brief refs on downstream artifacts — **DONE**
- [x] **T-004-406** Preserve SPEC-006 AuthorizePublication on gated content statuses — **DONE**
- [x] **T-004-407** Consumer architecture tests + migration matrix exit — **DONE**

**Phase 4 IDs:** T-004-401 … T-004-407 — **ALL DONE**

**Exit:** Canonical Plan authority in main consumers; legacy strategic fallbacks = 0. **MET**

**Evidence:**
- Composition: `src/composition/strategicPlan/composeStrategicPlan.ts`
- Consumer: `src/services/strategicPlanConsumer.ts` (`requirePlannedAuthorization`)
- main.ts: `gateStrategicDownstream` → Plan+Brief; Curation demoted; no first-match Brief pick
- Tests: `strategicPlanPhase4.test.ts` (12) · `strategicPlanConsumerArchitecture.test.ts` (8) · **20/20 PASS**
- Regressions: Phase-3 **19/19** · Phase-2 **32/32** · Phase-1 **23/23** · Adjacent **28/28**
- Full check **1070/1070 PASS** · Rules **91/91 PASS**
- F-004-03 = **RESOLVED**
- F-004-04 remains **OPEN_NONBLOCKING**

**Phase-4 implementation SHA:** `65dc7238d62e3ef8b27e518731c2b5528c92da63`  
**Phase-4 governance checkpoint:** d61696f5ac8c2ddb11c2441973b7533e7d11788a

Phase 5 **AUTHORIZED** (2026-08-25) · **COMPLETE**.

---

## Phase 5 — Security / adversarial ✅ COMPLETE

- [x] **T-004-501** Architecture bans (Domain purity; no UI status authority; no `[0]`) — **DONE**
- [x] **T-004-502** Cross-tenant plan/Brief deny matrix — **DONE**
- [x] **T-004-503** AI self-approval / role spoof deny tests — **DONE**
- [x] **T-004-504** Stale/superseded Brief + unauthorized action tests — **DONE**
- [x] **T-004-505** History-as-authority / forged status tests — **DONE**
- [x] **T-004-506** Legacy curation bypass inventory = 0 — **DONE**
- [x] **T-004-507** SPEC-003 regression (Brief frozen) — **DONE**
- [x] **T-004-508** SPEC-005 regression (advisory only; no paid AI) — **DONE**
- [x] **T-004-509** SPEC-006 regression (publication authority preserved) — **DONE**
- [x] **T-004-510** SPEC-001/002 regression + no thesis fallback — **DONE**

**Threat coverage T-004-01…17 = 17/17 PASS** (evidence in `threat-model.md`)  
**Phase 5 IDs:** T-004-501 … T-004-510

**Evidence:**
- Adversarial: `tests/strategicPlanPhase5.test.ts` (**38**)
- Security architecture: `tests/strategicPlanSecurityArchitecture.test.ts` (**12**)
- Phase-5 focused = **50/50 PASS**
- Regressions: Phase-4 **20/20** · Phase-3 **19/19** · Phase-2 **32/32** · Phase-1 **23/23** · Adjacent **28/28**
- Product fixes = **0** (tests-only)
- F-004-04 remains **OPEN_NONBLOCKING**
- SPEC-009 PRODUCTION = **DEFERRED_UNCHANGED**

**Phase-5 security implementation SHA:** `51a64bc4cd528531c7b5887979bd59c919236191`  
**Phase-5 governance checkpoint:** `24482dc2e51c146051c2afb8b053626b81fb8a08`

Phase 6 **AUTHORIZED** (2026-08-25) · evidence **COMPLETE** · human gate **PENDING**.

---

## Phase 6 — Acceptance / CODE_COMPLETE ✅ EVIDENCE COMPLETE

- [x] **T-004-601** Consolidate A1–A42 evidence matrix — **DONE**
- [x] **T-004-602** `npm run check` PASS — **DONE** (1120/1120 fresh)
- [x] **T-004-603** `npm run test:rules` PASS — **DONE** (91/91 fresh)
- [ ] **T-004-604** Human CODE_COMPLETE sign-off — **PENDING** (separate from T-004-010)
- [x] **T-004-605** Confirm DEPLOYED/DONE remain NO / NOT_STARTED — **DONE**

**Phase 6 IDs:** T-004-601 … T-004-605

**Evidence:**
- A1–A42 = **42/42 PASS** · 0 PARTIAL · 0 FAIL · 0 PENDING
- Cross-SPEC: SPEC-001 **68/68** · SPEC-002 **63/63** · SPEC-003 **43/43** · SPEC-005 **24/24** · SPEC-006 **35/35**
- Phase regressions: P5 **50/50** · P4 **20/20** · P3 **19/19** · P2 **32/32** · P1 **23/23** · Adjacent **28/28**
- Threats **17/17 PASS** · F-004-03 **RESOLVED** · F-004-04 **OPEN_NONBLOCKING**
- Product changes **0** · Test changes **0**
- CODE_COMPLETE_CANDIDATE = **YES** · CODE_COMPLETE = **NO** (T-004-604 pending)

**Phase-6 acceptance evidence SHA:** _(recorded at commit)_

Human sign-off task T-004-604 remains **PENDING**. Do not mark DONE without explicit human approval.

---

## Deployment (SEPARATE AUTHORIZATION — NOT STARTED)

- [ ] **D1** Remote persistence / rules plan with SPEC-009
- [ ] **D2** Production deploy authorization
- [ ] **D3** Post-deploy verification

**D1â€“D3 = PENDING_DEPLOYMENT_ONLY** Â· SPEC-009 PRODUCTION = **DEFERRED_UNCHANGED**

---

## Out of scope (explicit)

- SPEC-003 / 001 / 002 / 005 / 006 product changes
- SPEC-009 production rules / auth claims changes
- Phase 1 before T-004-010
- New AiOperation without SPEC-005 coordination
- Production plan backfill

---

## Deferred debt register (Phase 0)

| ID | Item | Status |
|----|------|--------|
| D-004-01 | Remote Firestore StrategicPlan rules | **DEFERRED_TO_SPEC-009** |
| D-004-02 | New SPEC-005 AiOperation `PLAN_SUGGEST` | **PROPOSED_FUTURE_NONBLOCKING** |
| D-004-03 | Historical curationâ†’plan backfill | **OUT_OF_SCOPE** Phase 1â€“6 |
| D-004-04 | Multi-Brief aggregated plans | **OUT_OF_SCOPE** (fail closed) |
| D-004-05 | Rename legacy curation modules | **DEFERRED** (F-004-04) â€” nonblocking |

---

## Task ID inventory (all newly authored)

```text
Phase 0:  T-004-001 â€¦ T-004-010
Phase 1:  T-004-101 â€¦ T-004-110
Phase 2:  T-004-201 â€¦ T-004-211
Phase 3:  T-004-301 â€¦ T-004-308
Phase 4:  T-004-401 â€¦ T-004-407
Phase 5:  T-004-501 â€¦ T-004-510
Phase 6:  T-004-601 â€¦ T-004-605
Deploy:   D1, D2, D3
```

**Total authored task IDs:** 10 + 10 + 11 + 8 + 7 + 10 + 5 = **61** (+ 3 deploy)

**Phase-0 governance checkpoint:** `c851d4070151e3927bb3dd3c1e2628d1faddf2da` on `spec/004-strategic-planner`
