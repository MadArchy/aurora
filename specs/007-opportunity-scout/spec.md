# Spec 007 — Opportunity Scout

| Field | Value |
|-------|--------|
| **Spec ID** | `007-opportunity-scout` |
| **Display name** | **SPEC-007 — Opportunity Scout** |
| **Status** | **`APPROVED`** · CODE_COMPLETE_CANDIDATE **YES** · CODE_COMPLETE **NO** (T-007-604 PENDING) |
| **Phase** | Phase 0–6 technical **COMPLETE** · human CODE_COMPLETE **PENDING** · deployment **NOT_STARTED** |
| **Branch** | `spec/007-opportunity-scout` |
| **Baseline SHA** | SPEC-004 CODE_COMPLETE final freeze `8661e4a2c272372e4d851bdb01d10f85b447e27c` |
| **Priority** | P1 (constitution §32 Strategic Circuit — Opportunity Intelligence + Opportunity Execution) |
| **Constitution** | Thesis-first · Multi-thesis native · Explainable Opportunity Score · AI suggests / software governs · Tenant security |
| **Depends on** | SPEC-001/002 (read-only context); SPEC-003 (Brief — frozen); SPEC-004 (CREATE_OPPORTUNITY gate — frozen); SPEC-005 (advisory AI — optional future); SPEC-006 (publication — frozen, non-ownership); SPEC-009 (CODE_AVAILABLE; production DEFERRED) |
| **Blocks** | Governed Opportunity Intelligence and post-Plan Opportunity lifecycle |
| **Test baseline (Phase 3)** | Persistence + Infra arch · Phase-2/1 regression · legacy Opportunity · full check + rules at Phase-3 exit |
| **Human SPEC approval** | **APPROVED** (T-007-010) — «Apruebo formalmente SPEC-007 — Opportunity Scout y autorizo el cierre de T-007-010 y el inicio de la Phase 1 de implementación.» — 2026-08-26 (America/Bogota) |

---

## Problem

POSTURA’s constitutional circuit includes **OPPORTUNITY INTELLIGENCE** and later **OPPORTUNITY EXECUTION**, and the constitution requires that **no Opportunity Score be a black box**. The repository already has:

- a legacy `Opportunity` model + dual status/lifecycle mapping
- “The Scout” UI (`OpportunityPanel`, ClientPortal)
- localStorage `postura_opportunities_v5` via `dbService`
- create paths in `main.ts` that materialize Opportunities after SPEC-003/004 `CREATE_OPPORTUNITY` gates

But **no formal SPEC-007 package** exists. Opportunity Intelligence and Opportunity lifecycle are split across UI/db/main without Domain/Application ownership, tenant-safe repository identity, explainable Opportunity Score, or clear separation of **intelligence vs execution**.

---

## Goal

Formalize SPEC-007 as the constitutional owner of:

> **OPPORTUNITY INTELLIGENCE + GOVERNED OPPORTUNITY LIFECYCLE**

### Stage A — Opportunity Intelligence (pre-Brief allowed)

Discover, normalize, evaluate, score, explain, and recommend **Opportunity Candidates**.

- May exist **before** Strategic Brief / Strategic Planner.
- **Does not** authorize execution or materialization.

### Stage B — Materialized Opportunity (post-Plan only)

Create and govern the operational `Opportunity` aggregate **only after**:

```text
trusted tenant + trusted actor
+ APPROVED/current StrategicBrief
+ approved/current StrategicPlan
+ PlanItem / CREATE_OPPORTUNITY context
+ SPEC-004 AuthorizePlannedAction(CREATE_OPPORTUNITY) = ALLOW
```

Then SPEC-007 owns the Opportunity lifecycle (accept/decline/checklist/submit/close).

**Hard invariant:** `INTELLIGENCE ≠ EXECUTION AUTHORITY`.

Canonical question Stage A answers:

> **What external opportunity should we evaluate under which thesis context, and why?**

Canonical question Stage B answers:

> **Given Plan authorization to CREATE_OPPORTUNITY, how does this Opportunity progress with the client?**

---

## Non-Goals

- Thesis routing / `selectedThesisId` mutation (SPEC-001)
- Strategic Signal scoring / disposition recompute (SPEC-002)
- Brief approve / reject / revise / supersede (SPEC-003)
- StrategicPlan / PlanItem / AuthorizePlannedAction ownership (SPEC-004)
- New AiOperation / provider keys (SPEC-005) — advisory only if later proposed
- Claim / Evidence / Verification / AuthorizePublication (SPEC-006)
- Auth JWT / custom claims / production rules deploy (SPEC-009)
- Learning loop (SPEC-008)
- React migration (SPEC-010)
- Production deployment / Firestore opportunity backfill in implementation Phases 1–6

---

## Canonical artifacts

| Artifact | Stage | Role |
|----------|-------|------|
| **`OpportunityCandidate`** | A | Pre-Brief / intelligence projection; evaluable; non-executable |
| **`OpportunityScore`** | A | Explainable opportunity-specific score (≠ SPEC-002 Strategic Score) |
| **`Opportunity`** | B | Materialized operational aggregate after SPEC-004 gate |
| **`OpportunityChecklistItem`** | B | Submission checklist under Opportunity |
| **`OpportunityHistoryRecord`** | A/B | Append-only audit — **not** current authority |

Naming decision: retain repository `Opportunity` for Stage B (matches types + UI “The Scout”). Introduce `OpportunityCandidate` for Stage A because no first-class pre-Brief intelligence artifact exists today.

---

## Authority owned by SPEC-007

| Owns | Does **not** own |
|------|------------------|
| OpportunityCandidate lifecycle + evaluation | Strategic Brief approval |
| Opportunity Score (dimensions, version, reasons) | Strategic Signal Score (SPEC-002) |
| Materialized Opportunity lifecycle after Plan gate | StrategicPlan / PlanItem / AuthorizePlannedAction |
| Thesis-explicit opportunity evaluations | Thesis routing / primary selection |
| Explainability of opportunity recommendations | Claim verification / publication |
| Tenant-safe Opportunity repositories (design) | Auth claims / production rules |

**Authority separation:**

```text
SPEC-001/002 = route/score signals under theses (READ_ONLY to 007)
SPEC-003     = SHOULD we act strategically? (Brief)
SPEC-004     = MAY we CREATE_OPPORTUNITY under this Plan?
SPEC-007     = WHAT opportunity intelligence exists, and HOW does a
               materialized Opportunity progress after Plan allow?
SPEC-006     = MAY claim-bearing content publish? (orthogonal)
```

---

## Findings (Phase 0 formalization of AUDIT007-*)

| ID | Sev | Finding | Phase 0 disposition |
|----|-----|---------|---------------------|
| **F-007-01** | P1 | No SPEC-007 governance package | **RESOLVED** by this package (AUDIT007-01) |
| **F-007-02** | P1 | No Application/ports; authority in db/UI/main | **APPLICATION_IMPLEMENTED_MIGRATION_PENDING** (AUDIT007-02) |
| **F-007-03** | P2 | Dual `OpportunityStatus` / `lifecycleStage` | **PERSISTENCE_READY_MIGRATION_PENDING** (AUDIT007-03) |
| **F-007-04** | P2 | `getOpportunityById` id-only | **INFRASTRUCTURE_TENANT_SAFE_LEGACY_PENDING** — canonical store tenant-safe; db.ts unchanged (AUDIT007-04) |
| **F-007-05** | P2 | No explainable Opportunity Score artifact | **APPLICATION_SCORE_WORKFLOW_IMPLEMENTED_CONSUMER_PENDING** (AUDIT007-05) |
| **F-007-06** | P2 | Pre-Brief intelligence vs post-Plan create ambiguity | **RESOLVED** — Stage A/B split (AUDIT007-06) |
| **F-007-07** | P3 | No Opportunity-owned history | **RESOLVED** — durable LOCAL history AUDIT_ONLY (AUDIT007-07) |
| **F-007-08** | P3 | Spotlight `[0]` after heuristic sort | **OPEN_NONBLOCKING** (AUDIT007-08) |

**P0 = 0** · **P1 open = 1** (F-007-02 migration) · **P2 = 0 open** · **P3 = 1 open nonblocking**

---

## Implementation authorization

| Gate | State |
|------|-------|
| Phase 0 governance | **COMPLETE** |
| Human SPEC approval (T-007-010) | **DONE** · **APPROVED** 2026-08-26 (America/Bogota) |
| Phase 1 Domain | **COMPLETE** (T-007-101…110) |
| Phase 2 Application | **COMPLETE** (T-007-201…211) |
| Phase 3 Persistence | **COMPLETE** (T-007-301…308) · **LOCAL_AUTHORITATIVE** |
| Phase 4 Consumer | **COMPLETE** (T-007-401…407) |
| Phase 5 Security | **COMPLETE** (T-007-501…510) · threats 18/18 PASS |
| Phase 6 technical evidence | **COMPLETE** (T-007-601…603,605) · A1–A40 **40 PASS** |
| Human CODE_COMPLETE (T-007-604) | **PENDING** |
| CODE_COMPLETE CANDIDATE | **YES** |
| CODE_COMPLETE | **NO** |
| Deployment | **NOT_STARTED** |
| DONE | **NO** |

**Next action:** Await human T-007-604 CODE_COMPLETE approval. Do not deploy. Do not start SPEC-008.
