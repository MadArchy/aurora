# Data flow 008 — Learning Loop

**Phase 0 design.** No consumer migration in this phase.

---

## Constitutional flow

```text
PUBLICATION / OPPORTUNITY EXECUTION
      ↓
RESULTS (SignalOutcome, ResultRecord, FeedbackEvent, Opportunity terminals)
      ↓
LEARNING (Stage A — observations, evidence, assessment)
      ↓
STRATEGIC RECOMMENDATION (Stage B — proposal + human gate)
      ↓
TARGET SPEC APPLICATION (owned mutation)
```

---

## Stage A — Learning / Observation

```text
Trusted tenant + actor context
  → RegisterLearningObservation (append-only)
  → (optional) SupersedeLearningObservation (explicit correction)
  → BuildLearningEvidence
  → BuildLearningAssessment / GetLearningMetrics
  → (optional) GenerateStrategicRecommendation draft from evidence
```

**Input registration sources:**

| Trigger | Legacy path | Target path |
|---------|-------------|-------------|
| Manager marks signal useful/not | `main.ts` → `recordSignalOutcome` | Consumer → `RegisterLearningObservation` |
| Manager/client adds KPI result | `main.ts` → `addResult` | Consumer → `RegisterLearningObservation` |
| Client content feedback | `addFeedbackEvent` | Shared input → observation |
| Opportunity accepted/declined/complete | SPEC-007 consumer projection | Read-only ingest → observation |

**Forbidden shortcuts:**

- Observation → `feedbackScoringHints` → scoring mutation
- Observation → mass rescore
- Assessment → thesis/weight mutation

---

## Stage B — Strategic Recommendation

```text
LearningEvidence (+ optional AI advisory summary via SPEC-005)
  → GenerateStrategicRecommendation → PROPOSED
  → ReviewStrategicRecommendation → UNDER_REVIEW
  → ApproveStrategicRecommendation (HUMAN) → APPROVED
     OR RejectStrategicRecommendation (HUMAN) → REJECTED
  → ApplyApprovedRecommendation
  → TargetSpecApplyPort.dispatch
  → APPLIED | APPLY_FAILED | APPROVED_NOT_APPLIED
```

---

## Current unsafe path (P0 — runtime open)

```text
ClientWorkspace / main.ts
  → dbService.recordSignalOutcome (replace-by-signalId)
  → feedbackScoringHints(signals, outcomes)
  → scoringContext / DbStrategicSignalRoutingAdapter
  → scoreSignal loop (mass rescore)
```

**Classification:** `LEGACY_UNSAFE_TO_REMOVE` in Phase 4.

---

## Target safe path (post Phase 4)

```text
UI intent (outcome button)
  → learningLoopConsumer
  → RegisterLearningObservation
  → (async/batch) BuildLearningEvidence
  → UI displays assessment metrics (DISPLAY_ONLY)
  → (separate workflow) GenerateStrategicRecommendation when warranted
  → human approval workflow
  → optional apply via target SPEC
```

No automatic rescore on outcome registration.

---

## Side-effect ordering

| Action | Prerequisite | Side effect |
|--------|--------------|-------------|
| Register observation | trusted tenant+actor | append observation + history |
| Supersede observation | prior ACTIVE observation | new observation + mark superseded |
| Build evidence | ≥1 observation | evidence record |
| Propose recommendation | evidence + domain rules | recommendation PROPOSED |
| Approve recommendation | PROPOSED/UNDER_REVIEW + HUMAN | decision record + APPROVED |
| Apply recommendation | APPROVED + target port available | target SPEC mutation + APPLIED |
| Reject recommendation | PROPOSED/UNDER_REVIEW + HUMAN | decision record + REJECTED |

**Observation registration → strategic mutation = 0 side effects.**

**Unapproved recommendation → target mutation = 0 side effects.**

---

## Cross-SPEC read flows

```text
SPEC-007 Opportunity (READ_ONLY)
  → accepted / declined / submitted / completed / archived
  → RegisterLearningObservation (OPPORTUNITY_OUTCOME)

SPEC-002 Strategic Score snapshot (READ_ONLY)
  → included in evidence metrics — no writeback

SPEC-001 routing snapshot (READ_ONLY)
  → routing override counts in assessment — no reroute

SPEC-006 claimSafety on content (READ_ONLY)
  → claimBlocks in assessment
```

---

## UI data flow (target)

```text
UI → consumer.getLearningMetrics(clientId, thesisScope)  [DISPLAY]
UI → consumer.registerObservationIntent(payload)           [INTENT]
UI → consumer.listRecommendations(clientId)                [DISPLAY]
UI → consumer.approveRecommendationIntent(id)            [INTENT → Application]
```

UI never writes `dbService` learning mutators directly.

---

## Persistence flow (Phase 3 target)

```text
Application
  → LearningRepository / RecommendationRepository (ports)
  → LocalLearningStore (Infrastructure)
  → postura_learning_observations_v1
  → postura_learning_evidence_v1
  → postura_strategic_recommendations_v1
  → postura_learning_history_v1 (append-only)
```

Legacy keys remain COMPATIBILITY until Phase 4 migration completes.

Firestore sync secondary — not production-activated in Phases 1–6.
