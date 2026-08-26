# Plan 004 — Strategic Planner

| Field | Value |
|-------|--------|
| **Spec** | `004-strategic-planner` |
| **Phase** | **Phase 0 COMPLETE** · **Phase 1 COMPLETE** · **Phase 2 COMPLETE** · **Phase 3 COMPLETE** · **Phase 4 COMPLETE** · **Phase 5 COMPLETE** · **Phase 6 EVIDENCE COMPLETE** · CODE_COMPLETE_CANDIDATE **YES** · CODE_COMPLETE **NO** · DEPLOYED **NO** · DONE **NO** |
| **Status** | **`APPROVED`** (T-004-010) |
| **Strategy** | **Strangler / Incremental Migration** — **NO BIG-BANG REWRITE** |
| **Baseline SHA** | SPEC-006 CODE_COMPLETE `d98c98ca6ee877fc510d3327bd4b1208d74a7b54` |
| **Branch** | `spec/004-strategic-planner` |
| **Human SPEC approval** | **APPROVED** (T-004-010) — 2026-08-25 (America/Bogota) |

---

## Why incremental

Working operational flows already exist:

- SPEC-003 Brief gate on strategic content / opportunity / task / delivery
- SPEC-006 claim publication gate on gated content statuses
- Legacy curation → delivery → content / work pipelines in `main.ts`

Debt is **missing StrategicPlan ownership**, not absence of any execution path.

Therefore:

1. Phase 0 — Formal package + inventory — **THIS PHASE**
2. Phase 1 — Domain (`StrategicPlan`, `PlanItem`, gates, materiality)
3. Phase 2 — Application use cases + ports
4. Phase 3 — Local-authoritative persistence + history
5. Phase 4 — Consumer / curation strangler migration
6. Phase 5 — Security / adversarial
7. Phase 6 — Acceptance + human CODE_COMPLETE
8. Deployment D1–D3 — separate; SPEC-009 production DEFERRED

---

## Dependencies

| Dependency | State | Impact |
|------------|-------|--------|
| SPEC-003 Strategic Brief | **CODE_COMPLETE** @ `e162806` · **FROZEN** | **REQUIRED** — consume Brief; no mutate |
| SPEC-006 Claim linking | **CODE_COMPLETE** @ `d98c98c` · **FROZEN** | **REQUIRED** — publication remains SPEC-006 |
| SPEC-001 routing | **CODE_COMPLETE** | Read-only context via Brief thesis |
| SPEC-002 scoring | **CODE_COMPLETE** | Read-only; no rescore / winner |
| SPEC-005 AI Gateway | **CODE_COMPLETE** | Advisory only; no new AiOperation in Phase 0 |
| SPEC-009 security | **CODE_AVAILABLE**; production **DEFERRED** | NONBLOCKING for 004 CODE_COMPLETE (local) |

---

## Strangler target

```text
CURRENT (legacy):
  CurationEntry destination → Brief create/approve (SPEC-003)
    → main orchestrates content / opportunity / task / delivery
    → SPEC-006 gate on content publication

TARGET:
  Approved StrategicBrief
    → CreateStrategicPlan / AddPlanItem / ApproveStrategicPlan
    → AuthorizePlannedAction
    → materialize downstream artifact (content/opportunity/task)
    → SPEC-006 AuthorizePublication when claim-bearing publish
```

CurationEntry → **COMPATIBILITY / intake** (not Plan authority).  
DeliveryPackage → **downstream packaging** (OTHER_SPEC / keep).  
Content → **downstream** (SPEC-006 publication).

---

## Phase plan

### Phase 0 — Formal package (DONE this commit)

- Author governance docs
- Inventory legacy surfaces
- Define models, gates, threats, acceptance, tasks
- Human SPEC approval gate **PENDING** (T-004-010)

### Phase 1 — Domain ✅ COMPLETE

- StrategicPlan / PlanItem types
- PlanStatus / PlanItemStatus machines
- Tenant + Brief binding validators
- AuthorizePlannedAction predicates
- Materiality / stale Brief rules
- Domain + architecture tests

### Phase 2 — Application ✅ COMPLETE

- Use cases T-004-201…
- Ports + trusted actor
- No Infrastructure adapters yet
- RUNTIME AI advisor = DEFERRED / port-only if needed

### Phase 3 — Persistence ✅ COMPLETE

- Local-authoritative plan/item/history stores
- Idempotency
- LOCAL_AUTHORITATIVE

### Phase 4 — Consumer migration ✅ COMPLETE

- Strangle main curation→execution paths through StrategicPlan
- Demote CurationEntry authority
- Preserve SPEC-003 / SPEC-006 gates

### Phase 5 — Security ✅ COMPLETE

- Threats T-004-01…17 = **17/17 PASS**
- Dedicated suites: `strategicPlanPhase5` + `strategicPlanSecurityArchitecture` (**50/50**)
- Cross-SPEC regressions green; product fixes = 0
- SPEC-009 production deferred unchanged

### Phase 6 — Acceptance ✅ EVIDENCE COMPLETE

- A1–A42 = **42/42 PASS** (fresh cross-SPEC + full baseline)
- T-004-601/602/603/605 **DONE**
- T-004-604 human CODE_COMPLETE sign-off **PENDING**
- CODE_COMPLETE_CANDIDATE = **YES** · CODE_COMPLETE = **NO**

---

## Proposed use cases (Phase 2 — not implemented)

| Use case | Purpose |
|----------|---------|
| `CreateStrategicPlan` | Bind plan to APPROVED Brief revision |
| `AddPlanItem` / `RemovePlanItem` | Governed item set |
| `ReviseStrategicPlan` | Material revise → new version / supersede |
| `ProposeStrategicPlan` | DRAFT → PROPOSED |
| `ApproveStrategicPlan` / `RejectStrategicPlan` | Human plan authority |
| `AuthorizePlannedAction` | Decision only — may item proceed? |
| `ActivatePlanItem` / `CompletePlanItem` / `CancelPlanItem` | Item lifecycle |
| `RevalidatePlanAgainstBrief` | Stale Brief fail-closed / rebind |

**Not included without evidence of need:** multi-Brief aggregation, external planner providers, bulk backfill.

---

## Persistence strategy

| Phase | Authority |
|-------|-----------|
| 0–2 | Design only |
| 3–6 CODE_COMPLETE | **LOCAL_AUTHORITATIVE** |
| Production remote | **REMOTE_FUTURE** + SPEC-009 |

---

## Findings carried into plan

| ID | Sev | Action |
|----|-----|--------|
| F-004-01 | P1 | **RESOLVED** Phase 0 |
| F-004-02 | P1 | Domain **RESOLVED** Phase 1; Application Phase 2 |
| F-004-03 | P2 | **RESOLVED** Phase 4 |
| F-004-04 | P3 | Docs title; legacy names OK |

---

## Prohibited without separate authorization

- Modify frozen SPEC-003 / SPEC-006
- New AiOperation
- Production deploy / rules
- Begin Phase 1 before T-004-010
- Big-bang rewrite of main.ts
