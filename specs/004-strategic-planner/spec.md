# Spec 004 — Strategic Planner

| Field | Value |
|-------|--------|
| **Spec ID** | `004-strategic-planner` |
| **Display name** | **SPEC-004 — Strategic Planner** |
| **Status** | **`APPROVED`** (T-004-010 · 2026-08-25 America/Bogota) |
| **Phase** | Phase 0 **COMPLETE** · Phase 1 **COMPLETE** · Phase 2 **COMPLETE** · Phase 3 **COMPLETE** · Phase 4 **NOT_AUTHORIZED** · CODE_COMPLETE **NO** · DEPLOYED **NO** · DONE **NO** |
| **Branch** | `spec/004-strategic-planner` |
| **Baseline SHA** | SPEC-006 CODE_COMPLETE `d98c98ca6ee877fc510d3327bd4b1208d74a7b54` |
| **Upstream SPEC-003** | CODE_COMPLETE @ `e16280607fa078941078d2cb4c233025a1bd66a1` · **FROZEN** |
| **Upstream SPEC-006** | CODE_COMPLETE @ `d98c98ca6ee877fc510d3327bd4b1208d74a7b54` · **FROZEN** |
| **Priority** | P1 (constitution Strategic Circuit — Brief → Planner → execution) |
| **Constitution** | Thesis-first · Multi-thesis native · AI suggests / software governs · Explainability · Tenant security |
| **Depends on** | SPEC-003 (Brief authorization — frozen); SPEC-006 (claim publication — frozen); SPEC-001/002 (read-only context); SPEC-005 (advisory AI); SPEC-009 (CODE_AVAILABLE; production DEFERRED) |
| **Blocks** | Governed execution planning after Brief; strangler of legacy curation→content/delivery/task/opportunity paths |
| **Test baseline (Phase 0)** | `npm run check` → **976/976**; `npm run test:rules` → **91/91** |
| **Human SPEC approval** | **APPROVED** (T-004-010) — «Apruebo formalmente SPEC-004 — Strategic Planner y autorizo el cierre de T-004-010 y el inicio de la Phase 1 de implementación.» — 2026-08-25 (America/Bogota) |

---

## Problem

Postura has a governed Strategic Brief (SPEC-003) and claim publication gate (SPEC-006), but **no canonical Strategic Planner** that owns **execution planning**.

Today, planner-adjacent behavior is **split**:

- SPEC-003 authorizes *whether* a downstream action class is allowed (`authorizedAction`)
- SPEC-006 authorizes *whether claim-bearing content may be published*
- Legacy `main.ts` / curation / delivery / content / work pipelines orchestrate *what happens next* without a SPEC-004 Domain aggregate

Baseline audit historically described SPEC-004 as “Solo curation/delivery” — that is a **gap**, not the constitutional target.

---

## Goal

Formalize SPEC-004 as the constitutional owner of:

> **EXECUTION PLANNING** after a governed Strategic Brief is **APPROVED**.

Core circuit:

```text
Signal → Routing → Scoring → Strategic Decision → Strategic Brief
  → Strategic Planner (SPEC-004)
  → downstream execution artifacts (content / opportunity / task / research intent)
```

Canonical question SPEC-004 answers:

> **What should we execute under this approved Brief?**

---

## Non-Goals

- Routing or scoring recomputation (SPEC-001 / SPEC-002)
- Brief approve / reject / revise / supersede (SPEC-003)
- Claim / Evidence / Verification / AuthorizePublication (SPEC-006)
- Auth JWT / custom claims / production rules (SPEC-009)
- Opportunity Scout product redesign (SPEC-007)
- Learning loop (SPEC-008)
- React migration (SPEC-010)
- New SPEC-005 `AiOperation` in Phase 0
- Production deployment / backfill

---

## Canonical artifact

**Chosen name: `StrategicPlan`**

Why:

- Aligns with `StrategicBrief`, Strategic Decision, and constitution directory `004-strategic-planner`
- Distinct from legacy `CurationEntry`, `DeliveryPackage`, content pipeline status
- Avoids ambiguous “ActionPlan” / “PlannerDecision” that could be confused with Brief decision

Supporting entity: **`PlanItem`** — one governed intended execution action under a plan.

---

## Authority owned by SPEC-004

| Owns | Does **not** own |
|------|------------------|
| `StrategicPlan` + `PlanItem` lifecycle | Strategic Brief approval |
| Boundedness to Brief `authorizedAction` | Routing / scoring |
| Explicit thesis preservation from Brief | Claim verification / publication |
| Priority / ordering of plan items | AI truth |
| Human plan approval (where required) | Tenant auth claims |
| Explainable execution rationale | Opportunity domain redesign |

**Authority separation:**

```text
SPEC-003 = SHOULD we act strategically? (approved Brief + authorizedAction)
SPEC-004 = WHAT should we execute under that Brief?
SPEC-006 = CAN claim-bearing content be PUBLISHED?
```

---

## Authorized action upper bound (SPEC-003 frozen)

`StrategicAuthorizedAction` (from `strategicBriefCore`):

- `CREATE_CONTENT`
- `CREATE_OPPORTUNITY`
- `CREATE_TASK`
- `RESEARCH_ONLY`
- `NONE`

**Invariant:** A PlanItem action **must** be equal to (or a governed subset of) the governing Brief’s `decision.authorizedAction`.  
`NONE` ⇒ no executable PlanItem may activate.

SPEC-004 **must not invent** new strategic action classes outside this enum without a formal cross-SPEC change.

---

## Constitutional requirements

| Theme | SPEC-004 implication |
|-------|----------------------|
| Thesis-first / multi-thesis | Plan inherits Brief `thesisId`; no `[0]` / primary / winner fallback |
| AI suggests / software governs | Advisor may propose plan items; cannot approve/activate |
| Explainability | Brief/thesis/action/why/priority/version reconstructable |
| Tenant | `organizationId` + `clientId` on plan and items |
| Provenance | Brief id+version, signalIds, optional evidence context refs |
| Risk | Fail closed on stale/superseded Brief; no silent AI approval |

---

## Brief scope model

**Chosen: one `StrategicPlan` ↔ one governing `StrategicBrief` revision.**

Rationale: mixed-Brief / mixed-thesis aggregation introduces ambiguous authority. Multi-Brief aggregation is **OUT OF SCOPE** unless a future approved design governs it. Multiple plans may exist for different Briefs/theses of the same client.

---

## StrategicPlan lifecycle (canonical)

```text
DRAFT ──propose──► PROPOSED ──approve──► APPROVED ──activate──► ACTIVE
  │                   │                     │                    │
  │                   └──reject──► REJECTED  │                    ├──complete──► COMPLETED
  │                                          │                    └──cancel───► CANCELLED
  └──cancel──► CANCELLED                     └──material revise──► new DRAFT + prior SUPERSEDED
```

| Status | Meaning | Execution authorize? |
|--------|---------|----------------------|
| `DRAFT` | Authoring | No |
| `PROPOSED` | Awaiting human plan approval | No |
| `APPROVED` | Human-approved plan (current) | Items may activate if Brief still valid |
| `REJECTED` | Explicitly rejected | No |
| `ACTIVE` | At least one item in progress (or plan marked active) | Yes (with Brief revalidation) |
| `COMPLETED` | All required items complete | No new activations |
| `CANCELLED` | Explicit cancel | No |
| `SUPERSEDED` | Replaced by newer plan revision | No |

Exact transition rules: see `planner-model.md`.

---

## Execution gate (conceptual)

`AuthorizePlannedAction` / Domain predicate must require:

1. Plan current (not SUPERSEDED / CANCELLED / REJECTED)
2. Plan APPROVED or ACTIVE as defined
3. PlanItem current and eligible
4. Governing Brief **APPROVED**, current version match, not SUPERSEDED
5. Tenant match (org + client)
6. Thesis match Brief.thesisId
7. Item action allowed by Brief.authorizedAction
8. Trusted human actor for approval transitions
9. No SPEC-006 publication logic inside this gate

Fail closed otherwise.

---

## Stale Brief

If Brief v1 is SUPERSEDED / no longer current while Plan references v1:

- Plan **fails closed** for new activations
- Material revalidation required → revise plan to Brief v2 (new plan revision) + human re-approval as defined by materiality

History of old plan remains audit; current authority does not.

---

## AI boundary

| Allowed | Forbidden |
|---------|-----------|
| Advisory suggestion of plan items / ordering via SPEC-005 Gateway | AI sets plan status APPROVED/ACTIVE |
| Persist advisory refs on plan for audit | Direct provider calls from planner Domain/App |
| Existing operations (e.g. curation angle advisory) as compatibility | New `AiOperation` in Phase 0 |

**Future operation** (documentation only): `PLAN_SUGGEST` — **PROPOSED_FUTURE_NONBLOCKING**. Not required for CODE_COMPLETE if deterministic plan creation from Brief is sufficient.

---

## Persistence target

Phases 1–2: design only.  
Phase 3+: **LOCAL_AUTHORITATIVE** (project pattern).  
Remote Firestore/rules: **DEPLOYMENT_ONLY / DEFERRED_TO_SPEC-009**.

---

## Findings (Phase 0 formalization)

| ID | Sev | Finding | Status after Phase 0 |
|----|-----|---------|----------------------|
| **F-004-01** | P1 | No SPEC-004 governance package | **RESOLVED** by Phase 0 package |
| **F-004-02** | P1 | No canonical StrategicPlan Domain/Application | **RESOLVED** for Domain (Phase 1); Application remains Phase 2 work |
| **F-004-03** | P2 | Legacy curation/delivery/content split execution authority | **OPEN** — Phase 4 strangler |
| **F-004-04** | P3 | Historic “curation/delivery only” naming vs Strategic Planner | **OPEN_NONBLOCKING** |

**P0 = 0** · **P1 open = 0** · **P2 = 1** · **P3 = 1**

Audit mapping: AUDIT-004-01 → F-004-01; AUDIT-004-02 → F-004-03; AUDIT-004-03 → F-004-03; AUDIT-004-04 → F-004-04.

---

## Implementation authorization

| Gate | State |
|------|-------|
| Phase 0 governance | **COMPLETE** |
| Human SPEC approval (T-004-010) | **DONE** — **APPROVED** 2026-08-25 (America/Bogota) |
| Phase 1 Domain | **COMPLETE** (T-004-101…110) |
| Phase 2 Application | **COMPLETE** (T-004-201…211) |
| Phase 3 Persistence | **COMPLETE** (T-004-301…308) · **LOCAL_AUTHORITATIVE** |
| Phase 4 Consumer | **NOT_AUTHORIZED** |
| CODE_COMPLETE | **NO** |
| Deployment | **NOT_STARTED** |
| DONE | **NO** |

**Next action:** Human authorization for Phase 4 Consumer migration. Do not begin T-004-401… without approval.
