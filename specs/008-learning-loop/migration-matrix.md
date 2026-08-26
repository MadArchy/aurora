# Migration matrix 008 — Learning Loop

**Phase 0 inventory.** Implementation migration Phases 1–4.

Baseline SHA: SPEC-007 CODE_COMPLETE `5d084ea9274909fb3f1d1eb2f51a084ec3a1f4c0`

Legend: **KEEP** · **MIGRATE** · **ADAPT** · **DEPRECATE** · **OTHER_SPEC** · **COMPATIBILITY** · **SHARED** · **REMOVE_AUTHORITY**

---

## Cross-SPEC contract table

| SPEC | Consumed contract | R/W | Authority owner | Mutation by 008? | Failure |
|------|-------------------|-----|-----------------|------------------|---------|
| 001 | routing snapshot / override counts | R | SPEC-001 | **No** | Fail closed if required context missing |
| 002 | Strategic Score snapshot | R | SPEC-002 | **No** | No silent rescore / weight write |
| 003 | Brief performance context | R | SPEC-003 | **No** | N/A |
| 004 | Plan execution results | R | SPEC-004 | **No** | N/A |
| 005 | Advisory Gateway ops | R (suggest) | SPEC-005 | **No** new ops | Advisory failure non-blocking |
| 006 | claimSafety / evidence projections | R | SPEC-006 | **No** | N/A |
| 007 | Opportunity lifecycle terminals | R | SPEC-007 | **No** | Read-only ingest |
| 009 | Tenant/auth rules production | — | SPEC-009 | **No** | DEFERRED_UNCHANGED |

---

## Legacy surface inventory

| Location | Previous authority | Canonical replacement | Classification | Phase |
|----------|--------------------|----------------------|----------------|-------|
| `src/domain/radarFeedbackCore.ts` | Pure feedback stats + **hints** | Observation/evidence metrics; hints DISPLAY_ONLY or removed | **ADAPT** + **REMOVE_AUTHORITY** (hints) | 1–4 |
| `src/domain/thesisMetricsCore.ts` | Pure thesis learning metrics | `BuildLearningAssessment` | **ADAPT** | 1–4 |
| `src/domain/kpiWeekly.ts` | Pure KPI aggregation | Evidence metrics from Result observations | **ADAPT** | 1–4 |
| `src/domain/radarDigestCore.ts` | Digest uses outcomes | Read evidence projections | **ADAPT** | 4 |
| `SignalOutcome` type | Legacy input shape | `LearningObservation` sourceKind=SIGNAL_OUTCOME | **MIGRATE** | 3–4 |
| `ResultRecord` type | Legacy input shape | `LearningObservation` sourceKind=RESULT_RECORD | **MIGRATE** | 3–4 |
| `FeedbackEvent` type | Content review events | Shared input → observation | **SHARED** | 4 |
| `dbService.recordSignalOutcome` | **Authoritative** mutable replace | `RegisterLearningObservation` append | **REMOVE_AUTHORITY** | 4 |
| `dbService.getSignalOutcome(id)` | Id-only lookup | Tenant-keyed get | **REMOVE_AUTHORITY** | 4 |
| `dbService.getSignalOutcomes()` unscoped | Cross-tenant risk | Tenant-scoped list | **REMOVE_AUTHORITY** | 4 |
| `dbService.addResult` | Authoritative result write | `RegisterLearningObservation` | **MIGRATE** | 4 |
| `dbService.addFeedbackEvent` | Content feedback | Shared — route via consumer | **SHARED** | 4 |
| `postura_signal_outcomes_v1` | LOCAL store | `postura_learning_observations_v1` + compat reader | **MIGRATE** | 3–4 |
| `postura_results_v5` | LOCAL store | Observations + compat reader | **MIGRATE** | 3–4 |
| `postura_feedback_v1` | LOCAL store | Shared compat | **SHARED** | 4 |
| Firestore `signalOutcomes` | Remote rules (SPEC-009) | Future remote | **OTHER_SPEC** / D1 | Deploy |
| Firestore `results` | Remote rules | Future remote | **OTHER_SPEC** / D1 | Deploy |
| Firestore `feedbackEvents` | Remote rules | Future remote | **SHARED** / D1 | Deploy |
| `main.ts` outcome handlers | UI authority + rescore | Consumer intent | **MIGRATE** | 4 |
| `main.ts` addResult handlers | UI authority | Consumer intent | **MIGRATE** | 4 |
| `main.ts` `feedbackScoringHints` in scoringContext | **P0 scoring mutation** | **REMOVE** from scoring path | **REMOVE_AUTHORITY** | 4 |
| `ClientWorkspace` outcome buttons | UI → dbService | UI → consumer intent | **MIGRATE** | 4 |
| `ClientWorkspace` thesis learning block | Display metrics | DISPLAY via GetLearningMetrics | **ADAPT** | 4 |
| `KpiWeeklyChart.ts` | Display KPI buckets | DISPLAY via evidence | **ADAPT** | 4 |
| `ManagerCockpit.ts` outcome reads | Display | DISPLAY via consumer | **ADAPT** | 4 |
| `DbStrategicSignalRoutingAdapter` hints | Scoring context mutation | **REMOVE** hints from adapter | **REMOVE_AUTHORITY** | 4 |
| `feedbackScoringHints()` | boost/avoid terms → scoring | DISPLAY_ONLY advisory OR delete | **REMOVE_AUTHORITY** | 4 |
| Post-outcome mass rescore loop | Automatic SPEC-002 invoke | **REMOVE** | **REMOVE_AUTHORITY** | 4 |
| Opportunity accept/reject/complete | SPEC-007 owned | Read-only observation ingest | **OTHER_SPEC** input | 4 |

---

## Critical migration — feedbackScoringHints (AUDIT008-03 / AUDIT008-09)

| Aspect | Current | Target |
|--------|---------|--------|
| Function | `feedbackScoringHints(signals, outcomes)` | Retained as **pure DISPLAY_ONLY** helper OR deprecated |
| Consumer | `main.ts scoringContext`, `DbStrategicSignalRoutingAdapter` | **REMOVE** from scoring/routing authority |
| Effect | Alters `bilingualTerms` / `avoidedFramings` → rescore | **Zero** strategic mutation until APPROVED recommendation applied via SPEC-002 port |
| Phase | — | Phase 4 consumer migration |

**Phase 5 verified classification (T-008-507):** `feedbackScoringHints` has **zero**
call sites in `src/**`. The only occurrence is its own exported definition in
`src/domain/radarFeedbackCore.ts` — classified **DEAD** — plus **TEST_ONLY** usage in
`tests/radarSprintC.test.ts`. No `CANONICAL_STRATEGIC` and no `AUTHORITY_BYPASS`
occurrence exists.

**feedbackScoringHints strategic authority = 0.**

---

## Critical migration — mass rescore (AUDIT008-03)

| Aspect | Current | Target |
|--------|---------|--------|
| Trigger | Outcome button in `main.ts` | Observation registration only |
| Effect | Rescores up to 40 open signals | **REMOVED** |
| Replacement | — | Optional human-triggered rescore via SPEC-002 canonical path only after approved recommendation |

**Phase 5 verified (T-008-508):** zero `rescore` / `scoreSignal` / routing-recompute
call sites in the canonical learning runtime, and the `main.ts` outcome handler
contains only `registerSignalOutcomeIntent`. New outcomes, results and Opportunity
outcome ingestion produce **no** automatic scoring or routing change.

**Learning-triggered auto-rescore authority = 0.**

---

## Artifact classifications

| Artifact | Classification |
|----------|----------------|
| **LearningObservation** | Canonical Domain Stage A |
| **LearningEvidence** | Canonical Domain Stage A |
| **LearningAssessment** | Canonical Domain Stage A projection |
| **StrategicRecommendation** | Canonical Domain Stage B |
| **RecommendationDecision** | Append-only audit |
| **SignalOutcome** / **ResultRecord** | Legacy input → migrate |
| **FeedbackEvent** | SHARED content-review input |
| **feedbackScoringHints** | **REMOVE_AUTHORITY** from strategic path |

---

## AUDIT008 disposition reference

See `plan.md` § AUDIT008 disposition.

**RUNTIME P0:** **RESOLVED** — Phase 4 removed `feedbackScoringHints` and the mass
rescore from the authority path; Phase 5 re-verified both adversarially.
**RUNTIME P0 = 0** · **P0 = 0** · **P1 = 0**.

**Legacy storage forgery (Phase 5 T-008-507):** forged rows injected into
`postura_signal_outcomes_v1`, `postura_results_v5` and `postura_feedback_v1` are
projected as `COMPATIBILITY_ONLY` with `MIGRATION_REVIEW_REQUIRED` /
`SKIPPED_MALFORMED` dispositions. **Legacy storage authority = 0.**

---

## Phase 4 exit criteria (migration)

- [x] Zero authoritative calls to `dbService.recordSignalOutcome` from UI/main
- [x] Zero `feedbackScoringHints` in scoring/routing adapter path
- [x] Zero post-outcome mass rescore
- [x] Outcome registration append-only via Application
- [x] Tenant-scoped reads only
- [x] P0 runtime closed

---

## Phase 6 verification — residual actor fallbacks (A12 · T-008-601)

`src/main.ts` retains **13** `user_admin_01` fallbacks. Phase-6 evidence
(`tests/learningLoopPhase6Acceptance.test.ts`) attributes **13/13** to non-learning operations
and proves **0** are co-located with a learning write:

| Owning operation | Owning SPEC surface | Count |
|------------------|--------------------|-------|
| `createClient`, `createInvitation` | client / org onboarding | 2 |
| `getThesesByClient` (thesis edit) | SPEC-001 thesis | 1 |
| `addSource` | SPEC-001 radar sources | 5 |
| `getCurationById`, `decideCuration`, `addToCuration` | SPEC-003 curation | 4 |
| `ensureDraftDelivery` | SPEC-004 delivery | 2 |

**Canonical learning runtime fallbacks:** **0**  
**Actor identity fields passed by UI learning intents:** **0** (`actorUid`, `createdBy`,
`approvedBy`, `actorType` all absent — trusted actor derived inside the consumer)

**Classification:** **KNOWN_LIMITATION · OUT_OF_SPEC_008_SCOPE**. These paths belong to frozen
**SPEC-001…007** implementations; Phase 6 requires SPEC-001…007 modifications = **0**, so they are
carried to the owning SPEC rather than changed here. Not a SPEC-008 CODE_COMPLETE blocker.
