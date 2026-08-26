# Migration matrix 007 — Opportunity Scout

**Phase 4 consumer migration COMPLETE.** Dual lifecycle and id-only lookup demoted from authority.

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

## Legacy / adjacent surface inventory (Phase 4 final)

| Location | Previous authority | Canonical replacement | Classification | Phase |
|----------|--------------------|----------------------|----------------|-------|
| `src/domain/opportunityLifecycle.ts` | Lifecycle map + checklist templates | Domain lifecycle core + checklist templates | **COMPATIBILITY** templates | 1–4 |
| `src/domain/clientOpportunityCore.ts` | Spotlight / reminder heuristics | DISPLAY_ONLY helpers | **COMPATIBILITY** / DISPLAY_ONLY | 4 |
| `src/types` `Opportunity*` | Type source of truth | Domain types + display projection | **COMPATIBILITY** | 1–4 |
| `dbService.addOpportunity` | Create authority | `materializeOpportunityForDelivery` | **DEPRECATED_AUTHORITY_REMOVED** | 4 |
| `dbService.updateOpportunityDecision` / checklist / submit | Lifecycle authority | Consumer accept/decline/checklist/submit | **DEPRECATED_AUTHORITY_REMOVED** | 4 |
| `dbService.getOpportunityById(id)` | Id-only read authority | Application get with tenant envelope | **LEGACY_DEAD_OR_COMPATIBILITY_NONAUTHORITY** | 4 |
| `dbService.getOpportunitiesByClient` | List authority | `listOpportunitiesForClient` | **COMPATIBILITY_READ_ONLY** | 4 |
| `dbService.mirrorOpportunityCompatibility` | — | After-canonical mirror only | **COMPATIBILITY_WRITE_MIRROR** | 4 |
| `postura_opportunities_v5` | LOCAL_AUTHORITATIVE store | Canonical `postura_opportunity_v1*` + compat reader/mirror | **COMPATIBILITY** | 3–4 |
| `OpportunityPanel.ts` | UI + triggers via db | Consumer list + intent buttons | **ADAPT** → REQUEST/DISPLAY | 4 |
| `ClientPortal.ts` Scout section | Display via db | Consumer projections | **ADAPT** | 4 |
| `main.ts` OPPORTUNITY destination | Create after gate via db | MaterializeOpportunity Application | **MIGRATE** | 4 |
| `src/services/reminders.ts` / AppShell badge | Operational display | COMPATIBILITY read of mirror | **COMPATIBILITY** display | 4 |
| Firestore `clients/{id}/opportunities` | Remote rules (SPEC-009) | Future remote | **OTHER_SPEC** / D1 | Deploy |
| SPEC-002 CREATE_OPPORTUNITY disposition | Signal recommendation | Remains SPEC-002 | **KEEP_OTHER_SPEC** | — |
| SPEC-004 PlanItem CREATE_OPPORTUNITY | Execution allow | Remains SPEC-004 | **KEEP_OTHER_SPEC** | — |

---

## Artifact classifications

| Artifact | Classification |
|----------|----------------|
| **OpportunityCandidate** | Canonical Domain Stage A |
| **OpportunityScore** | Canonical Domain Stage A |
| **Opportunity** (materialized) | Canonical SPEC-007 Aggregate |
| **OpportunityChecklistItem** | Under Opportunity |
| **lifecycleStage + OpportunityStatus dual** | **COMPATIBILITY** mirror only — canonical status authoritative |
| **The Scout UI** | REQUEST / DISPLAY via consumer |

---

## Exit criteria (Phase 4) — SATISFIED

- Materialize only via SPEC-007 Application after SPEC-004 allow
- `dbService` Opportunity mutators not authority
- UI not status authority
- SPEC-003/004/006 boundaries preserved
- Dual status ambiguity resolved or fail-closed on migrate (ambiguous → MIGRATION_REVIEW_REQUIRED)

---

## Findings linkage

| Audit | Formal ID | Phase 4 disposition |
|-------|-----------|---------------------|
| AUDIT007-01 | F-007-01 | **RESOLVED** (package) |
| AUDIT007-02 | F-007-02 | **RESOLVED** |
| AUDIT007-03 | F-007-03 | **RESOLVED** |
| AUDIT007-04 | F-007-04 | **RESOLVED** |
| AUDIT007-05 | F-007-05 | **RESOLVED** |
| AUDIT007-06 | F-007-06 | **RESOLVED** (Stage A/B) |
| AUDIT007-07 | F-007-07 | **RESOLVED** (durable LOCAL history) |
| AUDIT007-08 | F-007-08 | **OPEN_NONBLOCKING** (spotlight DISPLAY_ONLY) |
