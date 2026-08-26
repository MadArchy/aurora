# Strategic recommendation 008 — Learning Loop

**Phase 0 design.** Stage B authority model.

Constitution: RECOMMENDATION IS NOT APPROVAL. AI SUGGESTION IS NOT APPROVAL.

---

## Canonical artifact — StrategicRecommendation

First-class, versioned, explainable proposal for **human review**.

| Field | Required | Notes |
|-------|----------|-------|
| `recommendationId` | yes | |
| `organizationId` | yes | Tenant |
| `clientId` | yes | Tenant |
| `thesisScope` | yes | Single / multi / client-wide — explicit |
| `thesisId` | conditional | Required when `thesisScope.kind === 'SINGLE'` |
| `sourceObservationIds` | yes | Traceability |
| `sourceOutcomeIds` | optional | Legacy ref map during migration |
| `sourceResultIds` | optional | Legacy ResultRecord refs |
| `sourceOpportunityIds` | optional | SPEC-007 read-only refs |
| `learningEvidenceId` | yes | Primary evidence bundle |
| `recommendationType` | yes | Taxonomy below |
| `targetAuthority` | yes | Owning SPEC + domain |
| `proposedChange` | yes | Structured, schema-versioned — not opaque blob |
| `rationale` | yes | Explainable summary |
| `confidence` | yes | `LOW` \| `MEDIUM` \| `HIGH` (structured; not model CoT) |
| `risks` | yes | string[] |
| `expectedImpact` | yes | Structured |
| `status` | yes | Lifecycle below |
| `version` | yes | Monotonic revision |
| `schemaVersion` | yes | e.g. `strategic-recommendation-v1` |
| `createdBy` | yes | Trusted actor at creation |
| `reviewedBy` | optional | Trusted human |
| `approvedBy` | optional | Trusted human |
| `appliedBy` | optional | Software actor on successful dispatch |
| `createdAt`, `updatedAt` | yes | |
| `supersedesRecommendationId` | optional | Prior revision |

**No chain-of-thought** field. Rationale = structured business explanation only.

---

## Recommendation type taxonomy

| Type | Target authority | Example proposed change |
|------|------------------|---------------------------|
| `THESIS` | Thesis domain / future thesis module | Refine positioning statement |
| `STRATEGIC_SCORE_CONFIGURATION` | **SPEC-002** | Adjust weight profile (versioned) |
| `VOICE` | Client profile / voice module | Tone adjustment |
| `AUDIENCE` | Client profile | Audience segment emphasis |
| `OBJECTIVE` | Client profile / campaign | Objective reprioritization |
| `CONTENT_STRATEGY` | SPEC-003/004 adjacent | Channel/topic emphasis (non-Plan mutation) |
| `CHANNEL_STRATEGY` | Planner adjacent | Channel mix suggestion |
| `OPPORTUNITY_STRATEGY` | SPEC-007 adjacent | Opportunity type preference (non-lifecycle) |
| `OTHER` | Declared `targetAuthority` | Must name owner SPEC |

Every recommendation **must** declare `targetAuthority: { specId; domain }`.

SPEC-008 **does not** execute mutation in target storage directly.

---

## Lifecycle (canonical — single state machine)

| Status | Meaning |
|--------|---------|
| `DRAFT` | Internal composition; not yet proposed for review |
| `PROPOSED` | Visible for human review |
| `UNDER_REVIEW` | Assigned/in review |
| `APPROVED` | Trusted human approved — **not yet applied** |
| `REJECTED` | Trusted human rejected — terminal |
| `SUPERSEDED` | Replaced by newer revision — terminal |
| `APPLIED` | Target SPEC confirmed application — terminal |
| `APPROVED_NOT_APPLIED` | Approved but target apply port unavailable/failed |
| `APPLY_FAILED` | Dispatch failed — retryable per policy |

### Allowed transitions

```text
DRAFT → PROPOSED
PROPOSED → UNDER_REVIEW | REJECTED | SUPERSEDED
UNDER_REVIEW → APPROVED | REJECTED | SUPERSEDED
APPROVED → APPLIED | APPROVED_NOT_APPLIED | APPLY_FAILED
APPLY_FAILED → APPROVED (retry) | REJECTED | SUPERSEDED
```

**Human-required:** → `APPROVED`, → `REJECTED`

**Software-only:** `APPROVED` → `APPLIED` / `APPLY_FAILED` (after target SPEC confirms)

**Forbidden:**

- UI sets `APPROVED` directly
- AI sets `APPROVED`
- Caller payload sets `approvedBy`
- Generic `setStatus(x)` without transition validator

---

## Canonical artifact — RecommendationDecision

Append-only audit record for human decisions.

| Field | Required |
|-------|----------|
| `decisionId` | yes |
| `recommendationId` | yes |
| `recommendationVersion` | yes |
| `organizationId`, `clientId` | yes |
| `decision` | `APPROVE` \| `REJECT` |
| `actorUid` | trusted human |
| `reason` | yes |
| `decidedAt` | yes |
| `previousStatus` | yes |

Decision history supports audit; **current** status lives on recommendation aggregate projection.

---

## Human approval gate

No recommendation becomes executable strategic change without:

1. Trusted **human** actor from runtime context (not caller/UI)
2. Valid lifecycle transition to `APPROVED`
3. `RecommendationDecision` append record
4. `ApplyApprovedRecommendation` dispatch to **target SPEC** apply port
5. Target SPEC validation + owned mutation
6. Transition to `APPLIED` only on target success

**Human approval alone does not bypass target-SPEC validation.**

---

## ApplyApprovedRecommendation — target-owner boundary

```text
APPROVED StrategicRecommendation
  → ApplyApprovedRecommendation (SPEC-008 Application)
  → TargetSpecApplyPort (per targetAuthority.specId)
  → TARGET SPEC canonical use case
  → TARGET SPEC validates tenant + materiality + domain rules
  → TARGET SPEC applies owned change OR rejects
  → SPEC-008 records APPLIED | APPLY_FAILED
```

| Target | Apply port (future) | SPEC-008 may write target storage? |
|--------|---------------------|-------------------------------------|
| SPEC-002 scoring config | `StrategicScoringApplyPort` (future) | **NO** |
| SPEC-001 routing config | `StrategicRoutingApplyPort` (future) | **NO** |
| Thesis / voice / audience | Profile/thesis module port (future) | **NO** |
| Unavailable port | — | Status `APPROVED_NOT_APPLIED` |

**Unsafe cross-module write is forbidden.**

---

## Materiality / versioning

Material changes require new recommendation revision or supersession:

- `proposedChange` payload change
- `targetAuthority` change
- `thesisScope` change
- `expectedImpact` / `risks` materially changed after `PROPOSED`

Post-approval mutation of `proposedChange` → **forbidden**; supersede instead.

---

## Idempotency (design)

| Operation | Key |
|-----------|-----|
| RegisterLearningObservation | `(organizationId, clientId, sourceKind, sourceRef, observationKind, idempotencyKey)` |
| GenerateStrategicRecommendation | `(organizationId, clientId, learningEvidenceId, recommendationType, targetAuthority, idempotencyKey)` |
| Approve/Reject | `(recommendationId, version, decision, actorUid)` |
| ApplyApprovedRecommendation | `(recommendationId, version, applyAttemptId)` |

Repeated delivery must not duplicate authoritative effects.

---

## AI role (future — SPEC-005)

AI may **advise**:

- summarize evidence
- suggest rationale language
- detect anomalies

AI may **not**:

- approve recommendation
- apply recommendation
- mutate strategic configuration
- bypass human gate

No new AiOperation in Phase 0.

---

## P0 remediation linkage (AUDIT008-03)

**Unsafe (runtime — open):**

```text
SignalOutcome → feedbackScoringHints → scoring context → rescore
```

**Safe (design target):**

```text
SignalOutcome → LearningObservation → LearningEvidence
  → StrategicRecommendation (PROPOSED)
  → HUMAN APPROVE
  → ApplyApprovedRecommendation → SPEC-002 apply port (if type = STRATEGIC_SCORE_CONFIGURATION)
```

Until Phase 4 migration, runtime P0 remains open.
