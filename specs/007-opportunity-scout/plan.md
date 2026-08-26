# Plan 007 — Opportunity Scout

| Field | Value |
|-------|--------|
| **Spec** | `007-opportunity-scout` |
| **Phase** | **CODE_COMPLETE = YES** · FREEZE **ACTIVE** · DEPLOYED **NO** · DONE **NO** · DEPLOYMENT **NOT_STARTED** |
| **Status** | **`APPROVED`** · A1–A40 **40 PASS** · threats **18/18 PASS** · T-007-604 **DONE** · human CODE_COMPLETE **APPROVED** |
| **Strategy** | **Strangler / Incremental Migration** — **NO BIG-BANG REWRITE** |
| **Baseline SHA** | SPEC-004 CODE_COMPLETE `8661e4a2c272372e4d851bdb01d10f85b447e27c` |
| **Branch** | `spec/007-opportunity-scout` |
| **Human SPEC approval** | **APPROVED** (T-007-010) — 2026-08-26 (America/Bogota) |

---

## Why incremental

Working Opportunity flows already exist:

- SPEC-003/004 gate on `CREATE_OPPORTUNITY` before canonical `MaterializeOpportunity` (via `opportunityScoutConsumer`)
- Client “The Scout” UI with accept/decline/checklist/submit via Application
- Domain helpers: `opportunityLifecycle` (COMPATIBILITY templates), `clientOpportunityCore` (DISPLAY_ONLY spotlight)
- Local persistence: canonical `postura_opportunity_v1*` + legacy `postura_opportunities_v5` COMPATIBILITY mirror

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

### Phase 0 — Formal package ✅ COMPLETE

- Author governance docs
- Inventory legacy surfaces
- Resolve pre-Brief vs post-Plan split
- Define models, gates, threats, acceptance, tasks
- Human SPEC approval gate **DONE** (T-007-010 · 2026-08-26 America/Bogota)

### Phase 1 — Domain ✅ COMPLETE

- OpportunityCandidate / OpportunityScore / Opportunity — **DONE**
- Canonical lifecycle machine — **DONE**
- Tenant + thesis validators — **DONE**
- Materialize gate predicates (consume Plan authorization decision) — **DONE**
- Explainability shapes — **DONE**
- Domain + architecture tests — **DONE**
- Application / Persistence / Consumer — **NONE**

### Phase 2 — Application ✅ COMPLETE

- Use cases T-007-201…211 — **DONE**
- Ports + trusted actor — **DONE**
- SPEC-004 authorization facade consumption — **DONE**
- No Infrastructure adapters — **NONE**
- RUNTIME AI advisor = port-only optional (unimplemented)

### Phase 3 — Persistence ✅ COMPLETE

- Local-authoritative Candidate / Opportunity / history / idempotency stores — **DONE**
- Schema version + malformed fail-closed — **DONE**
- Stale write / duplicate-current fail-closed — **DONE**
- Legacy `postura_opportunities_v5` COMPATIBILITY reader — **DONE** (not authority)
- db.ts / consumer / UI — **NONE**
- Guarantee: coherent in-memory write unit + persist (not distributed ACID)

### Phase 4 — Consumer migration ✅ COMPLETE

- Composition: `composeOpportunityScout` + `opportunityScoutConsumer` — **DONE**
- `main.ts` CREATE_OPPORTUNITY → `materializeOpportunityForDelivery` — **DONE**
- OpportunityPanel / ClientPortal → Application list + intent triggers — **DONE**
- `dbService` Opportunity mutators demoted; mirror after canonical success only — **DONE**
- SPEC-003/004/006 boundaries preserved — **DONE**
- Spotlight `[0]` remains DISPLAY_ONLY (AUDIT007-08 OPEN_NONBLOCKING)

### Phase 5 — Security ✅ COMPLETE

- Threats T-007-01…18 — **18/18 PASS**
- Architecture / legacy bypass / cross-SPEC regressions — **DONE**
- Product fixes — **0**
- AUDIT007-08 remains OPEN_NONBLOCKING (DISPLAY_ONLY spotlight)

### Phase 6 — Acceptance ✅ COMPLETE (CODE_COMPLETE YES)

- A1–A40 consolidated — **40 PASS**
- `npm run check` / `test:rules` — **PASS**
- Human CODE_COMPLETE (T-007-604) — **DONE** · **APPROVED** 2026-08-26 America/Bogota
- CODE_COMPLETE_CANDIDATE — **YES**
- CODE_COMPLETE — **YES**
- DEPLOYED/DONE — **NO** / **NOT_STARTED**
- FREEZE — **ACTIVE**

---

## Proposed use cases (Phase 2 — implemented)

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
| F-007-02 | P1 | **RESOLVED** (consumer Application authority; db/UI/main demoted) |
| F-007-03 | P2 | **RESOLVED** (dual lifecycle COMPATIBILITY only; canonical status authoritative) |
| F-007-04 | P2 | **RESOLVED** (id-only `getOpportunityById` not on active SPEC-007 paths) |
| F-007-05 | P2 | **RESOLVED** (consumers use Application; no UI score→materialize) |
| F-007-06 | P2 | **RESOLVED** Phase 0 design |
| F-007-07 | P3 | **RESOLVED** (durable Opportunity-owned history LOCAL_AUTHORITATIVE) |
| F-007-08 | P3 | **OPEN_NONBLOCKING** display |

---

## Prohibited without separate authorization

- Modify frozen SPEC-003 / SPEC-004 / SPEC-006
- New AiOperation
- Production deploy / rules
- Begin Phase 1 before T-007-010
- Big-bang rewrite of OpportunityPanel / db.ts / main.ts
