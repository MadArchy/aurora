# Plan 008 — Learning Loop

| Field | Value |
|-------|--------|
| **Spec** | `008-learning-loop` |
| **Phase** | Phase 0 **COMPLETE** · implementation **NOT_STARTED** · deployment **NOT_STARTED** |
| **Status** | **`DRAFT`** · Human SPEC approval **PENDING** (T-008-010) |
| **Strategy** | **Strangler / Incremental Migration** — **NO BIG-BANG REWRITE** |
| **Baseline SHA** | SPEC-007 CODE_COMPLETE `5d084ea9274909fb3f1d1eb2f51a084ec3a1f4c0` |
| **Branch** | `spec/008-learning-loop` |

---

## Why incremental

Working partial learning flows already exist:

- `SignalOutcome` / `ResultRecord` / `FeedbackEvent` in `dbService` + localStorage
- pure domain helpers: `radarFeedbackCore`, `thesisMetricsCore`, `kpiWeekly`
- UI outcome buttons + thesis learning block + KPI chart
- **unsafe:** `feedbackScoringHints` wired into SPEC-001/002 scoring context + post-outcome mass rescore

Debt is **missing Learning Loop ownership + StrategicRecommendation + human approval gate**, not absence of any feedback path.

Therefore:

1. Phase 0 — Formal package + authority model — **THIS PHASE**
2. Phase 1 — Domain (`LearningObservation`, evidence, `StrategicRecommendation`, lifecycle)
3. Phase 2 — Application use cases + ports + target-SPEC dispatch contracts
4. Phase 3 — Local-authoritative persistence + append-only history
5. Phase 4 — Consumer / db/UI/main strangler; **remove P0 auto-rescore path**
6. Phase 5 — Security / adversarial
7. Phase 6 — Acceptance + human CODE_COMPLETE
8. Deployment D1–D3 — separate; SPEC-009 production DEFERRED

---

## Dependencies

| Dependency | State | Impact |
|------------|-------|--------|
| SPEC-007 Opportunity Scout | **CODE_COMPLETE** @ `5d084ea` · **FROZEN** | Read-only Opportunity outcome input |
| SPEC-004 Strategic Planner | **CODE_COMPLETE** · **FROZEN** | Read-only Plan execution results |
| SPEC-003 Strategic Brief | **CODE_COMPLETE** · **FROZEN** | Read-only Brief performance context |
| SPEC-001 routing | **CODE_COMPLETE** | Read-only; **remove hint authority** in Phase 4 |
| SPEC-002 scoring | **CODE_COMPLETE** | Read-only; **remove silent mutation** in Phase 4 |
| SPEC-005 AI Gateway | **CODE_COMPLETE** | Advisory only; no new AiOperation in Phase 0 |
| SPEC-006 Claim linking | **CODE_COMPLETE** · **FROZEN** | Read-only claim/evidence projections |
| SPEC-009 security | **CODE_AVAILABLE**; production **DEFERRED** | NONBLOCKING for 008 local CODE_COMPLETE |

---

## Strangler target

```text
CURRENT (legacy / unsafe):
  UI outcome click → dbService.recordSignalOutcome (replace-by-signalId)
    → feedbackScoringHints → scoringContext → mass rescore (P0)
  UI addResult → dbService.addResult
  ClientWorkspace → computeThesisLearningMetrics (display-only OK)

TARGET:
  Stage A:
    Results/outcomes → RegisterLearningObservation (append-only)
      → BuildLearningEvidence / BuildLearningAssessment
  Stage B:
    LearningEvidence → GenerateStrategicRecommendation (PROPOSED)
      → ReviewStrategicRecommendation
      → Approve/Reject (trusted HUMAN)
      → ApplyApprovedRecommendation → TARGET SPEC apply port
  Legacy:
    feedbackScoringHints → DISPLAY_ONLY advisory OR REMOVED from scoring path
    mass rescore on outcome → REMOVED
```

---

## Phase plan

### Phase 0 — Formal package ✅ COMPLETE

- Author governance docs (this package)
- Define Stage A/B authority model
- Resolve P0 auto-learning design
- Define StrategicRecommendation lifecycle + human gate
- Define cross-SPEC boundaries (especially SPEC-002)
- Inventory legacy surfaces + migration matrix
- Define tasks, acceptance, threats
- Human SPEC approval **PENDING**

**Exit:** Package authored · Human approval **PENDING** · Phase 1 **NOT AUTHORIZED**

### Phase 1 — Domain

- `LearningObservation`, `LearningEvidence`, `LearningAssessment`, `StrategicRecommendation`
- Recommendation lifecycle state machine
- Tenant / multi-thesis validators
- Outcome immutability (append + supersession semantics)
- Materiality / versioning rules
- Explainability projections
- Domain purity tests

**Exit:** Domain COMPLETE · Phase 2 authorized after Phase 1

### Phase 2 — Application / ports

- RegisterLearningObservation, BuildLearningEvidence, GenerateStrategicRecommendation
- Review / Approve / Reject / ApplyApprovedRecommendation
- Trusted actor + tenant envelope
- Ports: LearningRepository, RecommendationRepository, History, TargetSpecApplyPort(s)
- **No** direct SPEC-002 storage writes from 008 Application

**Exit:** Application COMPLETE · Phase 3 authorized

### Phase 3 — Persistence

- Local-authoritative learning + recommendation stores
- Append-only history
- Schema version + fail-closed parse
- Idempotency store
- Tenant-safe keys `(organizationId, clientId, …)`

**Exit:** Persistence COMPLETE · Phase 4 authorized

### Phase 4 — Consumer / legacy migration

- Demote `dbService` outcome/result authority
- UI intent-only path via consumer/composition
- **Remove** `feedbackScoringHints` from scoring/routing authority path
- **Remove** post-outcome mass rescore
- Wire Opportunity outcome ingestion (read-only from SPEC-007)
- Preserve display-only thesis metrics where appropriate

**Exit:** P0 runtime remediated · Phase 5 authorized

### Phase 5 — Security / adversarial

- Threat suites T-008-01…
- Caller/UI/AI spoof matrix
- Target-SPEC bypass tests
- History replay / latest-outcome authority tests

### Phase 6 — Acceptance + CODE_COMPLETE

- A1–A38 full PASS
- Human T-008-604 CODE_COMPLETE gate

### Deployment (separate)

| Task | Purpose |
|------|---------|
| **D1** | Firestore learning/recommendation rules design review (SPEC-009 coordination) |
| **D2** | Remote sync / backfill strategy |
| **D3** | Production cutover verification |

---

## AUDIT008 disposition (Phase 0 → Phase 5)

| ID | Phase 0 disposition | Phase 5 disposition (fresh evidence) |
|----|---------------------|--------------------------------------|
| AUDIT008-01 | **RESOLVED** — formal package created | **RESOLVED** |
| AUDIT008-02 | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** | **DESIGN_RESOLVED · IMPLEMENTATION_PENDING** — no threat mapping, no Phase-5 task owns it |
| AUDIT008-03 | **RUNTIME_OPEN_P0** + **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** | **RESOLVED** (runtime + design) — T-008-09/10/23 PASS · P0 = 0 |
| AUDIT008-04 | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** | **RESOLVED** — T-008-04 PASS |
| AUDIT008-05 | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** | **RESOLVED** — T-008-02 PASS |
| AUDIT008-06 | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** | **RESOLVED** — T-008-17 PASS |
| AUDIT008-07 | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** | **DESIGN_RESOLVED · IMPLEMENTATION_PENDING** — no threat mapping, no Phase-5 task owns it |
| AUDIT008-08 | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** | **DESIGN_RESOLVED · IMPLEMENTATION_PARTIAL** — approval UI runtime closure unassigned in Phase 5; deferred to Phase 6 |
| AUDIT008-09 | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** | **RESOLVED** — T-008-09/11/12 PASS |
| AUDIT008-10 | **RESOLVED** — formal T-008 + acceptance + threat package | **RESOLVED** |
| AUDIT008-11 | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** | **RESOLVED** — T-008-05/06 PASS |
| AUDIT008-12 | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** | **DESIGN_RESOLVED · IMPLEMENTATION_PENDING** — no threat mapping, no Phase-5 task owns it |

**RUNTIME P0 after Phase 0:** **1** (expected — implementation not authorized)  
**RUNTIME P0 after Phase 5:** **0**  
**PHASE-0 DESIGN BLOCKERS:** **0**  
**P0 / P1 after Phase 5:** **0 / 0** — no new P0 or P1 introduced

Findings without a formal threat mapping in `threat-model.md` are **not** closed by
Phase 5: repository truth assigns them no Phase-5 task, and closing them without
evidence would be manufactured.
