# Planner model 004 — Strategic Planner

**Authoritative data contract for SPEC-004 (Phase 0 design).**  
Physical persistence is Phase 3. This document defines Domain semantics.

Constitution: Thesis-first · Multi-thesis native · AI suggests / software governs · Explainability · Tenant.

---

## Terminology

| Term | Meaning |
|------|---------|
| **StrategicPlan** | Aggregate root — governed execution plan under one Brief |
| **PlanItem** | Intended execution action under a plan |
| **StrategicBrief** | SPEC-003 upstream authorization (OTHER_SPEC) |
| **authorizedAction** | SPEC-003 enum bounding allowed PlanItem actions |
| **CurationEntry** | Legacy intake/compatibility — **not** Plan authority |
| **DeliveryPackage** | Downstream packaging — **not** Plan authority |

---

## Aggregate design

```text
StrategicPlan (aggregate root)
  ├── identity + tenant envelope
  ├── strategicBriefId + strategicBriefVersion
  ├── thesisId (copied from Brief — explicit)
  ├── signalIds (traceability from Brief)
  ├── status + version
  ├── approval metadata
  ├── rationale / explainability projection
  └── PlanItem[] (associations under plan)

PlanItem
  ├── identity + tenant + planId
  ├── action (StrategicAuthorizedAction-compatible)
  ├── status
  ├── priority / order
  ├── rationale
  └── optional downstream artifact refs (contentId / opportunityId / taskId)
```

**Chosen:** StrategicPlan is aggregate root. PlanItems are owned associations (not free-floating authority).

---

## StrategicPlan — required fields

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `id` | string | yes | system id |
| `organizationId` | string | yes | trusted tenant |
| `clientId` | string | yes | trusted tenant |
| `strategicBriefId` | string | yes | SPEC-003 Brief id |
| `strategicBriefVersion` | number | yes | Brief revision at plan binding |
| `thesisId` | string | yes | **must equal** Brief.thesisId — no fallback |
| `signalIds` | string[] | yes | copied from Brief (≥0 preserved; typically ≥1) |
| `status` | PlanStatus | yes | lifecycle |
| `version` | number | yes | monotonic ≥ 1 |
| `schemaVersion` | string | yes | e.g. `strategic-plan-v1` |
| `createdBy` | string | yes | trusted actor |
| `approvedBy` | string \| null | conditional | required when status ∈ {APPROVED, ACTIVE, COMPLETED} after human approve |
| `createdAt` | ISO timestamp | yes | clock port |
| `updatedAt` | ISO timestamp | yes | clock port |
| `rationale` | string | yes | why this plan exists under Brief |
| `priorityBand` | string \| null | no | optional ordering hint (not scoring authority) |
| `aiAdvisoryRefs` | object[] | no | audit only — never authority |
| `supersededByPlanId` | string \| null | no | when SUPERSEDED |
| `supersedesPlanId` | string \| null | no | prior chain |

---

## PlanItem — required fields

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `id` | string | yes | system id |
| `planId` | string | yes | parent StrategicPlan |
| `organizationId` | string | yes | must match plan |
| `clientId` | string | yes | must match plan |
| `action` | StrategicAuthorizedAction | yes | must be allowed by Brief.authorizedAction |
| `status` | PlanItemStatus | yes | item lifecycle |
| `order` | number | yes | stable ordering (≥ 0) |
| `rationale` | string | yes | why this item |
| `channel` | string \| null | no | may inherit Brief.recommendedChannel |
| `format` | string \| null | no | may inherit Brief.recommendedFormat |
| `riskNotes` | string[] | yes | may be empty |
| `downstreamRef` | `{ kind, id } \| null` | no | set when materialized |
| `createdAt` / `updatedAt` | ISO | yes | |

**Invariant:** PlanItem cannot self-authorize. Activation requires plan + Brief gate.

---

## PlanStatus

```text
DRAFT → PROPOSED → APPROVED → ACTIVE → COMPLETED
                 ↘ REJECTED
Any non-terminal → CANCELLED (where permitted)
APPROVED/ACTIVE material revise → new DRAFT + prior SUPERSEDED
```

| Status | Downstream activations |
|--------|------------------------|
| DRAFT / PROPOSED / REJECTED / CANCELLED / SUPERSEDED / COMPLETED | **Denied** for new activations |
| APPROVED / ACTIVE | **Allowed** if Brief still valid |

### PlanItemStatus (minimal)

| Status | Meaning |
|--------|---------|
| `PLANNED` | Not started |
| `READY` | Eligible to activate under gate |
| `IN_PROGRESS` | Materialization started |
| `DONE` | Completed |
| `BLOCKED` | Waiting (e.g. Brief stale / claim gate later) |
| `CANCELLED` | Cancelled |

---

## Materiality / versioning

Material change ⇒ **new plan `version`** + append history + supersede prior APPROVED/ACTIVE if applicable:

| Category | Examples |
|----------|----------|
| Brief binding | `strategicBriefId` / `strategicBriefVersion` change |
| Thesis | `thesisId` change (normally via Brief rebind) |
| Action set | add/remove/change PlanItem.action |
| Priority | item `order` / material priority change |
| Rationale | plan or item rationale material rewrite |
| Channel/format | material channel/format change on items |

Non-material: typo fixes in draft notes that Domain classifies as non-material (Phase 1 predicates).

**Silent in-place mutation of APPROVED/ACTIVE plans = forbidden.**

---

## Stale Brief rules

| Condition | Result |
|-----------|--------|
| Brief not found | Fail closed |
| Brief status ≠ APPROVED | Fail closed for activate |
| Brief.version ≠ plan.strategicBriefVersion | Fail closed — revalidate/revise |
| Brief.thesisId ≠ plan.thesisId | Fail closed |
| Brief.tenant ≠ plan.tenant | Fail closed |
| Brief.authorizedAction no longer allows item.action | Fail closed |

---

## Multi-thesis / multi-Brief

- One plan → one thesis (from Brief).
- One plan → one Brief revision.
- Client may have many plans across theses/Briefs.
- Aggregating multiple Briefs into one plan = **DENY** (Phase 0).

No `primaryThesisId`, `getPrimaryThesis`, `theses[0]`, score-winner.

---

## Human authority

| Transition | Actor |
|------------|-------|
| Create DRAFT / edit DRAFT | Trusted human (manager) or governed software seam |
| Propose | Trusted human |
| Approve / Reject | Trusted human — **required** |
| Activate / Complete / Cancel | Trusted human or trusted software orchestration **after** plan APPROVED |
| AI | **Never** approve/reject/activate |

Caller-supplied `role` / `organizationId` / `clientId` / `actorId` = **untrusted**. Application trusted context wins.

---

## Explainability projection

Must reconstruct:

1. Which Brief (id + version)
2. Which thesis
3. Which authorizedAction bound the plan
4. Why the plan / each item
5. Priority/order
6. Channel/format if set
7. Risk notes
8. Human approver
9. Plan version / item status
10. Optional AI advisory refs (non-authoritative)

No chain-of-thought.

---

## Idempotency keys (conceptual)

| Operation | Idempotency basis |
|-----------|-------------------|
| CreateStrategicPlan | tenant + briefId + briefVersion + create intent key |
| AddPlanItem | planId + action + order + intent key |
| ApproveStrategicPlan | planId + version |
| ActivatePlanItem | planItemId + plan version |
| ReviseStrategicPlan | prior planId + material hash |

Retry must not create duplicate current plans for same Brief revision without explicit supersession.
