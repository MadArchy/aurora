# Migration matrix 007 — Opportunity Scout

**Phase 0 inventory only.** No code migration performed.

Baseline SHA: SPEC-004 CODE_COMPLETE `8661e4a2c272372e4d851bdb01d10f85b447e27c`

Legend: **KEEP** · **MIGRATE** · **ADAPT** · **DEPRECATE** · **OTHER_SPEC** · **COMPATIBILITY** · **MISSING**

---

## Cross-SPEC contract table

| SPEC | Consumed contract | R/W | Authority owner | Mutation by 007? | Failure |
|------|-------------------|-----|-----------------|------------------|---------|
| 001 | thesis / routing context | R | SPEC-001 | **No** | Fail closed if missing when required |
| 002 | Strategic Score snapshot | R | SPEC-002 | **No** | No rescore / winner |
| 003 | Brief id/version/status | R | SPEC-003 | **No** | Stale/non-APPROVED deny materialize |
| 004 | AuthorizePlannedAction CREATE_OPPORTUNITY | call existing | SPEC-004 | **No** | Plan deny → no materialize |
| 005 | Advisory Gateway ops | R (suggest) | SPEC-005 | **No** new ops | Advisory failure non-blocking |
| 006 | AuthorizePublication | none for Opportunity | SPEC-006 | **No** | N/A |
| 009 | Tenant/auth claims production | — | SPEC-009 | **No** | DEFERRED_UNCHANGED |

---

## Legacy / adjacent surface inventory

| Location | Previous authority | Canonical replacement | Classification | Phase |
|----------|--------------------|----------------------|----------------|-------|
| `src/domain/opportunityLifecycle.ts` | Lifecycle map + checklist templates | Domain lifecycle core | **MIGRATE** → Domain | 1–4 |
| `src/domain/clientOpportunityCore.ts` | Spotlight / reminder heuristics | Display helpers or App queries | **ADAPT** | 4 |
| `src/types` `Opportunity*` | Type source of truth | Domain types + adapters | **ADAPT** | 1–3 |
| `src/services/db.ts` opportunity methods | Create/update/submit authority | Application + Infra ports | **MIGRATE** then **DEPRECATE** authority | 3–4 |
| `postura_opportunities_v5` | LOCAL_AUTHORITATIVE store | New schema keys + compatibility reader | **COMPATIBILITY** → migrate | 3–4 |
| `src/components/OpportunityPanel.ts` | UI + triggers via db | Consumer facade triggers | **ADAPT** | 4 |
| `src/components/ClientPortal.ts` Scout section | Display | Display + consumer | **ADAPT** | 4 |
| `src/main.ts` OPPORTUNITY destination | Create after gate | `MaterializeOpportunity` | **MIGRATE** | 4 |
| `src/services/reminders.ts` opportunity reminders | Operational | Keep; read via ports later | **ADAPT** | 4 |
| Firestore `clients/{id}/opportunities` | Remote rules (SPEC-009) | Future remote | **OTHER_SPEC** / D1 | Deploy |
| SPEC-002 CREATE_OPPORTUNITY disposition | Signal recommendation | Remains SPEC-002 | **KEEP_OTHER_SPEC** | — |
| SPEC-004 PlanItem CREATE_OPPORTUNITY | Execution allow | Remains SPEC-004 | **KEEP_OTHER_SPEC** | — |

---

## Artifact classifications

| Artifact | Classification |
|----------|----------------|
| **OpportunityCandidate** | **MISSING** → add Domain Stage A |
| **OpportunityScore** | **MISSING** → add Domain Stage A |
| **Opportunity** (materialized) | **MIGRATE** to SPEC-007 Aggregate |
| **OpportunityChecklistItem** | **ADAPT** under Opportunity |
| **lifecycleStage + OpportunityStatus dual** | **MIGRATE** to canonical lifecycle |
| **The Scout UI** | **COMPATIBILITY** display/trigger |

---

## Exit criteria (Phase 4 — future)

- Materialize only via SPEC-007 Application after SPEC-004 allow
- `dbService` Opportunity mutators not authority
- UI not status authority
- SPEC-003/004/006 boundaries preserved
- Dual status ambiguity resolved or fail-closed on migrate

---

## Findings linkage

| Audit | Formal ID | Phase 0 disposition |
|-------|-----------|---------------------|
| AUDIT007-01 | F-007-01 | **RESOLVED** (package) |
| AUDIT007-02 | F-007-02 | **APPLICATION_IMPLEMENTED_MIGRATION_PENDING** |
| AUDIT007-03 | F-007-03 | **DOMAIN_IMPLEMENTED_MIGRATION_PENDING** |
| AUDIT007-04 | F-007-04 | **PORT_CONTRACT_IMPLEMENTED_LEGACY_PENDING** |
| AUDIT007-05 | F-007-05 | **APPLICATION_SCORE_WORKFLOW_IMPLEMENTED_CONSUMER_PENDING** |
| AUDIT007-06 | F-007-06 | **RESOLVED** (Stage A/B) |
| AUDIT007-07 | F-007-07 | **DOMAIN_MODEL_IMPLEMENTED_PERSISTENCE_PENDING** |
| AUDIT007-08 | F-007-08 | **OPEN_NONBLOCKING** |
