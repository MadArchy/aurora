# Tasks 007 — Opportunity Scout

**Spec status:** `APPROVED` · Phase 1–3 **COMPLETE** · Phase 4 **NOT_STARTED**  
**Implementation:** Phase 1–3 **COMPLETE** · DEPLOYED **NO** · DONE **NO** · DEPLOYMENT **NOT_STARTED**  
**Branch:** `spec/007-opportunity-scout`  
**Base SHA:** SPEC-004 CODE_COMPLETE `8661e4a2c272372e4d851bdb01d10f85b447e27c`  
**Upstream SPEC-003:** `e16280607fa078941078d2cb4c233025a1bd66a1`  
**Upstream SPEC-006:** `d98c98ca6ee877fc510d3327bd4b1208d74a7b54`  
**Human SPEC approval:** **APPROVED** (T-007-010) — 2026-08-26 (America/Bogota)  
**Approval text:** «Apruebo formalmente SPEC-007 — Opportunity Scout y autorizo el cierre de T-007-010 y el inicio de la Phase 1 de implementación.»  
**Phase-1 implementation SHA:** `cdcb5a04cf4e97baaaf7db7d7a62dccc15afcc98`  
**Phase-1 checkpoint:** `2899386c1a660e79bf90a15a991ffdcf157567f8`  
**Phase-2 implementation SHA:** `ddd43002c9501b3853744409c343012aae5943ec`  
**Phase-2 checkpoint:** `5eafd7a170791995f31ce647fa1777dea63e16e3`  
**Phase-3 implementation SHA:** `78f5c4dade7c411fd9ce143d69e41d70efa30f4f`  
**Phase-3 checkpoint:** _(this governance pin commit)_

Status legend: `TODO` · `DOING` · `DONE` · `BLOCKED` · `PENDING`

Requirement ID prefix (future Domain): `OPP-007-001` …

---

## Phase 0 — Inventory + formal SPEC package ✅ COMPLETE (governance)

- [x] **T-007-001** Create `specs/007-opportunity-scout/` directory — **DONE**
- [x] **T-007-002** Author `spec.md` (purpose, Stage A/B, authority) — **DONE**
- [x] **T-007-003** Author `plan.md` (strangler, phases, dependencies) — **DONE**
- [x] **T-007-004** Author `tasks.md` (this file) — **DONE**
- [x] **T-007-005** Author `acceptance.md` (A1–A40 + deploy separation) — **DONE**
- [x] **T-007-006** Author `data-flow.md` + `hexagonal-boundaries.md` — **DONE**
- [x] **T-007-007** Author `migration-matrix.md` (legacy Opportunity inventory) — **DONE**
- [x] **T-007-008** Author `opportunity-model.md` (candidate + materialized + lifecycle) — **DONE**
- [x] **T-007-009** Author `opportunity-scoring.md` + `threat-model.md` — **DONE**
- [x] **T-007-010** Human SPEC approval → status `APPROVED` — **DONE** (2026-08-26 America/Bogota)

**Phase 0 gate:** Package authored · Human SPEC approval **DONE**

**Exit:** Formal package complete · **APPROVED** · Phase 1 **AUTHORIZED** after T-007-010.

**Newly authored Phase 0 IDs:** T-007-001 … T-007-010

**Phase-0 package SHA:** `23ba8b2934cb170831621f8186523ae14f88d5d4`  
**Phase-0 final checkpoint:** `551679e9fd562771d1e700807c2b373f0cc07b3d`

**Required human approval statement (T-007-010) — recorded verbatim:**

> «Apruebo formalmente SPEC-007 — Opportunity Scout y autorizo el cierre de T-007-010 y el inicio de la Phase 1 de implementación.»

**FORMAL SPEC APPROVAL:** APPROVED · **PHASE-1 AUTHORIZATION:** YES · **PHASE-2 AUTHORIZATION:** NO

---

## Phase 1 — Domain contracts ✅ COMPLETE

- [x] **T-007-101** Define `OpportunityCandidate` aggregate + tenant/thesis evaluation context — **DONE**
- [x] **T-007-102** Define `OpportunityScore` value object + versioned dimensions — **DONE**
- [x] **T-007-103** Define materialized `Opportunity` aggregate + Brief/Plan/PlanItem linkage — **DONE**
- [x] **T-007-104** Canonical Opportunity lifecycle state machine (unify dual legacy statuses) — **DONE**
- [x] **T-007-105** Tenant isolation pure validators (org|client|id) — **DONE**
- [x] **T-007-106** Multi-thesis evaluation predicates (no primary/[0]) — **DONE**
- [x] **T-007-107** Materialize gate predicates (require SPEC-004 allow decision input) — **DONE**
- [x] **T-007-108** Materiality / supersession / version rules — **DONE**
- [x] **T-007-109** Explainability projection shapes + reason codes — **DONE**
- [x] **T-007-110** Domain unit tests + architecture purity tests — **DONE**

**Phase 1 IDs:** T-007-101 … T-007-110  
**Depends on:** T-007-010 DONE  
**Maps to:** A1–A12, A21, A30  

**Domain:** `src/domain/opportunity{ScoutErrors,TenantCore,ScoreCore,CandidateCore,LifecycleCore,MultiThesisCore,MaterializeGateCore,Core,MaterialityCore,ExplainabilityCore,LegacyMappingCore}.ts`  
**Tests:** `tests/opportunityScoutDomain.test.ts` · `tests/opportunityScoutArchitecture.test.ts`  
**Opportunity Score formal contract:** **APPROVED** (T-007-010) — model `opportunity-score-v1-proposed`  
**Application / Persistence / Consumer migration:** **NONE**

**Exit:** Phase 1 Domain COMPLETE · Phase 2 **AUTHORIZED** after Phase 1.

---

## Phase 2 — Application / ports ✅ COMPLETE

- [x] **T-007-201** `RegisterOpportunityCandidate` / `EvaluateOpportunityCandidate` / `ReevaluateOpportunityCandidate` — **DONE**
- [x] **T-007-202** `RecommendOpportunityCandidate` — **DONE**
- [x] **T-007-203** `MaterializeOpportunity` (SPEC-004 authorization required) — **DONE**
- [x] **T-007-204** `AcceptOpportunity` / `DeclineOpportunity` — **DONE**
- [x] **T-007-205** `UpdateOpportunityChecklist` — **DONE**
- [x] **T-007-206** `SubmitOpportunity` / `CompleteOpportunity` / `ArchiveOpportunity` — **DONE**
- [x] **T-007-207** `GetOpportunity` / `ListOpportunities` (tenant-safe) — **DONE**
- [x] **T-007-208** Trusted actor + tenant context; caller snapshot ignore — **DONE**
- [x] **T-007-209** Ports: CandidateRepository, OpportunityRepository, History, BriefReader, PlanAuth reader, optional Advisor — **DONE**
- [x] **T-007-210** Application architecture purity tests — **DONE**
- [x] **T-007-211** Application use-case tests (spoof/deny matrix) — **DONE**

**Phase 2 IDs:** T-007-201 … T-007-211  
**Depends on:** Phase 1 DONE  
**Maps to:** A8–A11, A13–A16, A22, A28–A29  

**Application:** `src/application/opportunityScout/`  
**Ports:** CandidateRepository · OpportunityRepository · History · BriefReader · StrategicPlanAuthorizationPort · StrategicContextReader · OpportunityAdvisorPort  
**Tests:** `tests/opportunityScoutPhase2.test.ts` · `tests/opportunityScoutApplicationArchitecture.test.ts`  
**Persistence / Consumer migration:** **NONE**

**Exit:** Phase 2 Application COMPLETE · Phase 3 **AUTHORIZED** after Phase 2.

---

## Phase 3 — Persistence ✅ COMPLETE

- [x] **T-007-301** Local-authoritative OpportunityCandidate store — **DONE**
- [x] **T-007-302** Local-authoritative Opportunity store (tenant keys) — **DONE**
- [x] **T-007-303** Append-only Opportunity history adapter — **DONE**
- [x] **T-007-304** SchemaVersion + malformed fail-closed — **DONE**
- [x] **T-007-305** Version conflict / stale write / duplicate-current fail-closed — **DONE**
- [x] **T-007-306** Idempotency keys (create/evaluate/materialize/lifecycle) — **DONE**
- [x] **T-007-307** Legacy `postura_opportunities_v5` read adapter (COMPATIBILITY) — **DONE**
- [x] **T-007-308** Infrastructure architecture purity tests — **DONE**

**Phase 3 IDs:** T-007-301 … T-007-308  
**Depends on:** Phase 2 DONE  
**Maps to:** A17–A19, A39  

**Infrastructure:** `src/infrastructure/opportunityScout/`  
**Keys:** `postura_opportunity_candidate_v1` · `postura_opportunity_v1` · history · idempotency (LOCAL_AUTHORITATIVE; distinct from legacy v5)  
**Legacy:** `LegacyOpportunityV5CompatibilityReader` — COMPATIBILITY_ONLY · ambiguous → MIGRATION_REVIEW_REQUIRED  
**db.ts / consumer / UI:** **NONE**  
**Tests:** `tests/opportunityScoutPersistence.test.ts` · `tests/opportunityScoutInfrastructureArchitecture.test.ts`

**Exit:** Phase 3 Persistence COMPLETE · Phase 4 **NOT AUTHORIZED**.

---

## Phase 4 — Consumer / legacy migration (NOT AUTHORIZED)

- [ ] **T-007-401** Composition root `composeOpportunityScout` + consumer facade
- [ ] **T-007-402** Strangle `main.ts` Opportunity create to Application Materialize
- [ ] **T-007-403** Demote `dbService` Opportunity methods from authority
- [ ] **T-007-404** Migrate OpportunityPanel / ClientPortal to consumer triggers
- [ ] **T-007-405** Preserve SPEC-003/004 gates; no parallel CREATE_OPPORTUNITY
- [ ] **T-007-406** Preserve SPEC-006 publication non-ownership
- [ ] **T-007-407** Consumer architecture bans + adjacent regression suites

**Phase 4 IDs:** T-007-401 … T-007-407  
**Depends on:** Phase 3 DONE  
**Maps to:** A23–A29, A42

---

## Phase 5 — Security / adversarial (NOT AUTHORIZED)

- [ ] **T-007-501** Architecture bans (Domain purity; no UI status authority; no `[0]` thesis)
- [ ] **T-007-502** Cross-tenant Opportunity deny matrix
- [ ] **T-007-503** AI / role / caller snapshot spoof deny
- [ ] **T-007-504** Stale candidate / Opportunity / Brief / Plan authorization tests
- [ ] **T-007-505** History-as-authority / dual-lifecycle ambiguity tests
- [ ] **T-007-506** Legacy db bypass inventory = 0
- [ ] **T-007-507** SPEC-003 / SPEC-004 regression (frozen)
- [ ] **T-007-508** SPEC-005 advisory-only; no paid AI
- [ ] **T-007-509** SPEC-006 publication authority preserved
- [ ] **T-007-510** SPEC-001/002 regression + Opportunity Score ≠ Strategic Score

**Threat coverage T-007-01…18**  
**Phase 5 IDs:** T-007-501 … T-007-510  
**Depends on:** Phase 4 DONE  
**Maps to:** A32–A38

---

## Phase 6 — Acceptance / CODE_COMPLETE (NOT AUTHORIZED)

- [ ] **T-007-601** Consolidate A1–A40 evidence matrix
- [ ] **T-007-602** `npm run check` PASS
- [ ] **T-007-603** `npm run test:rules` PASS
- [ ] **T-007-604** Human CODE_COMPLETE sign-off — **PENDING** (separate from T-007-010)
- [ ] **T-007-605** Confirm DEPLOYED/DONE remain NO / NOT_STARTED

**Phase 6 IDs:** T-007-601 … T-007-605

---

## Deployment (SEPARATE AUTHORIZATION — NOT STARTED)

- [ ] **D1** Remote Opportunity persistence / rules plan with SPEC-009
- [ ] **D2** Production deploy authorization
- [ ] **D3** Post-deploy verification

**D1–D3 = PENDING_DEPLOYMENT_ONLY** · SPEC-009 PRODUCTION = **DEFERRED_UNCHANGED**

---

## Out of scope (explicit)

- SPEC-003 / 001 / 002 / 004 / 005 / 006 product changes
- SPEC-009 production rules / auth claims changes
- Phase 2+ without separate authorization
- New AiOperation without SPEC-005 coordination
- Production opportunity backfill as Phase 1–6 blocker

---

## Deferred debt register (Phase 0)

| ID | Item | Status |
|----|------|--------|
| D-007-01 | Remote Firestore Opportunity rules | **DEFERRED_TO_SPEC-009** |
| D-007-02 | New SPEC-005 AiOperation `OPPORTUNITY_SUGGEST` | **PROPOSED_FUTURE_NONBLOCKING** |
| D-007-03 | Historical OpportunityCandidate backfill from signals | **OUT_OF_SCOPE** Phase 1–6 |
| D-007-04 | Spotlight heuristic redesign | **OPEN_NONBLOCKING** (F-007-08) |

---

## Task ID inventory (newly authored)

```text
Phase 0:  T-007-001 … T-007-010
Phase 1:  T-007-101 … T-007-110
Phase 2:  T-007-201 … T-007-211
Phase 3:  T-007-301 … T-007-308
Phase 4:  T-007-401 … T-007-407
Phase 5:  T-007-501 … T-007-510
Phase 6:  T-007-601 … T-007-605
Deploy:   D1, D2, D3
```

**Total authored task IDs:** 10 + 10 + 11 + 8 + 7 + 10 + 5 = **61** (+ 3 deploy)
