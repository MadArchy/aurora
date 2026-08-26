# Tasks 004 — Strategic Planner

**Spec status:** `APPROVED`  
**Implementation:** **PHASE_1_COMPLETE** · Phase 2 **NOT_AUTHORIZED** · DEPLOYED **NO** · DONE **NO** · DEPLOYMENT **NOT_STARTED**  
**Branch:** `spec/004-strategic-planner`  
**Base SHA:** SPEC-006 CODE_COMPLETE `d98c98ca6ee877fc510d3327bd4b1208d74a7b54`  
**Upstream SPEC-003:** `e16280607fa078941078d2cb4c233025a1bd66a1`  
**Phase-0 governance checkpoint:** `6ee32f5e6c303abd98f9b17966bfdffa2a7a0338`  
**Human SPEC approval:** **APPROVED** (T-004-010) — 2026-08-25 (America/Bogota)  
**Approval text:** «Apruebo formalmente SPEC-004 — Strategic Planner y autorizo el cierre de T-004-010 y el inicio de la Phase 1 de implementación.»

Status legend: `TODO` · `DOING` · `DONE` · `BLOCKED` · `PENDING`

Requirement ID prefix (future Domain): `PLAN-004-001` …

---

## Phase 0 — Inventory + formal SPEC package ✅ COMPLETE

- [x] **T-004-001** Create `specs/004-strategic-planner/` directory — **DONE**
- [x] **T-004-002** Author `spec.md` (purpose, authority, boundaries) — **DONE**
- [x] **T-004-003** Author `plan.md` (strangler, phases, dependencies) — **DONE**
- [x] **T-004-004** Author `tasks.md` (this file) — **DONE**
- [x] **T-004-005** Author `acceptance.md` (A1–A42 + deploy separation) — **DONE**
- [x] **T-004-006** Author `data-flow.md` (flows, gates, Brief/claim boundaries) — **DONE**
- [x] **T-004-007** Author `hexagonal-boundaries.md` — **DONE**
- [x] **T-004-008** Author `migration-matrix.md` (legacy planner-adjacent inventory) — **DONE**
- [x] **T-004-009** Author `planner-model.md` + `threat-model.md` — **DONE**
- [x] **T-004-010** Human SPEC approval → status `APPROVED` — **DONE** (2026-08-25 America/Bogota)

**Phase 0 gate:** Package authored · Human SPEC approval **DONE**

**Exit:** Formal package complete · **APPROVED** · Phase 1 **AUTHORIZED** after T-004-010.

**Newly authored Phase 0 IDs:** T-004-001 … T-004-010

---

## Phase 1 — Domain contracts ✅ COMPLETE

- [x] **T-004-101** Define `StrategicPlan` aggregate + Brief/thesis/tenant linkage — **DONE**
- [x] **T-004-102** Define `PlanItem` entity + action bound to Brief.authorizedAction — **DONE**
- [x] **T-004-103** `PlanStatus` / `PlanItemStatus` state machines — **DONE**
- [x] **T-004-104** Tenant isolation pure validators — **DONE**
- [x] **T-004-105** Stale/superseded Brief fail-closed predicates — **DONE**
- [x] **T-004-106** `AuthorizePlannedAction` Domain predicates — **DONE**
- [x] **T-004-107** Materiality / supersession rules — **DONE**
- [x] **T-004-108** Explainability projection shapes — **DONE**
- [x] **T-004-109** Multi-Brief aggregation deny + multi-thesis safety — **DONE**
- [x] **T-004-110** Domain unit tests + architecture purity tests — **DONE**

**Exit:** Domain tests PASS; no Firebase/db/React/provider imports. **MET**

**Evidence:**
- Domain: `strategicPlanCore.ts`, `planItemCore.ts`, `planTenantCore.ts`, `planBriefContextCore.ts`, `planGateCore.ts`, `planMaterialityCore.ts`, `planExplainabilityCore.ts`, `strategicPlanErrors.ts`
- Tests: `tests/strategicPlanDomain.test.ts` (19) · `tests/strategicPlanArchitecture.test.ts` (4) · **23/23 PASS**
- Adjacent legacy regression **28/28 PASS**
- F-004-02 = **RESOLVED**

**Phase 1 IDs:** T-004-101 … T-004-110 — **ALL DONE**

**Phase-1 implementation checkpoint:** pending commit on `spec/004-strategic-planner`

Phase 2 **NOT_AUTHORIZED**.

---

## Phase 2 — Application / governance (NOT AUTHORIZED)

- [ ] **T-004-201** `CreateStrategicPlan` use case
- [ ] **T-004-202** `AddPlanItem` / `RemovePlanItem` use cases
- [ ] **T-004-203** `ProposeStrategicPlan` use case
- [ ] **T-004-204** `ApproveStrategicPlan` / `RejectStrategicPlan` use cases
- [ ] **T-004-205** `ReviseStrategicPlan` use case
- [ ] **T-004-206** `AuthorizePlannedAction` use case (decision only)
- [ ] **T-004-207** `ActivatePlanItem` / `CompletePlanItem` / `CancelPlanItem`
- [ ] **T-004-208** `RevalidatePlanAgainstBrief` use case
- [ ] **T-004-209** Ports: PlanRepository, PlanItemStore, History, BriefReader, Actor, Clock, optional Advisor
- [ ] **T-004-210** Controlled error model
- [ ] **T-004-211** Application hexagonal tests

**RUNTIME ADVISOR = DEFERRED** (PlannerAdvisorPort only; no new AiOperation)  
**Phase 2 IDs:** T-004-201 … T-004-211

---

## Phase 3 — Persistence / history (NOT AUTHORIZED)

- [ ] **T-004-301** Local-authoritative StrategicPlan store
- [ ] **T-004-302** PlanItem store
- [ ] **T-004-303** Append-only plan history store
- [ ] **T-004-304** Brief reader adapter (read-only SPEC-003)
- [ ] **T-004-305** Tenant-safe write units
- [ ] **T-004-306** Idempotent create/approve/activate
- [ ] **T-004-307** Actor/audit from trusted context
- [ ] **T-004-308** Infrastructure architecture tests

**Phase 3 IDs:** T-004-301 … T-004-308  
Firestore Plan rules = FUTURE / SPEC-009

---

## Phase 4 — Consumer / strangler migration (NOT AUTHORIZED)

- [ ] **T-004-401** Migrate content-generation path through StrategicPlan + AuthorizePlannedAction
- [ ] **T-004-402** Migrate opportunity/task creation paths through plan items
- [ ] **T-004-403** Migrate delivery materialization to require planned authorization where strategic
- [ ] **T-004-404** Demote CurationEntry from Plan authority (COMPATIBILITY intake)
- [ ] **T-004-405** Preserve SPEC-003 Brief refs on downstream artifacts
- [ ] **T-004-406** Preserve SPEC-006 AuthorizePublication on gated content statuses
- [ ] **T-004-407** Consumer architecture tests + migration matrix exit

**Phase 4 IDs:** T-004-401 … T-004-407

---

## Phase 5 — Security / adversarial (NOT AUTHORIZED)

- [ ] **T-004-501** Architecture bans (Domain purity; no UI status authority; no `[0]`)
- [ ] **T-004-502** Cross-tenant plan/Brief deny matrix
- [ ] **T-004-503** AI self-approval / role spoof deny tests
- [ ] **T-004-504** Stale/superseded Brief + unauthorized action tests
- [ ] **T-004-505** History-as-authority / forged status tests
- [ ] **T-004-506** Legacy curation bypass inventory = 0
- [ ] **T-004-507** SPEC-003 regression (Brief frozen)
- [ ] **T-004-508** SPEC-005 regression (advisory only; no paid AI)
- [ ] **T-004-509** SPEC-006 regression (publication authority preserved)
- [ ] **T-004-510** SPEC-001/002 regression + no thesis fallback

**Threat coverage T-004-01…17**  
**Phase 5 IDs:** T-004-501 … T-004-510

---

## Phase 6 — Acceptance / CODE_COMPLETE (NOT AUTHORIZED)

- [ ] **T-004-601** Consolidate A1–A42 evidence matrix
- [ ] **T-004-602** `npm run check` PASS
- [ ] **T-004-603** `npm run test:rules` PASS
- [ ] **T-004-604** Human CODE_COMPLETE sign-off — **PENDING** (separate from T-004-010)
- [ ] **T-004-605** Confirm DEPLOYED/DONE remain NO / NOT_STARTED

**Phase 6 IDs:** T-004-601 … T-004-605

---

## Deployment (SEPARATE AUTHORIZATION — NOT STARTED)

- [ ] **D1** Remote persistence / rules plan with SPEC-009
- [ ] **D2** Production deploy authorization
- [ ] **D3** Post-deploy verification

**D1–D3 = PENDING_DEPLOYMENT_ONLY** · SPEC-009 PRODUCTION = **DEFERRED_UNCHANGED**

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
| D-004-03 | Historical curation→plan backfill | **OUT_OF_SCOPE** Phase 1–6 |
| D-004-04 | Multi-Brief aggregated plans | **OUT_OF_SCOPE** (fail closed) |
| D-004-05 | Rename legacy curation modules | **DEFERRED** (F-004-04) — nonblocking |

---

## Task ID inventory (all newly authored)

```text
Phase 0:  T-004-001 … T-004-010
Phase 1:  T-004-101 … T-004-110
Phase 2:  T-004-201 … T-004-211
Phase 3:  T-004-301 … T-004-308
Phase 4:  T-004-401 … T-004-407
Phase 5:  T-004-501 … T-004-510
Phase 6:  T-004-601 … T-004-605
Deploy:   D1, D2, D3
```

**Total authored task IDs:** 10 + 10 + 11 + 8 + 7 + 10 + 5 = **61** (+ 3 deploy)

**Phase-0 governance checkpoint:** `c851d4070151e3927bb3dd3c1e2628d1faddf2da` on `spec/004-strategic-planner`
