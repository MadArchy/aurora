# Migration matrix 004 — Strategic Planner

**Phase 0 inventory only.** No migration executed.

Upstream baselines: SPEC-003 @ `e162806…` · SPEC-006 @ `d98c98c…`

---

## Cross-SPEC contract table

| SPEC | Consumed contract | R/W | Authority owner | Mutation by 004? | Failure |
|------|-------------------|-----|-----------------|------------------|---------|
| 001 | thesis via Brief.thesisId | R | SPEC-001 | **No** | Fail closed if missing on Brief |
| 002 | score context via Brief snapshot only | R | SPEC-002 | **No** | No rescore / winner |
| 003 | Brief id/version/status/authorizedAction/thesis/signals/… | R | SPEC-003 | **No** | Stale/non-APPROVED deny |
| 005 | Advisory Gateway ops | R (suggest) | SPEC-005 | **No** new ops in Phase 0 | Advisory failure non-blocking |
| 006 | AuthorizePublication for claim-bearing publish | call existing | SPEC-006 | **No** | Publication deny unchanged |
| 009 | Tenant/auth claims production | — | SPEC-009 | **No** | DEFERRED_UNCHANGED |

---

## Legacy / adjacent surface inventory

| Location | Current behavior | Current authority | Target relationship | Action | Phase |
|----------|------------------|-------------------|---------------------|--------|-------|
| `src/main.ts` curation orchestration | Destination → Brief / content / delivery | **LEGACY split** | Call StrategicPlan use cases | **MIGRATE** | 4 |
| `src/main.ts` `sendDelivery` | Delivery materialization + Brief check | SPEC-003 gate + main | Plan authorize then package | **MIGRATE** | 4 |
| `src/main.ts` content generate / save | Content create + SPEC-006 gate | SPEC-003 + SPEC-006 + main | Plan item CREATE_CONTENT | **MIGRATE** | 4 |
| `src/domain/deliveryCore.ts` | Delivery package rules / Brief requirement | Domain helper / OTHER | Keep packaging rules | **ADAPT** | 4 |
| `src/domain/contentPipeline.ts` | Content status pipeline | Content lifecycle | Downstream of plan | **KEEP_OTHER_SPEC** / ADAPT | 4 |
| `src/domain/contentPublishCore.ts` | Publish helpers | Content | Downstream; SPEC-006 gate | **KEEP_OTHER_SPEC** | 4 |
| `src/domain/workPipeline.ts` | Work/task pipeline | Work | Downstream CREATE_TASK | **ADAPT** | 4 |
| `src/domain/stateMachine.ts` `curationLifecycle` | Curation entry states | Legacy curation | Compatibility | **COMPATIBILITY** | 4 |
| `src/domain/briefConsumerCore.ts` | Destination ↔ authorizedAction map | SPEC-003 helper | Keep mapping; plan uses enum | **KEEP_OTHER_SPEC** | — |
| `src/services/strategicBriefConsumer.ts` | Brief authorize downstream | SPEC-003 composition | Upstream reader for plans | **KEEP_OTHER_SPEC** | 2–3 |
| `src/composition/claimEvidence/*` | Publication gate | SPEC-006 | Unchanged | **KEEP_OTHER_SPEC** | — |
| `src/components/ManagerCockpit.ts` | Manager curation/content UI | Display + triggers | Request plan actions | **ADAPT** | 4 |
| `src/components/ClientWorkspace.ts` | Client curation/content | Display + triggers | Display plan status | **ADAPT** | 4 |
| `src/components/Modals.ts` | Generate content / forms | UI | No direct plan authority | **ADAPT** | 4 |
| `src/application/ai/schemas/advisorCurationAngle*` | Advisory angle | SPEC-005 advisory | Optional advisor input | **COMPATIBILITY** | 2+ |
| `src/services/advisorGateway.ts` / mapAdvisor… | Gateway mapping | SPEC-005 | Advisory only | **KEEP_OTHER_SPEC** | — |
| CurationEntry (types/db) | Intake queue | Legacy | Intake → plan; not Plan | **COMPATIBILITY** → **DEPRECATE** authority | 4 |
| DeliveryPackage / DeliveryItem | Packaging | Downstream | Not Plan aggregate | **KEEP_OTHER_SPEC** | 4 |
| ContentItem | Content artifact | Content + SPEC-006 | Downstream of CREATE_CONTENT | **KEEP_OTHER_SPEC** | 4 |
| Opportunity / Task | Downstream artifacts | Existing domains | Downstream of plan items | **KEEP_OTHER_SPEC** / ADAPT refs | 4 |

---

## Artifact classifications

| Artifact | Classification |
|----------|----------------|
| **CurationEntry** | **COMPATIBILITY / intake** — may seed plan creation; **not** current Plan authority after Phase 4 |
| **DeliveryPackage** | **Downstream packaging** (OTHER_SPEC) — not PlanItem |
| **ContentItem** | **Downstream execution output** — publication = SPEC-006 |
| **Opportunity** | **Downstream** of `CREATE_OPPORTUNITY` PlanItem — Opportunity domain not redesigned |
| **Task / work pipeline** | **Downstream** of `CREATE_TASK` — task UI ≠ strategy authority |

---

## Exit criteria (Phase 4 — future)

- Zero authoritative execution paths that skip StrategicPlan when Brief requires planning (as defined by acceptance)
- CurationEntry not treated as Plan APPROVED
- SPEC-003 / SPEC-006 gates preserved
- No `[0]` thesis authority in planner Domain/App

**Phase 0:** inventory only — **no migration**.

---

## Findings linkage

| Audit | Formal ID | Disposition |
|-------|-----------|-------------|
| AUDIT-004-01 | F-004-01 | **RESOLVED** Phase 0 |
| AUDIT-004-02 | F-004-03 | **OPEN** Phase 4 |
| AUDIT-004-03 | F-004-03 | **OPEN** Phase 4 (+ Domain F-004-02) |
| AUDIT-004-04 | F-004-04 | **OPEN_NONBLOCKING** |
