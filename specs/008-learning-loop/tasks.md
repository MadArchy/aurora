# Tasks 008 — Learning Loop

**Spec status:** `APPROVED` · Phase 0 **COMPLETE** · Phase 1 **COMPLETE** · Phase 2 **AUTHORIZED**  
**Implementation:** Phase 1 Domain **COMPLETE** · **CODE_COMPLETE = NO** · DEPLOYED **NO** · DONE **NO**  
**Branch:** `spec/008-learning-loop`  
**Base SHA:** SPEC-007 CODE_COMPLETE `5d084ea9274909fb3f1d1eb2f51a084ec3a1f4c0`  
**Upstream SPEC-007:** `5d084ea9274909fb3f1d1eb2f51a084ec3a1f4c0` · **FROZEN**  
**Human SPEC approval:** **APPROVED** (T-008-010) — 2026-08-26 (America/Bogota)  
**Phase-0 package SHA:** `deaf797b2aa38d8ef724a0fadb9886de0e848f70`  
**Phase-0 final checkpoint:** `df765fddad41ef4b68da9a5c6d23aa7aa2b3ab24`  
**Phase-1 implementation SHA:** `dd914f200a67becf11282287adf5760ff942e652`  
**Phase-1 final checkpoint:** `de4d7def9fdc386e1f1c962b8439b4a03658d506`

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
- [x] **T-008-010** Human SPEC approval → status `APPROVED` — **DONE** (2026-08-26 America/Bogota)

**Phase 0 gate:** Package authored · Human SPEC approval **DONE**

**Exit:** Formal package complete · Phase 1 **AUTHORIZED** after T-008-010.

**Required human approval statement (T-008-010) — recorded verbatim:**

> «Apruebo formalmente SPEC-008 — Learning Loop y autorizo el cierre de T-008-010 y el inicio de la Phase 1 de implementación.»

**FORMAL SPEC APPROVAL:** APPROVED · **PHASE-1 AUTHORIZATION:** YES · **PHASE-2 AUTHORIZATION:** YES (Phase 2 COMPLETE)

---

## Phase 1 — Domain contracts ✅ COMPLETE

- [x] **T-008-101** Define `LearningObservation` aggregate + append/supersession semantics — **DONE**
- [x] **T-008-102** Define `LearningEvidence` + `LearningAssessment` projections — **DONE**
- [x] **T-008-103** Define `StrategicRecommendation` aggregate + recommendation types — **DONE**
- [x] **T-008-104** Canonical recommendation lifecycle state machine — **DONE**
- [x] **T-008-105** Tenant isolation pure validators (org|client|id) — **DONE**
- [x] **T-008-106** Multi-thesis scope predicates (no primary/[0]) — **DONE**
- [x] **T-008-107** Human approval gate predicates (no AI/UI/caller approval) — **DONE**
- [x] **T-008-108** Materiality / supersession / version rules — **DONE**
- [x] **T-008-109** Explainability projection shapes + reason codes — **DONE**
- [x] **T-008-110** Domain unit tests + architecture purity tests — **DONE**

**Phase 1 IDs:** T-008-101 … T-008-110  
**Depends on:** T-008-010 DONE  
**Maps to:** A1–A12 (partial), A16–A18, A21 (partial), A30, A33 (partial), A35 (partial)

**Domain:** `src/domain/learning{LoopErrors,TenantCore,ThesisScopeCore,ObservationCore,EvidenceCore,strategicRecommendationCore,recommendationLifecycleCore,recommendationDecisionCore,MaterialityCore,ExplainabilityCore,AuthorityCore}.ts`  
**Tests:** `tests/learningLoopDomain.test.ts` · `tests/learningLoopArchitecture.test.ts`  
**Application / Persistence / Consumer migration:** **NONE**  
**Runtime P0 (AUDIT008-03):** **OPEN** — feedbackScoringHints + mass rescore untouched (Phase 4)

**Exit:** Phase 1 Domain COMPLETE · Phase 2 **AUTHORIZED** after Phase 1.

---

## Phase 2 — Application / ports ✅ COMPLETE

- [x] **T-008-201** `RegisterLearningObservation` / `SupersedeLearningObservation` — **DONE**
- [x] **T-008-202** `BuildLearningEvidence` / `BuildLearningAssessment` — **DONE**
- [x] **T-008-203** `GenerateStrategicRecommendation` — **DONE**
- [x] **T-008-204** `ReviewStrategicRecommendation` — **DONE**
- [x] **T-008-205** `ApproveStrategicRecommendation` / `RejectStrategicRecommendation` — **DONE**
- [x] **T-008-206** `ApplyApprovedRecommendation` + TargetSpecApplyPort registry — **DONE**
- [x] **T-008-207** `GetLearningMetrics` / `ListStrategicRecommendations` (tenant-safe) — **DONE**
- [x] **T-008-208** Trusted actor + tenant context; caller snapshot ignore — **DONE**
- [x] **T-008-209** Ports: Observation/Evidence/Recommendation/History/Decision/TargetApply — **DONE**
- [x] **T-008-210** Application architecture purity tests — **DONE**
- [x] **T-008-211** Application use-case tests (spoof/deny matrix) — **DONE**

**Phase 2 IDs:** T-008-201 … T-008-211  
**Depends on:** Phase 1 DONE  
**Maps to:** A8–A16, A22, A28–A29, A33  

**Application:** `src/application/learningLoop/`  
**Tests:** `tests/learningLoopPhase2.test.ts` · `tests/learningLoopApplicationArchitecture.test.ts`  
**Infrastructure / Persistence / Consumer migration:** **NONE**  
**Runtime P0 (AUDIT008-03):** **OPEN** — feedbackScoringHints + mass rescore untouched (Phase 4)

**Exit:** Phase 2 Application COMPLETE · Phase 3 **AUTHORIZED** after Phase 2.

---

## Phase 3 — Persistence ✅ COMPLETE

- [x] **T-008-301** Local-authoritative LearningObservation store — **DONE**
- [x] **T-008-302** Local-authoritative LearningEvidence store — **DONE**
- [x] **T-008-303** Local-authoritative StrategicRecommendation store — **DONE**
- [x] **T-008-304** Append-only LearningHistory + RecommendationDecision adapters — **DONE**
- [x] **T-008-305** Idempotency store — **DONE**
- [x] **T-008-306** Schema version + fail-closed parse — **DONE**
- [x] **T-008-307** Legacy compat readers (`signal_outcomes`, `results`) — **DONE**
- [x] **T-008-308** Persistence + infrastructure architecture tests — **DONE**

**Phase 3 IDs:** T-008-301 … T-008-308  
**Depends on:** Phase 2 DONE  
**Maps to:** A17–A20, A31–A32  

**Infrastructure:** `src/infrastructure/learningLoop/`  
**Tests:** `tests/learningLoopPersistence.test.ts` · `tests/learningLoopInfrastructureArchitecture.test.ts`  
**Consumer migration / runtime P0:** **NONE** (Phase 4)

**Exit:** Phase 3 Persistence COMPLETE · Phase 4 **AUTHORIZED** after Phase 3.

---

## Phase 4 — Consumer / legacy migration ✅ COMPLETE

- [x] **T-008-401** `composeLearningLoop` + `learningLoopConsumer` facade — **DONE**
- [x] **T-008-402** Demote `dbService.recordSignalOutcome` / `addResult` authority — **DONE**
- [x] **T-008-403** Migrate `main.ts` outcome + result handlers to consumer intents — **DONE**
- [x] **T-008-404** Migrate `ClientWorkspace` outcome UI to intent-only — **DONE**
- [x] **T-008-405** **Remove P0:** `feedbackScoringHints` from scoring/routing path — **DONE**
- [x] **T-008-406** **Remove P0:** post-outcome mass rescore — **DONE**
- [x] **T-008-407** Wire Opportunity outcome read-only ingest (SPEC-007) — **DONE**

**Phase 4 IDs:** T-008-401 … T-008-407  
**Depends on:** Phase 3 DONE  
**Maps to:** A23–A27, A34, A36  

**Composition:** `src/composition/learningLoop/composeLearningLoop.ts`  
**Consumer:** `src/services/learningLoopConsumer.ts`  
**Tests:** `tests/learningLoopPhase4.test.ts` · `tests/learningLoopConsumerArchitecture.test.ts`  
**Runtime P0 (AUDIT008-03):** **RESOLVED** — feedbackScoringHints + mass rescore removed from authority path  

**Exit:** P0 runtime remediated · Phase 5 **AUTHORIZED** after Phase 4.

---

## Phase 5 — Security / adversarial (COMPLETE)

- [x] **T-008-501** Threat suite T-008-01…18 implementation — **DONE** (extended to T-008-01…26)
- [x] **T-008-502** Tenant spoof / same-ID cross-tenant matrix — **DONE**
- [x] **T-008-503** Caller/UI/AI approval spoof matrix — **DONE**
- [x] **T-008-504** Target-SPEC bypass / apply-before-approval matrix — **DONE**
- [x] **T-008-505** History replay / latest-outcome authority tests — **DONE**
- [x] **T-008-506** Malformed persistence / stale write / idempotency replay — **DONE**
- [x] **T-008-507** feedbackScoringHints bypass regression — **DONE**
- [x] **T-008-508** Auto-rescore regression — **DONE**
- [x] **T-008-509** Cross-SPEC authority theft regression (001/002/007) — **DONE**
- [x] **T-008-510** Security architecture purity tests — **DONE**

**Phase 5 IDs:** T-008-501 … T-008-510  
**Depends on:** Phase 4 DONE  
**Maps to:** A37–A38  

### Phase 5 evidence

| Suite | File | Tests |
|-------|------|-------|
| Runtime adversarial | `tests/learningLoopPhase5Security.test.ts` | 66 PASS |
| Consumer-boundary adversarial | `tests/learningLoopPhase5Consumer.test.ts` | 13 PASS |
| Security architecture purity | `tests/learningLoopPhase5Architecture.test.ts` | 23 PASS |

**Phase-5 security total:** **79/79 PASS** · **Phase-5 architecture:** **23/23 PASS**  
**Formal threats:** **26/26 PASS** (T-008-01 … T-008-26)  
**Product files modified:** **0** — no Phase-5 defect required a product fix  
**Full check:** 1452/1452 PASS · **Rules:** 91/91 PASS  
**Runtime P0 (AUDIT008-03):** **RESOLVED** (re-verified from fresh Phase-5 evidence)  
**P0:** 0 · **P1:** 0 · new P0/P1 introduced: **0**

**NOT owned by Phase 5:** approval UI runtime closure (AUDIT008-08). No Phase-5 task
assigns it, so it remains **IMPLEMENTATION_PENDING** for Phase 6. No UI was invented.

**Exit:** Threats **26/26 PASS** · Phase 6 **AUTHORIZED** after Phase 5.  
**CODE_COMPLETE:** **NO** (Phase 6) · **DEPLOYMENT:** **NOT_STARTED**

---

## Phase 6 — Acceptance / CODE_COMPLETE (TECHNICAL CLOSURE COMPLETE)

- [x] **T-008-601** Run full acceptance matrix A1–A38 — **DONE**
- [x] **T-008-602** Full check + rules regression — **DONE**
- [x] **T-008-603** Evidence bundle + governance closure doc — **DONE**
- [ ] **T-008-604** Human CODE_COMPLETE approval — **TODO · PENDING HUMAN**

**Phase 6 IDs:** T-008-601 … T-008-604  
**Depends on:** Phase 5 DONE  

### Phase 6 task contract

| ID | Title | Class | Depends on | Acceptance | Product change | Status |
|----|-------|-------|-----------|------------|----------------|--------|
| T-008-601 | Run full acceptance matrix A1–A38 | TECHNICAL | Phase 5 DONE | A1–A38 (closes **A12**) | **NOT AUTHORIZED** — evidence only | **DONE** |
| T-008-602 | Full check + rules regression | TECHNICAL | T-008-601 | **A38** | **NOT AUTHORIZED** | **DONE** |
| T-008-603 | Evidence bundle + governance closure doc | TECHNICAL | T-008-601, T-008-602 | governance closure | **NOT AUTHORIZED** | **DONE** |
| T-008-604 | Human CODE_COMPLETE approval | **HUMAN** | T-008-601…603 | CODE_COMPLETE gate | n/a | **TODO · PENDING HUMAN** |

**No Phase-6 task authorizes product code change.** Phase 6 is closure/evidence only.
**Product files changed in Phase 6: 0.**

### Phase 6 evidence

| Suite | File | Tests |
|-------|------|-------|
| Acceptance matrix evidence | `tests/learningLoopPhase6Acceptance.test.ts` | 14 PASS |

**A12:** PARTIAL → **PASS** — canonical learning runtime fallbacks = 0 · UI learning intents pass
0 actor identity fields · 13/13 residual `main.ts` fallbacks attributed to non-learning
**SPEC-001…007** paths (KNOWN_LIMITATION, out of SPEC-008 scope, frozen — not a blocker).  
**A38:** PENDING → **PASS** — full check **1466/1466 PASS** · rules **91/91 PASS**.

**A1-A38:** **38 PASS / 0 PARTIAL / 0 FAIL / 0 PENDING**  
**Formal threats:** **26/26 PASS** — unchanged; 0 product changes in Phase 6, so no threat re-exposure.  
**P0:** 0 · **P1:** 0 · **P2:** 0 · **P3:** 0 · **Authority bypasses:** 0  
**SPEC-001…007 modifications:** **0** · **SPEC-009 production:** **DEFERRED_UNCHANGED**

**NOT owned by Phase 6 — approval UI (AUDIT008-08):** no Phase-6 task assigns approval UI or
runtime approval closure. The UI intent path in `data-flow.md` § *UI data flow (target)* is **target
design**, not a Phase-6 assignment. No UI was invented. AUDIT008-08 remains
**DESIGN_RESOLVED · IMPLEMENTATION_PARTIAL**. Acceptance impact: **none** — no A-criterion requires
an approval UI to exist; A8/A10 assert the human-gate and zero-UI-authority *properties*, both PASS.
Consequence is a **capability** gap (no in-app manager approval surface yet), tracked for a future
SPEC/phase that formally owns it.

**Exit (pre-human):** technical closure **EVIDENCE_COMPLETE** · `IMPLEMENTATION_COMPLETE` **YES** ·
`CODE_COMPLETE_CANDIDATE` **YES** · `HUMAN SIGNOFF` **PENDING** · `CODE_COMPLETE` **NO** ·
deployment **NOT_STARTED** · `DONE` **NO**

**Required human CODE_COMPLETE statement (T-008-604) — REQUIRED NOW:**

> «Apruebo formalmente el CODE_COMPLETE de SPEC-008 — Learning Loop y autorizo el cierre de T-008-604.»

This statement must be provided by the human owner. It has **not** been given.
No automation may write it, infer it, or mark T-008-604 DONE.

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
| 0 | T-008-001…010 | 10 | 10 DONE |
| 1 | T-008-101…110 | 10 | 10 DONE |
| 2 | T-008-201…211 | 11 | 11 DONE |
| 3 | T-008-301…308 | 8 | 8 DONE |
| 4 | T-008-401…407 | 7 | 7 DONE |
| 5 | T-008-501…510 | 10 | 10 DONE |
| 6 | T-008-601…604 | 4 | 3 DONE · 1 PENDING HUMAN (T-008-604) |
| Deploy | D1–D3 | 3 | NOT_STARTED |

**Total formal tasks:** 63 (60 implementation + 3 deployment)
