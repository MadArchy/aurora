# Data flow 004 — Strategic Planner

---

## A. End-to-end strategic → plan → execute

```text
Signal
  → SPEC-001 routing (CLEAR + selectedThesisId)
  → SPEC-002 scoring
  → SPEC-003 StrategicBrief APPROVED
       (authorizedAction, thesisId, signalIds, channel/format, …)
  → SPEC-004 CreateStrategicPlan / AddPlanItem / ApproveStrategicPlan
  → AuthorizePlannedAction
  → materialize Content / Opportunity / Task (downstream)
  → SPEC-006 AuthorizePublication (claim-bearing publish only)
```

**Fail-closed:** no plan activation without current APPROVED Brief binding.

---

## B. Legacy current flow (to be strangled)

```text
CurationEntry destination
  → create/approve Brief (SPEC-003) OR attach strategicBriefId
  → main.ts orchestrates content / delivery / opportunity / task
  → DeliveryPackage packaging
  → content gated by SPEC-006 on CLIENT_REVIEW/READY/PUBLISHED
```

CurationEntry is **intake/compatibility**, not StrategicPlan.

---

## C. Target plan evaluation flow

```text
APPROVED Brief (id B, version V, thesis T, action A)
  → CreateStrategicPlan(status=DRAFT, briefId=B, briefVersion=V, thesisId=T)
  → AddPlanItem(action ⊆ A, rationale, order)
  → Propose → Approve (human)
  → AuthorizePlannedAction(item)
       ├── Brief still APPROVED + version V + tenant + thesis + action
       └── Plan APPROVED|ACTIVE + item READY
  → ActivatePlanItem → create downstream artifact ref
  → CompletePlanItem
```

---

## D. Stale Brief flow

```text
Plan bound to Brief V1
Brief V1 → SUPERSEDED; Brief V2 current
  → AuthorizePlannedAction = DENY
  → RevalidatePlanAgainstBrief / ReviseStrategicPlan → new plan revision
  → human re-approve
```

---

## E. Multi-signal

Brief.signalIds preserved on StrategicPlan for traceability.  
Planner does **not** re-route individual signals.

---

## F. AI advisory flow

```text
Brief + vault context
  → (optional) SPEC-005 advisory suggestion
  → human/software accepts into PlanItem drafts
  → AI never ApproveStrategicPlan / ActivatePlanItem
```

---

## G. Cross-SPEC handoffs

| From | To | Payload |
|------|----|---------|
| SPEC-003 | SPEC-004 | strategicBriefId, version, thesisId, signalIds, authorizedAction, channel/format, evidence ids, riskFlags |
| SPEC-004 | Content/Opportunity/Task | planId, planItemId, brief refs, action |
| Content publish | SPEC-006 | AuthorizePublication (unchanged) |

SPEC-004 must not invent Claim verification.

---

## H. Failure matrix (summary)

| Condition | Result |
|-----------|--------|
| Brief DRAFT / REJECTED / SUPERSEDED | DENY plan activate |
| Brief version mismatch | DENY |
| Action not allowed by Brief | DENY |
| Cross-tenant | DENY |
| AI approve attempt | DENY |
| History-only APPROVED | DENY (current required) |
