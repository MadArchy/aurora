# Data flow 007 — Opportunity Scout

**Phase 0 design.** No consumer migration in this phase.

---

## Stage A — Opportunity Intelligence (pre-Brief allowed)

```text
Signals / market sources / curation intake (READ_ONLY context)
  → RegisterOpportunityCandidate
  → EvaluateOpportunityCandidate → OpportunityScore (explainable)
  → RecommendOpportunityCandidate (non-executing)
  → (optional) human continues research / drafts Brief in SPEC-003
```

**Forbidden shortcuts:**

- Candidate RECOMMENDED → `dbService.addOpportunity`
- Opportunity Score → CREATE_OPPORTUNITY without Plan
- thesisEvaluations empty + implicit primary thesis

---

## Stage B — Materialize + lifecycle (post-Plan)

```text
StrategicBrief APPROVED (SPEC-003)
  → StrategicPlan + PlanItem CREATE_OPPORTUNITY (SPEC-004)
  → AuthorizePlannedAction ALLOW
  → MaterializeOpportunity (SPEC-007 Application)
  → Opportunity PROPOSED
  → Accept / Decline (HUMAN)
  → Checklist / Submit / Complete / Archive
```

Current legacy path (COMPATIBILITY until Phase 4):

```text
Delivery item destination OPPORTUNITY
  → gateStrategicDownstream(CREATE_OPPORTUNITY)  // SPEC-003+004
  → dbService.addOpportunity(...)               // to be demoted
  → OpportunityPanel client lifecycle
```

---

## Side-effect ordering

| Action | Prerequisite | Side effect |
|--------|--------------|-------------|
| Discover/evaluate candidate | none (intelligence) | persistence of candidate/score only |
| Materialize Opportunity | SPEC-004 ALLOW | create Opportunity row |
| Accept/Decline | PROPOSED + HUMAN | status transition |
| Checklist toggle | ACCEPTED/CHECKLIST | checklist mutation |
| Submit | checklist complete + HUMAN | SUBMITTED |
| Content from opportunity later | separate Plan/Brief as applicable | SPEC-004 then SPEC-006 for publish |

**Plan DENY → materialize writes = 0.**  
**Intelligence discovery → execution writes = 0.**

---

## Cross-SPEC read/write

| SPEC | Access by 007 |
|------|----------------|
| 001 | R thesis/routing context |
| 002 | R Strategic Score snapshot refs |
| 003 | R Brief for materialize; **no W** |
| 004 | R authorization decision / Plan binding; **no W Plan** |
| 005 | optional advisory suggest later |
| 006 | none for Opportunity lifecycle; publication separate |
| 009 | future remote rules |

---

## Failure modes

| Condition | Result |
|-----------|--------|
| Missing trusted tenant | DENY |
| Plan deny / stale Brief | DENY materialize |
| Thesis mismatch | DENY |
| Malformed stored Opportunity | FAIL_CLOSED |
| Ambiguous legacy status migrate | no silent coerce |
