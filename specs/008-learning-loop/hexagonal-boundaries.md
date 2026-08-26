# Hexagonal boundaries 008 — Learning Loop

**Phase 0 design.**

---

## Target layering

```text
Interfaces / UI (ClientWorkspace, ManagerCockpit, KpiWeeklyChart, main.ts)
        — intent / display only
        ↓
Composition seam (composeLearningLoop / learningLoopConsumer)
        ↓
Application (RegisterObservation / BuildEvidence / GenerateRecommendation /
             Approve / Reject / ApplyApproved / GetMetrics)
        ↓
Domain (learningObservationCore, learningEvidenceCore, learningAssessmentCore,
        strategicRecommendationCore, recommendationLifecycleCore,
        learningTenantCore, learningMaterialityCore)
        ↑
Ports ← Infrastructure (local stores, history, clock, trusted actor,
                        TargetSpecApplyPort adapters, optional LearningAdvisorPort → SPEC-005)
```

**Rule:** Consumer asks Application. UI does not approve or apply from displayed status alone.

---

## Domain (pure)

**Owns:** Observation / Evidence / Assessment / Recommendation types · recommendation lifecycle transitions · tenant validators · multi-thesis scope validators · immutability/supersession rules · explainability shapes · materiality rules · idempotency key shapes

**Must not:** Import Firebase, localStorage, React, fetch, AI SDKs · Mutate thesis/routing/scoring · Approve Brief/Plan/Opportunity · Call SPEC-002 scoring engine · Parse JWT · Invoke `feedbackScoringHints` as authority

---

## Application

**Owns:** Use case orchestration · Trusted actor + clock · Ports · Idempotency · Ignore caller snapshots · Dispatch to TargetSpecApplyPort only after APPROVED

**Must not:** Import concrete `db.ts` / React · Direct provider calls · Write SPEC-002 storage · Auto-apply learning to scoring · Bypass human approval gate · Embed mass-rescore loop

---

## Ports (outbound)

| Port | Purpose |
|------|---------|
| `LearningObservationRepository` | Current observation projections (tenant-keyed) |
| `LearningEvidenceRepository` | Evidence bundles |
| `StrategicRecommendationRepository` | Current recommendation projections |
| `LearningHistoryPort` | Append-only material history |
| `RecommendationDecisionRepository` | Append-only human decisions |
| `TrustedActorContext` / `Clock` / `IdGenerator` | Trust + time + ids |
| `TargetSpecApplyPort` (registry) | Dispatch approved changes to owning SPEC |
| `StrategicScoringApplyPort` | Future SPEC-002 apply boundary |
| `StrategicRoutingApplyPort` | Future SPEC-001 apply boundary (if ever) |
| `OpportunityOutcomeReader` | Read-only SPEC-007 outcome projections |
| `LearningAdvisorPort` (optional) | Advisory suggestions via SPEC-005 — never authoritative |

---

## Infrastructure (Phase 3+)

- Local-authoritative observation/evidence/recommendation/history adapters
- Legacy `postura_signal_outcomes_v1` / `postura_results_v5` compatibility readers
- Idempotency store
- No production Firestore learning rule ownership in SPEC-008 Phases 1–6

---

## Consumer (Phase 4+)

- `learningLoopConsumer` facade
- Maps UI intents to Application use cases
- **Demotes** direct `dbService.recordSignalOutcome` / `addResult` authority
- **Removes** wiring of `feedbackScoringHints` into scoring/rescore path

---

## Forbidden dependency counts (Phase 0 baseline → target)

| Layer | Forbidden imports (target) |
|-------|----------------------------|
| Domain → Application/Infrastructure/UI/Firebase/localStorage | **0** |
| Application → Infrastructure/UI/Firebase/db.ts | **0** |
| Domain → `feedbackScoringHints` as scoring authority | **0** |

Current legacy violations documented in `migration-matrix.md` — remediated Phase 4.

---

## Target-SPEC apply boundary

```text
SPEC-008 Application (ApplyApprovedRecommendation)
        ↓
TargetSpecApplyPort (interface owned by 008 ports; implemented by adapter)
        ↓
TARGET SPEC Application use case (owns validation + mutation)
```

SPEC-008 Infrastructure **must not** import SPEC-002 Domain internals for direct weight writes.

---

## AI boundary

```text
[SPEC-005 AI Gateway] --untrusted advisory--> [LearningAdvisorPort]
                                                    ↓
                                            [GenerateStrategicRecommendation]
                                                    ↓
                                            [HUMAN APPROVAL required]
```

AI output never transitions recommendation to APPROVED.
