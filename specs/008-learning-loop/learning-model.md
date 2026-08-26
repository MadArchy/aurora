# Learning model 008 — Learning Loop

**Phase 0 design.** No implementation in this phase.

Constitution §19 + circuit §32:

```text
RESULTS → LEARNING → STRATEGIC RECOMMENDATION
```

**Principle:** OBSERVATION IS NOT AUTHORITY. LEARNING IS NOT AUTOMATIC STRATEGIC MUTATION.

---

## Stage A — Learning / Observation

### Purpose

Transform raw operational results into normalized, tenant-scoped, thesis-scoped observations and explainable evidence — **without** mutating strategic configuration.

### May consume (read-only projections)

| Source | Owner | Input role |
|--------|-------|------------|
| `SignalOutcome` | Legacy → 008 | Signal usefulness feedback |
| `ResultRecord` | Legacy → 008 | KPI / performance results |
| `FeedbackEvent` | Shared (content review) | Content approved/modified/rejected learning |
| Opportunity lifecycle terminals | SPEC-007 | accepted / declined / submitted / completed / archived |
| Content status / claimSafety projections | SPEC-006 adjacent | Performance + safety signals |
| Strategic Score snapshots | SPEC-002 | **Observe only** — not mutate |
| Routing decision snapshots | SPEC-001 | **Observe only** — not reroute |

### Stage A operations (future Application)

| Operation | Effect |
|-----------|--------|
| `RegisterLearningObservation` | Append normalized observation |
| `SupersedeLearningObservation` | Mark prior observation superseded (with reason) — not silent delete |
| `BuildLearningEvidence` | Aggregate observations into evidence bundle |
| `BuildLearningAssessment` | Compute metrics/patterns (pure projection) |
| `GetLearningMetrics` | Read assessment for UI |

### Stage A MUST NOT

- Change thesis, weights, voice, audience, objective
- Reroute signals (SPEC-001)
- Rescore signals (SPEC-002)
- Approve Brief / Plan / Opportunity materialization
- Publish content
- Call `feedbackScoringHints` as scoring authority

---

## Canonical artifact — LearningObservation

Normalized unit replacing mutable legacy outcome semantics.

| Field | Required | Notes |
|-------|----------|-------|
| `observationId` | yes | Stable id |
| `organizationId` | yes | Tenant |
| `clientId` | yes | Tenant |
| `thesisScope` | yes | `{ kind: 'SINGLE'; thesisId }` \| `{ kind: 'MULTI'; thesisIds }` \| `{ kind: 'CLIENT_WIDE' }` |
| `sourceKind` | yes | `SIGNAL_OUTCOME` \| `RESULT_RECORD` \| `FEEDBACK_EVENT` \| `OPPORTUNITY_OUTCOME` \| `OTHER` |
| `sourceRef` | yes | `{ sourceSpec; sourceId; sourceVersion? }` |
| `observationKind` | yes | e.g. `USEFUL` \| `NOT_USEFUL` \| `KPI` \| `CONTENT_APPROVED` \| `OPPORTUNITY_ACCEPTED` … |
| `payload` | yes | Structured, schema-versioned body |
| `actorUid` | yes | From **trusted** context at registration time |
| `recordedAt` | yes | Clock |
| `schemaVersion` | yes | e.g. `learning-observation-v1` |
| `supersedesObservationId` | optional | Prior observation this replaces logically |
| `status` | yes | `ACTIVE` \| `SUPERSEDED` \| `CORRECTED` |

**Immutability rule:** material observations are **append-only**. Correction = new observation with `supersedesObservationId` + reason — not in-place overwrite.

Legacy `recordSignalOutcome` replace-by-`signalId` → **DEPRECATE authority** in Phase 4.

---

## Canonical artifact — LearningEvidence

| Field | Required | Notes |
|-------|----------|-------|
| `evidenceId` | yes | |
| `organizationId`, `clientId` | yes | |
| `thesisScope` | yes | Same semantics as observation |
| `observationIds` | yes | Source observations |
| `metrics` | yes | Structured counters/rates (explainable) |
| `patterns` | optional | Detected patterns with reason codes |
| `summary` | yes | Human-readable summary (no chain-of-thought) |
| `schemaVersion` | yes | |
| `builtAt` | yes | |

Evidence is **not** current strategic authority. It supports recommendation generation only.

---

## Canonical artifact — LearningAssessment

Pure projection over evidence — may reuse `computeThesisLearningMetrics` logic **after** observation normalization.

| Field | Notes |
|-------|-------|
| `assessmentId` | |
| `evidenceId` | |
| `thesisScope` | |
| `signalsUseful`, `signalsNotUseful`, `routingOverrides`, `contentPublished`, `claimBlocks`, `authorityScore`, … | From existing metrics vocabulary where applicable |
| `summary` | Display string |

Assessment **must not** auto-apply to scoring weights.

---

## LearningEvidence → StrategicRecommendation

Only Application may propose recommendations from evidence. Domain validates recommendation shape and lifecycle transitions.

Minimum evidence threshold (design): recommendation must cite ≥1 observation id and explicit target domain.

---

## History model

| Store | Authority |
|-------|-----------|
| Append-only `LearningHistoryRecord` | Audit only |
| Current `StrategicRecommendation` projection | Current recommendation state |
| Superseded observations | Retained; marked `SUPERSEDED` |

**History itself is NOT current strategic authority.**

Latest outcome must **not** silently drive scoring (P0 remediation target).

---

## Outcome immutability (AUDIT008-06)

| Legacy | Target |
|--------|--------|
| Replace-by-`signalId` | Append + supersession |
| Single current outcome per signal | Current projection derived from latest **ACTIVE** observation |
| Hidden delete on re-record | Explicit supersession event |

---

## Multi-thesis

Every observation and evidence bundle declares `thesisScope` explicitly.

Cross-thesis assessment requires explicit `MULTI` or `CLIENT_WIDE` scope — never implicit primary thesis.

---

## Explainability (Stage A)

Structured fields only:

- source observation ids
- source spec references
- metrics with labels
- pattern reason codes
- thesis scope
- time window

No hidden chain-of-thought.

---

## Relationship to legacy pure functions

| Legacy | Target |
|--------|--------|
| `signalsAwaitingOutcome` | ADAPT — input from observation projections |
| `computeConversionStats` | ADAPT — evidence metrics |
| `computeThesisLearningMetrics` | ADAPT — LearningAssessment builder |
| `aggregateWeeklyKpis` | ADAPT — ResultRecord observation aggregation |
| `feedbackScoringHints` | **REMOVE_AUTHORITY** from scoring path; optional DISPLAY_ONLY |
| `radarDigestCore` outcome usage | ADAPT — read evidence projections |

See `migration-matrix.md`.
