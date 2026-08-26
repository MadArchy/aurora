# Plan 007 — Opportunity Scout

| Field | Value |
|-------|--------|
| **Spec** | `007-opportunity-scout` |
| **Phase** | Phase 0 **COMPLETE** (governance) · Implementation **NOT_AUTHORIZED** · CODE_COMPLETE **NO** · DEPLOYED **NO** · DONE **NO** |
| **Status** | **`READY_FOR_HUMAN_APPROVAL`** (T-007-010 PENDING) |
| **Strategy** | **Strangler / Incremental Migration** — **NO BIG-BANG REWRITE** |
| **Baseline SHA** | SPEC-004 CODE_COMPLETE `8661e4a2c272372e4d851bdb01d10f85b447e27c` |
| **Branch** | `spec/007-opportunity-scout` |
| **Human SPEC approval** | **PENDING** (T-007-010) |

---

## Why incremental

Working Opportunity flows already exist:

- SPEC-003/004 gate on `CREATE_OPPORTUNITY` before `dbService.addOpportunity` in `main.ts`
- Client “The Scout” UI with accept/decline/checklist/submit
- Domain helpers: `opportunityLifecycle`, `clientOpportunityCore`
- Local persistence: `postura_opportunities_v5`

Debt is **missing Opportunity Intelligence ownership + governed lifecycle Application**, not absence of any Opportunity path.

Therefore:

1. Phase 0 — Formal package + inventory — **THIS PHASE**
2. Phase 1 — Domain (`OpportunityCandidate`, `OpportunityScore`, `Opportunity`, gates)
3. Phase 2 — Application use cases + ports
4. Phase 3 — Local-authoritative persistence + history
5. Phase 4 — Consumer / db/UI/main strangler migration
6. Phase 5 — Security / adversarial
7. Phase 6 — Acceptance + human CODE_COMPLETE
8. Deployment D1–D3 — separate; SPEC-009 production DEFERRED

---

## Dependencies

| Dependency | State | Impact |
|------------|-------|--------|
| SPEC-004 Strategic Planner | **CODE_COMPLETE** @ `8661e4a` · **FROZEN** | **REQUIRED** — CREATE_OPPORTUNITY gate |
| SPEC-003 Strategic Brief | **CODE_COMPLETE** @ `e162806` · **FROZEN** | **REQUIRED** — Brief context for materialization |
| SPEC-001 routing | **CODE_COMPLETE** | Read-only thesis context |
| SPEC-002 scoring | **CODE_COMPLETE** | Read-only Strategic Score; **not** Opportunity Score |
| SPEC-005 AI Gateway | **CODE_COMPLETE** | Advisory only; no new AiOperation in Phase 0 |
| SPEC-006 Claim linking | **CODE_COMPLETE** @ `d98c98c` · **FROZEN** | Non-ownership; publication remains 006 |
| SPEC-009 security | **CODE_AVAILABLE**; production **DEFERRED** | NONBLOCKING for 007 local CODE_COMPLETE |

---

## Strangler target

```text
CURRENT (legacy):
  Delivery/curation → gateStrategicDownstream(CREATE_OPPORTUNITY)
    → dbService.addOpportunity (LOCAL)
    → UI accept/checklist/submit via dbService

TARGET:
  Stage A:
    Signals/context → OpportunityCandidate → OpportunityScore → recommend
  Stage B:
    SPEC-004 AuthorizePlannedAction(CREATE_OPPORTUNITY) = ALLOW
      → MaterializeOpportunity (Application)
      → Opportunity lifecycle use cases
      → UI displays / triggers only
```

---

## Phase plan

### Phase 0 — Formal package (DONE this commit)

- Author governance docs
- Inventory legacy surfaces
- Resolve pre-Brief vs post-Plan split
- Define models, gates, threats, acceptance, tasks
- Human SPEC approval gate **PENDING** (T-007-010)

### Phase 1 — Domain (NOT AUTHORIZED)

- OpportunityCandidate / OpportunityScore / Opportunity
- Canonical lifecycle machine
- Tenant + thesis validators
- Materialize gate predicates (consume Plan authorization decision)
- Explainability shapes

### Phase 2 — Application (NOT AUTHORIZED)

- Use cases T-007-201…
- Ports + trusted actor
- No Infrastructure adapters yet
- RUNTIME AI advisor = DEFERRED / port-only if needed

### Phase 3 — Persistence (NOT AUTHORIZED)

- Local-authoritative candidate/opportunity/history stores
- Idempotency
- LOCAL_AUTHORITATIVE

### Phase 4 — Consumer migration (NOT AUTHORIZED)

- Strangle main/db/UI Opportunity paths through Application
- Preserve SPEC-003/004 gates; demote raw db authority

### Phase 5 — Security (NOT AUTHORIZED)

- Threats T-007-01…18
- Cross-SPEC regressions

### Phase 6 — Acceptance (NOT AUTHORIZED)

- A* evidence + human CODE_COMPLETE (T-007-604)

---

## Proposed use cases (Phase 2 — not implemented)

| Use case | Stage | Purpose |
|----------|-------|---------|
| `RegisterOpportunityCandidate` | A | Create/normalize candidate |
| `EvaluateOpportunityCandidate` | A | Compute OpportunityScore |
| `ReevaluateOpportunityCandidate` | A | Re-score on material input change |
| `RecommendOpportunityCandidate` | A | Surface recommendation (non-executing) |
| `MaterializeOpportunity` | B | Create Opportunity after SPEC-004 allow |
| `GetOpportunity` / `ListOpportunities` | B | Tenant-safe reads |
| `AcceptOpportunity` / `DeclineOpportunity` | B | Human client/manager decisions |
| `UpdateOpportunityChecklist` | B | Checklist item toggles |
| `SubmitOpportunity` / `CompleteOpportunity` / `ArchiveOpportunity` | B | Lifecycle advances |
| `AppendOpportunityHistory` | A/B | Material event audit |

**Not included without evidence of need:** external opportunity marketplace providers, bulk historic backfill as blocking CODE_COMPLETE.

---

## Persistence strategy

| Phase | Authority |
|-------|-----------|
| 0–2 | Design only |
| 3–6 CODE_COMPLETE | **LOCAL_AUTHORITATIVE** |
| Production remote | **REMOTE_FUTURE** + SPEC-009 |

Legacy key `postura_opportunities_v5` → migrate under Phase 3–4 adapters (COMPATIBILITY then DEPRECATE).

---

## Findings carried into plan

| ID | Sev | Action |
|----|-----|--------|
| F-007-01 | P1 | **RESOLVED** Phase 0 |
| F-007-02 | P1 | Application Phases 2–4 |
| F-007-03 | P2 | Domain Phase 1 + migrate Phase 4 |
| F-007-04 | P2 | Ports/Infra Phase 2–3 |
| F-007-05 | P2 | Domain Phase 1 + App Phase 2 |
| F-007-06 | P2 | **RESOLVED** Phase 0 design |
| F-007-07 | P3 | Infra Phase 3 |
| F-007-08 | P3 | OPEN_NONBLOCKING display |

---

## Prohibited without separate authorization

- Modify frozen SPEC-003 / SPEC-004 / SPEC-006
- New AiOperation
- Production deploy / rules
- Begin Phase 1 before T-007-010
- Big-bang rewrite of OpportunityPanel / db.ts / main.ts
