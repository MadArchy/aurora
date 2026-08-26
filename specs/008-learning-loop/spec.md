# Spec 008 — Learning Loop

| Field | Value |
|-------|--------|
| **Spec ID** | `008-learning-loop` |
| **Display name** | **SPEC-008 — Learning Loop** |
| **Status** | **`CODE_COMPLETE`** · **FREEZE ACTIVE** · Phases 0–6 **COMPLETE** (Domain · Application · Persistence · Consumer · Security · Acceptance) |
| **Phase** | Phase 6 Acceptance **COMPLETE** · `CODE_COMPLETE` **YES** (T-008-604 approved 2026-08-26 America/Bogota) · `DEPLOYMENT` **NOT_STARTED** · `DEPLOYED` **NO** · `DONE` **NO** |
| **Branch** | `spec/008-learning-loop` |
| **Baseline SHA** | SPEC-007 CODE_COMPLETE final freeze `5d084ea9274909fb3f1d1eb2f51a084ec3a1f4c0` |
| **Priority** | P1 (constitution §19 + §32 — RESULTS → LEARNING → STRATEGIC RECOMMENDATION) |
| **Constitution** | Observation ≠ authority · Learning ≠ automatic mutation · Recommendation ≠ approval · AI advisory only · Multi-thesis native · Tenant security |
| **Depends on** | SPEC-001/002 (read-only context; no routing/scoring authority); SPEC-003/004 (read-only execution context); SPEC-005 (advisory AI — future); SPEC-006 (verified evidence projection — read-only); SPEC-007 (Opportunity outcomes — read-only); SPEC-009 (CODE_AVAILABLE; production DEFERRED) |
| **Blocks** | Governed learning, strategic recommendation, and human-approved strategic change traceability |
| **Test baseline (Phase 0)** | Full check + rules unchanged · focused legacy learning tests 8/8 PASS |
| **Human SPEC approval** | **APPROVED** (T-008-010) — 2026-08-26 (America/Bogota) |
| **Human CODE_COMPLETE approval** | **APPROVED** (T-008-604) — 2026-08-26 (America/Bogota) |

---

## Problem

POSTURA’s constitutional circuit ends with:

```text
RESULTS → LEARNING → STRATEGIC RECOMMENDATION
```

Constitution §19 requires POSTURA to learn from approved/modified/rejected content, opportunity outcomes, audience, authority signals, business signals, and performance — while **never** auto-modifying Thesis, weights, Voice Profile, audiences, or objectives without human approval.

The repository already has **partial** learning surfaces:

- `SignalOutcome`, `ResultRecord`, `FeedbackEvent` types and `dbService` mutators
- pure helpers: `radarFeedbackCore`, `thesisMetricsCore`, `kpiWeekly`, `radarDigestCore`
- UI outcome buttons and thesis learning display in `ClientWorkspace`
- **P0 runtime defect:** `feedbackScoringHints` → scoring/routing context → mass rescore **without** StrategicRecommendation or human approval

But **no formal SPEC-008 package** exists. Learning authority is fragmented across UI/`dbService`/`main.ts` with silent strategic mutation into SPEC-002 scoring context.

---

## Goal

Formalize SPEC-008 as the constitutional owner of:

> **LEARNING / OBSERVATION + STRATEGIC RECOMMENDATION + HUMAN-APPROVED CHANGE TRACEABILITY**

### Stage A — Learning / Observation

Consume normalized results and outcomes; aggregate metrics; detect patterns; produce learning evidence and **candidate** recommendations.

**Does not** mutate strategic configuration.

### Stage B — Strategic Recommendation

Transform learning evidence into an explicit, versioned, explainable **StrategicRecommendation** for human review.

**Does not** execute approved change — target SPEC applies change through its canonical boundary.

**Hard invariants:**

```text
RAW RESULT        ≠ LEARNING
LEARNING          ≠ STRATEGIC RECOMMENDATION
RECOMMENDATION    ≠ APPROVAL
APPROVAL          ≠ TARGET-SPEC APPLICATION (unless target validates)
AI SUGGESTION     ≠ APPROVAL
```

Canonical question Stage A answers:

> **What did we observe from results and outcomes, under which thesis scope, and what evidence supports it?**

Canonical question Stage B answers:

> **Given learning evidence, what strategic change should a trusted human consider, for which owning SPEC/domain, and why?**

---

## Non-Goals

- Thesis routing / `selectedThesisId` mutation (SPEC-001)
- Strategic Signal scoring formula / weight mutation (SPEC-002)
- Brief approve / reject / revise / supersede (SPEC-003)
- StrategicPlan / PlanItem / AuthorizePlannedAction (SPEC-004)
- New AiOperation / provider keys in Phase 0 (SPEC-005) — advisory only if later proposed
- Claim / Evidence / Verification / AuthorizePublication (SPEC-006)
- OpportunityCandidate / OpportunityScore / MaterializeOpportunity / Opportunity lifecycle (SPEC-007 — **FROZEN**)
- Auth JWT / custom claims / production rules deploy (SPEC-009)
- React migration (SPEC-010)
- Production deployment / Firestore backfill in implementation Phases 1–6
- **Automatic** application of learning to scoring weights, thesis, voice, audience, or objectives

---

## Canonical artifacts

| Artifact | Stage | Role |
|----------|-------|------|
| **`LearningObservation`** | A | Normalized, tenant-scoped record of a single observed result/outcome event |
| **`LearningEvidence`** | A | Aggregated, explainable evidence bundle derived from observations |
| **`LearningAssessment`** | A | Pattern/metric assessment over evidence (pure projection; non-authoritative) |
| **`StrategicRecommendation`** | B | Versioned proposal for human review; binds evidence + target domain |
| **`RecommendationDecision`** | B | Append-only human approval/rejection audit — **not** current authority alone |
| **`LearningHistoryRecord`** | A/B | Append-only audit — **not** current authority |

**Repository input projections (not owned aggregates):**

| Input | Classification |
|-------|----------------|
| `SignalOutcome` | Legacy input → migrate to `LearningObservation` |
| `ResultRecord` | Legacy input → migrate to `LearningObservation` |
| `FeedbackEvent` | Shared content-review input (SPEC-006/content pipeline adjacent) |
| Opportunity lifecycle terminal states | SPEC-007 read-only projection |

Naming decision: introduce `LearningObservation` because legacy records mix mutable replace-by-`signalId` semantics with append-only KPI results. `StrategicRecommendation` is first-class because constitution requires explicit human gate before strategic mutation.

---

## Authority owned by SPEC-008

| Owns | Does **not** own |
|------|------------------|
| Learning observation registration (design) | Strategic Signal Score (SPEC-002) |
| Learning evidence / assessment projections | Thesis routing (SPEC-001) |
| StrategicRecommendation lifecycle + explainability | Brief / Plan approval (SPEC-003/004) |
| Human approval/rejection audit of recommendations | Opportunity intelligence/lifecycle (SPEC-007) |
| Apply-traceability (APPROVED → dispatch to target SPEC) | Claim verification / publication (SPEC-006) |
| Tenant-safe learning repositories (design) | Auth claims / production rules (SPEC-009) |
| Idempotency + history for learning/recommendations | Direct AI provider calls (SPEC-005) |

**Authority separation:**

```text
SPEC-001/002 = route/score signals (READ_ONLY to 008; 008 may RECOMMEND only)
SPEC-003     = strategic Brief authority
SPEC-004     = Plan execution authority
SPEC-007     = Opportunity intelligence/lifecycle (READ_ONLY outcomes to 008)
SPEC-008     = observe → recommend → human gate → trace apply dispatch
TARGET SPEC  = owns actual strategic mutation after validation
```

---

## Critical P0 — auto-learning (AUDIT008-03)

**Runtime status:** `RESOLVED` (Phase 4 T-008-405/406 · re-verified adversarially in Phase 5 T-008-507/508)

**Design status:** `RESOLVED`

**Phase 5:** `feedbackScoringHints` strategic authority = **0** · learning-triggered
auto-rescore authority = **0** · **P0 = 0** · **P1 = 0**.

Former unsafe path — **REMOVED**, no longer present in runtime:

```text
SignalOutcome → feedbackScoringHints → scoring/routing context → mass rescore
```

**Target path:**

```text
Result/Outcome → LearningObservation → LearningEvidence
  → StrategicRecommendation (PROPOSED)
  → trusted HUMAN approval
  → ApplyApprovedRecommendation dispatches to TARGET SPEC canonical use case
  → target SPEC validates and applies owned change
```

**Absolutely forbidden in target design:**

- Outcome → automatic weight/scoring mutation
- Outcome → automatic thesis mutation
- Outcome → automatic strategic configuration mutation

See `learning-model.md`, `strategic-recommendation.md`, `migration-matrix.md`.

---

## Cross-SPEC boundaries (summary)

| SPEC | Boundary |
|------|----------|
| **001** | May observe routing outcomes; may recommend; **must not** reroute signals; `feedbackScoringHints` **must not** become routing authority |
| **002** | May observe scores; may recommend configuration change; **must not** silently mutate scoring; approved changes via future SPEC-002 apply port |
| **003** | Brief performance may be input; **must not** approve/change/supersede Brief |
| **004** | Plan execution results may be input; **must not** approve/modify Plan |
| **005** | Future AI summarize/suggest language only — **ADVISORY**; no approval/apply |
| **006** | May consume verified evidence projections; **must not** verify Claims or authorize publication |
| **007** | May consume Opportunity accept/decline/submit/complete outcomes — **READ_ONLY**; **no** SPEC-007 modification |
| **009** | Security requirements documented; production **DEFERRED_UNCHANGED** |

---

## Multi-thesis

Learning records **must** declare explicit thesis scope:

- single-thesis: required `thesisId`
- cross-thesis: explicit `thesisScope: { kind: 'MULTI'; thesisIds: string[] }` or `ALL_ACTIVE`

**Prohibited:** `theses[0]`, `primaryThesisId`, `getPrimaryThesis`, hidden score winner, selected-thesis fallback.

---

## Tenant model

All canonical entities require `organizationId` + `clientId` + entity id.

Repository contracts **must not** use id-only `getSignalOutcome(signalId)` or unscoped `getSignalOutcomes()` as authoritative APIs.

Future contract shape: `(organizationId, clientId, entityId)`.

---

## Trusted actor

Trusted actor and tenant context supplied by composition/runtime.

Caller-supplied `actorUid`, `createdBy`, role, or human flags **cannot** establish authority.

**Prohibited:** hard-coded fallbacks (`user_admin_01`, `"client"`).

---

## UI authority

UI = **INTENT / DISPLAY ONLY**.

UI cannot record authoritative learning, approve recommendations by raw status assignment, apply strategic change, or choose trusted actor/tenant.

---

## Persistence (Phase 3 target)

**LOCAL_AUTHORITATIVE** (consistent with SPEC-007) until deployment explicitly authorized.

Legacy keys: `postura_signal_outcomes_v1`, `postura_results_v5`, `postura_feedback_v1` → migrate under canonical learning stores with schema versioning.

Firestore `signalOutcomes` / `results` / `feedbackEvents` = secondary sync / SPEC-009 rules surface — not Phase 0 activation.

---

## Phase 0 exit

Formal package complete · Human SPEC approval **DONE** (T-008-010) · Phase 1 Domain **COMPLETE** · Phase 2 Application **COMPLETE** · Phase 3 Persistence **COMPLETE** · Phase 4 Consumer **COMPLETE**

**Next action:** Phase 5 Security / adversarial (T-008-501…510) when authorized to implement.
