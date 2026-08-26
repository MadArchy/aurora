# Opportunity model 007 — Opportunity Scout

**Phase 0 design.** No Domain implementation in this phase.

---

## Stage A — OpportunityCandidate (intelligence)

Pre-Brief / pre-Plan artifact. **Non-executable.**

### Proposed fields

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | candidateId |
| `organizationId` | yes | Trusted tenant |
| `clientId` | yes | Trusted tenant |
| `title` | yes | |
| `summary` | yes | |
| `whyNow` | yes | Structured reason + optional score contribution |
| `opportunityType` | yes | Reuse legacy `OpportunityType` enum where applicable |
| `sourceRefs` | yes | Signal ids / URLs / external refs (traceability) |
| `signalIds` | optional | When derived from signals |
| `thesisEvaluations` | yes | **Explicit multi-thesis** array (see below) |
| `status` | yes | Candidate status machine |
| `latestScoreId` / embedded score | yes | OpportunityScore ref or projection |
| `riskFlags` | yes | Structured codes |
| `recommendedNextStep` | yes | Enum: CONTINUE_RESEARCH · DRAFT_BRIEF · HOLD · DISCARD … |
| `schemaVersion` | yes | e.g. `opportunity-candidate-v1` |
| `version` | yes | Monotonic material version |
| `createdAt` / `updatedAt` | yes | Injected clock |
| `createdBy` | yes | Trusted actorId |

### Thesis evaluation entry (multi-thesis)

```text
{
  thesisId: string,          // explicit — never primary/[0]
  routingState?: string,     // READ_ONLY from SPEC-001 context if available
  strategicScoreRef?: {      // READ_ONLY SPEC-002 snapshot refs — not Opportunity Score
    scoringVersion: string,
    totalScore?: number,
    priorityBand?: string
  },
  fitNotes: string,
  evaluationStatus: 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN'
}
```

**Chosen model: A — one candidate with explicit thesis evaluations.**  
Rationale: matches multi-thesis native constitution without duplicating candidate rows per thesis; avoids silent winner.

### Candidate status (proposed)

`DETECTED` → `UNDER_EVALUATION` → `SCORED` → `RECOMMENDED` | `HELD` | `DISCARDED`  
`SUPERSEDED` for material revise of candidate.

Candidate **RECOMMENDED** ≠ create Opportunity. Materialization is Stage B only.

---

## Stage B — Opportunity (materialized)

Post-Plan operational aggregate. Repository types today (`src/types`):

```text
OpportunityType =
  CONFERENCE_KEYNOTE | PANEL | PODCAST_GUEST | JOURNAL_CALL |
  AWARD_NOMINATION | PUBLIC_COMMENT

OpportunityStatus (legacy) =
  DETECTED | UNDER_REVIEW | RECOMMENDED | SENT_TO_CLIENT |
  ACCEPTED | REJECTED | IN_PROGRESS | COMPLETED | ARCHIVED

OpportunityLifecycleStage (legacy UI) =
  proposed | accepted | declined | checklist | submitted
```

### Canonical lifecycle (DESIGN — unifies dual legacy)

| Canonical status | Meaning | Who may enter |
|------------------|---------|----------------|
| `PROPOSED` | Sent / visible to client for decision | SOFTWARE after Materialize (post Plan allow) |
| `ACCEPTED` | Client/human accepted; checklist may start | HUMAN |
| `DECLINED` | Client/human declined | HUMAN |
| `CHECKLIST` | Submission checklist in progress | HUMAN / SOFTWARE (checklist toggles) |
| `SUBMITTED` | Postulation marked sent | HUMAN |
| `COMPLETED` | Closed successfully | HUMAN / SOFTWARE (if SUBMITTED auto-complete policy) |
| `ARCHIVED` | Terminal archive | HUMAN / SOFTWARE |

**Terminal:** `DECLINED`, `COMPLETED`, `ARCHIVED` (reopen only via explicit revise policy — default **deny**).

### Required materialization fields

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | opportunityId |
| `organizationId` / `clientId` | yes | Trusted |
| `thesisId` | yes | **Exactly one** explicit thesis |
| `candidateId` | optional | When sourced from Stage A |
| `strategicBriefId` / `strategicBriefVersion` | yes | SPEC-003 binding |
| `strategicPlanId` / `strategicPlanVersion` | yes | SPEC-004 binding |
| `planItemId` | yes | Authorizing PlanItem |
| `title`, `organization`, `type`, `deadline`, `description`, `fitRationale` | yes | From candidate / Plan context |
| `status` | yes | Canonical lifecycle |
| `submissionChecklist` | when ACCEPTED+ | Checklist items |
| `schemaVersion` / `version` | yes | |
| `createdAt` / `updatedAt` / `createdBy` | yes | |

Caller/UI cannot invent Brief/Plan/thesis bindings.

---

## Legacy dual-status mapping

| Legacy `OpportunityStatus` | Legacy `lifecycleStage` | Canonical | Lossless? |
|----------------------------|-------------------------|-----------|-----------|
| SENT_TO_CLIENT / RECOMMENDED / DETECTED / UNDER_REVIEW | proposed / absent | `PROPOSED` | mostly |
| ACCEPTED | accepted | `ACCEPTED` | yes |
| ACCEPTED + checklist length | checklist | `CHECKLIST` | yes |
| REJECTED | declined | `DECLINED` | yes |
| IN_PROGRESS | checklist | `CHECKLIST` | yes |
| COMPLETED | submitted | `SUBMITTED` then policy→`COMPLETED` | **ambiguous** — needs Phase 4 review if both meanings mixed |
| ARCHIVED | — | `ARCHIVED` | yes |

**Ambiguous mappings MUST NOT be silently coerced** — fail closed or require human review flag during migration (T-007-307/404).

Current helper `mapOpportunityLifecycle` remains **COMPATIBILITY** until Domain replaces it.

---

## Materialize gate (Domain predicates — future)

Inputs (Application-loaded):

- trusted tenant/actor
- current Brief projection (APPROVED, version match)
- current Plan + PlanItem (CREATE_OPPORTUNITY, READY/eligible)
- SPEC-004 authorization decision **ALLOW**
- explicit thesisId matching Plan/Brief

Deny reasons (examples): `PLAN_DENY`, `BRIEF_STALE`, `THESIS_MISMATCH`, `TENANT_MISMATCH`, `TRUSTED_CONTEXT_REQUIRED`, `ACTION_NOT_AUTHORIZED`.

---

## Tenant identity

All reads/writes:

```text
organizationId | clientId | opportunityId
organizationId | clientId | candidateId
```

**Forbidden:** global `getById(id)` without tenant envelope as authority (F-007-04).

---

## History / materiality

Append-only `OpportunityHistoryRecord` for material events:

- candidate evaluate / reevaluate
- score version change
- materialize
- accept / decline
- checklist material change
- submit / complete / archive
- supersession

History = **AUDIT_ONLY**. Current projection is repository current row only.

Cosmetic UI fields (expanded panel, sort preference) are non-material.
