# Tasks 008 — Learning Loop

**Spec status:** `DRAFT` · Phase 0 **COMPLETE** · Phase 1 **NOT AUTHORIZED**  
**Implementation:** **NOT_STARTED** · **CODE_COMPLETE = NO** · DEPLOYED **NO** · DONE **NO**  
**Branch:** `spec/008-learning-loop`  
**Base SHA:** SPEC-007 CODE_COMPLETE `5d084ea9274909fb3f1d1eb2f51a084ec3a1f4c0`  
**Upstream SPEC-007:** `5d084ea9274909fb3f1d1eb2f51a084ec3a1f4c0` · **FROZEN**  
**Human SPEC approval:** **PENDING** (T-008-010)  
**Phase-0 package SHA:** *(recorded after commit)*  
**Phase-0 checkpoint SHA:** *(recorded after commit)*

Status legend: `TODO` · `DOING` · `DONE` · `BLOCKED` · `PENDING`

Requirement ID prefix (future Domain): `LRN-008-001` …

---

## Phase 0 — Formal SPEC package ✅ COMPLETE (governance)

- [x] **T-008-001** Create `specs/008-learning-loop/` directory — **DONE**
- [x] **T-008-002** Author `spec.md` (purpose, Stage A/B, authority, P0 design) — **DONE**
- [x] **T-008-003** Author `plan.md` (strangler, phases, AUDIT008 disposition) — **DONE**
- [x] **T-008-004** Author `tasks.md` (this file) — **DONE**
- [x] **T-008-005** Author `acceptance.md` (A1–A38 + deploy separation) — **DONE**
- [x] **T-008-006** Author `data-flow.md` + `hexagonal-boundaries.md` — **DONE**
- [x] **T-008-007** Author `migration-matrix.md` (legacy + feedbackScoringHints fate) — **DONE**
- [x] **T-008-008** Author `learning-model.md` + `strategic-recommendation.md` — **DONE**
- [x] **T-008-009** Author `threat-model.md` — **DONE**
- [ ] **T-008-010** Human SPEC approval → status `APPROVED` — **PENDING**

**Phase 0 gate:** Package authored · Human SPEC approval **PENDING**

**Exit:** Formal package complete · Phase 1 **NOT AUTHORIZED** until T-008-010 DONE.

**Newly authored Phase 0 IDs:** T-008-001 … T-008-010

**Required human approval statement (T-008-010) — exact text required:**

> «Apruebo formalmente SPEC-008 — Learning Loop y autorizo el cierre de T-008-010 y el inicio de la Phase 1 de implementación.»

**FORMAL SPEC APPROVAL:** PENDING · **PHASE-1 AUTHORIZATION:** NO

---

## Phase 1 — Domain contracts (NOT AUTHORIZED)

- [ ] **T-008-101** Define `LearningObservation` aggregate + append/supersession semantics — **TODO**
- [ ] **T-008-102** Define `LearningEvidence` + `LearningAssessment` projections — **TODO**
- [ ] **T-008-103** Define `StrategicRecommendation` aggregate + recommendation types — **TODO**
- [ ] **T-008-104** Canonical recommendation lifecycle state machine — **TODO**
- [ ] **T-008-105** Tenant isolation pure validators (org|client|id) — **TODO**
- [ ] **T-008-106** Multi-thesis scope predicates (no primary/[0]) — **TODO**
- [ ] **T-008-107** Human approval gate predicates (no AI/UI/caller approval) — **TODO**
- [ ] **T-008-108** Materiality / supersession / version rules — **TODO**
- [ ] **T-008-109** Explainability projection shapes + reason codes — **TODO**
- [ ] **T-008-110** Domain unit tests + architecture purity tests — **TODO**

**Phase 1 IDs:** T-008-101 … T-008-110  
**Depends on:** T-008-010 DONE  
**Maps to:** A1–A12, A21, A30, A35  

**Exit:** Phase 1 Domain COMPLETE · Phase 2 **AUTHORIZED** after Phase 1.

---

## Phase 2 — Application / ports (NOT AUTHORIZED)

- [ ] **T-008-201** `RegisterLearningObservation` / `SupersedeLearningObservation` — **TODO**
- [ ] **T-008-202** `BuildLearningEvidence` / `BuildLearningAssessment` — **TODO**
- [ ] **T-008-203** `GenerateStrategicRecommendation` — **TODO**
- [ ] **T-008-204** `ReviewStrategicRecommendation` — **TODO**
- [ ] **T-008-205** `ApproveStrategicRecommendation` / `RejectStrategicRecommendation` — **TODO**
- [ ] **T-008-206** `ApplyApprovedRecommendation` + TargetSpecApplyPort registry — **TODO**
- [ ] **T-008-207** `GetLearningMetrics` / `ListStrategicRecommendations` (tenant-safe) — **TODO**
- [ ] **T-008-208** Trusted actor + tenant context; caller snapshot ignore — **TODO**
- [ ] **T-008-209** Ports: Observation/Evidence/Recommendation/History/Decision/TargetApply — **TODO**
- [ ] **T-008-210** Application architecture purity tests — **TODO**
- [ ] **T-008-211** Application use-case tests (spoof/deny matrix) — **TODO**

**Phase 2 IDs:** T-008-201 … T-008-211  
**Depends on:** Phase 1 DONE  
**Maps to:** A8–A16, A22, A28–A29, A33  

**Exit:** Phase 2 Application COMPLETE · Phase 3 **AUTHORIZED** after Phase 2.

---

## Phase 3 — Persistence (NOT AUTHORIZED)

- [ ] **T-008-301** Local-authoritative LearningObservation store — **TODO**
- [ ] **T-008-302** Local-authoritative LearningEvidence store — **TODO**
- [ ] **T-008-303** Local-authoritative StrategicRecommendation store — **TODO**
- [ ] **T-008-304** Append-only LearningHistory + RecommendationDecision adapters — **TODO**
- [ ] **T-008-305** Idempotency store — **TODO**
- [ ] **T-008-306** Schema version + fail-closed parse — **TODO**
- [ ] **T-008-307** Legacy compat readers (`signal_outcomes`, `results`) — **TODO**
- [ ] **T-008-308** Persistence + infrastructure architecture tests — **TODO**

**Phase 3 IDs:** T-008-301 … T-008-308  
**Depends on:** Phase 2 DONE  
**Maps to:** A17–A20, A31–A32  

**Exit:** Phase 3 Persistence COMPLETE · Phase 4 **AUTHORIZED** after Phase 3.

---

## Phase 4 — Consumer / legacy migration (NOT AUTHORIZED)

- [ ] **T-008-401** `composeLearningLoop` + `learningLoopConsumer` facade — **TODO**
- [ ] **T-008-402** Demote `dbService.recordSignalOutcome` / `addResult` authority — **TODO**
- [ ] **T-008-403** Migrate `main.ts` outcome + result handlers to consumer intents — **TODO**
- [ ] **T-008-404** Migrate `ClientWorkspace` outcome UI to intent-only — **TODO**
- [ ] **T-008-405** **Remove P0:** `feedbackScoringHints` from scoring/routing path — **TODO**
- [ ] **T-008-406** **Remove P0:** post-outcome mass rescore — **TODO**
- [ ] **T-008-407** Wire Opportunity outcome read-only ingest (SPEC-007) — **TODO**

**Phase 4 IDs:** T-008-401 … T-008-407  
**Depends on:** Phase 3 DONE  
**Maps to:** A23–A27, A34, A36  

**Exit:** P0 runtime remediated · Phase 5 **AUTHORIZED** after Phase 4.

---

## Phase 5 — Security / adversarial (NOT AUTHORIZED)

- [ ] **T-008-501** Threat suite T-008-01…18 implementation — **TODO**
- [ ] **T-008-502** Tenant spoof / same-ID cross-tenant matrix — **TODO**
- [ ] **T-008-503** Caller/UI/AI approval spoof matrix — **TODO**
- [ ] **T-008-504** Target-SPEC bypass / apply-before-approval matrix — **TODO**
- [ ] **T-008-505** History replay / latest-outcome authority tests — **TODO**
- [ ] **T-008-506** Malformed persistence / stale write / idempotency replay — **TODO**
- [ ] **T-008-507** feedbackScoringHints bypass regression — **TODO**
- [ ] **T-008-508** Auto-rescore regression — **TODO**
- [ ] **T-008-509** Cross-SPEC authority theft regression (001/002/007) — **TODO**
- [ ] **T-008-510** Security architecture purity tests — **TODO**

**Phase 5 IDs:** T-008-501 … T-008-510  
**Depends on:** Phase 4 DONE  
**Maps to:** A37–A38  

**Exit:** Threats PASS · Phase 6 **AUTHORIZED** after Phase 5.

---

## Phase 6 — Acceptance / CODE_COMPLETE (NOT AUTHORIZED)

- [ ] **T-008-601** Run full acceptance matrix A1–A38 — **TODO**
- [ ] **T-008-602** Full check + rules regression — **TODO**
- [ ] **T-008-603** Evidence bundle + governance closure doc — **TODO**
- [ ] **T-008-604** Human CODE_COMPLETE approval — **TODO**

**Phase 6 IDs:** T-008-601 … T-008-604  
**Depends on:** Phase 5 DONE  

**Required human CODE_COMPLETE statement (T-008-604) — future:**

> «Apruebo formalmente el CODE_COMPLETE de SPEC-008 — Learning Loop y autorizo el cierre de T-008-604.»

**Exit:** CODE_COMPLETE **YES** · FREEZE candidate · deployment still **NOT_STARTED**

---

## Deployment (separate — NOT AUTHORIZED)

| Task | Title | Status |
|------|-------|--------|
| **D1** | Firestore learning/recommendation rules design (SPEC-009 coordination) | **NOT_STARTED** |
| **D2** | Remote sync / backfill strategy | **NOT_STARTED** |
| **D3** | Production cutover verification | **NOT_STARTED** |

Deployment requires separate authorization. SPEC-009 production remains **DEFERRED_UNCHANGED**.

---

## Summary task counts

| Phase | ID range | Count | Status |
|-------|----------|-------|--------|
| 0 | T-008-001…010 | 10 | 9 DONE · 1 PENDING |
| 1 | T-008-101…110 | 10 | TODO |
| 2 | T-008-201…211 | 11 | TODO |
| 3 | T-008-301…308 | 8 | TODO |
| 4 | T-008-401…407 | 7 | TODO |
| 5 | T-008-501…510 | 10 | TODO |
| 6 | T-008-601…604 | 4 | TODO |
| Deploy | D1–D3 | 3 | NOT_STARTED |

**Total formal tasks:** 63 (60 implementation + 3 deployment)
